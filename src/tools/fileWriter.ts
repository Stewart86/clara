import fs from "fs/promises";
import path from "path";
import { log, getSessionState } from "../utils/index.js";
import { CONFIG } from "./memoryUtils.js";
import { SETTING_DIR } from "../../constants.js";
import { generateDiff } from "../utils/diff.js";

// Interface for the file edit approval state
export interface FileEditApprovalState {
  // Map of file patterns to approval status
  patterns: Map<string, boolean>;

  // Add a file pattern approval
  approve(filePath: string): void;

  // Check if a file is already approved for editing
  isApproved(filePath: string): boolean;
}

/**
 * Verify if a path is within permitted boundaries (memory directory or current working directory)
 * @param filePath Path to verify
 * @returns Whether the path is allowed for editing
 */
export async function isPathAllowedForEdit(filePath: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    // Convert to absolute path if it's not already
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Get the current working directory
    const cwd = process.cwd();

    // Check if path is within current directory or its subdirectories
    if (absolutePath.startsWith(cwd)) {
      return { allowed: true };
    }

    // Check if path is within memory directory
    const projectId = CONFIG.projectIdentifier || "default";
    const memoryBasePath = path.join(SETTING_DIR, projectId);

    if (absolutePath.startsWith(memoryBasePath)) {
      return { allowed: true };
    }

    // Path is not in allowed locations
    return {
      allowed: false,
      reason:
        "File path must be within the current working directory or Clara's memory directory.",
    };
  } catch (error) {
    log(`[Edit] Error checking if path is allowed: ${error}`, "error");
    return {
      allowed: false,
      reason: `Error validating path: ${error}`,
    };
  }
}

/**
 * Ask user for approval before editing a file
 * @param filePath Path to the file to be edited
 * @param diff Diff content showing the changes to be made
 * @returns User's approval decision
 */
async function askUserFileEditApproval(
  filePath: string,
  diff: string,
): Promise<{
  approved: boolean;
  rememberChoice: boolean;
  feedback: string;
}> {
  // Display the file path and diff
  log(`[Edit] File: ${filePath}`, "system");
  console.log(`\n\x1b[1;36mProposed Changes:\x1b[0m`);
  console.log(diff);

  // Get the session state to check for shared readline
  const sessionState = getSessionState();

  // Add the file edit approval state if it doesn't exist
  if (!sessionState.fileEditApprovals) {
    sessionState.fileEditApprovals = {
      patterns: new Map<string, boolean>(),

      approve(filePath: string): void {
        this.patterns.set(filePath, true);

        // Also approve the directory for future edits to other files in the same dir
        const dirPath = path.dirname(filePath);
        this.patterns.set(`dir:${dirPath}`, true);
      },

      isApproved(filePath: string): boolean {
        // Check for exact file path match
        if (this.patterns.has(filePath)) {
          return true;
        }

        // Check if directory is approved for edits
        const dirPath = path.dirname(filePath);
        if (this.patterns.has(`dir:${dirPath}`)) {
          return true;
        }

        return false;
      },
    };
  }

  const sharedReadline = sessionState.getSharedReadline();

  // If we have a shared readline interface, use it
  if (sharedReadline !== null) {
    // Pause the main readline interface temporarily
    const wasListening = !sharedReadline.pause;
    if (wasListening) {
      sharedReadline.pause();
    }

    // Create a simple question function using the shared readline
    const ask = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        console.log(prompt);

        const onLine = (line: string) => {
          // Clean up listener and resolve with answer
          sharedReadline.removeListener("line", onLine);
          resolve(line.trim());
        };

        // Listen just for this one line
        sharedReadline.once("line", onLine);

        // Resume to get input
        sharedReadline.resume();
      });
    };

    try {
      // Ask for file edit approval with option to provide feedback
      const answer = await ask(
        "\n\x1b[1;33mApprove these changes? (y/n or provide feedback with rejection): \x1b[0m",
      );

      // Check if the answer starts with y/yes for approval
      const approved =
        answer.toLowerCase() === "y" ||
        answer.toLowerCase() === "yes" ||
        answer.toLowerCase().startsWith("y ");

      // Extract feedback if provided (anything after the y/n)
      let feedback = "";
      if (!approved && answer.length > 1 && answer.toLowerCase() !== "no") {
        // If it starts with "n" or "no", extract everything after that
        if (
          answer.toLowerCase().startsWith("n ") ||
          answer.toLowerCase().startsWith("no ")
        ) {
          const match = answer.match(/^(n|no)\s+(.*)/i);
          feedback = match ? match[2] : answer;
        } else {
          // Otherwise, assume the entire response is feedback
          feedback = answer;
        }
      }

      // If approved, ask about remembering the choice
      let rememberChoice = false;
      if (approved) {
        const rememberAnswer = await ask(
          "Remember this choice for all edits to this file/directory for the rest of the session? (y/n): ",
        );
        rememberChoice =
          rememberAnswer.toLowerCase() === "y" ||
          rememberAnswer.toLowerCase() === "yes";
      }

      return { approved, rememberChoice, feedback };
    } finally {
      // Restore previous readline state
      if (!wasListening) {
        sharedReadline.pause();
      }
    }
  } else {
    // Fallback to Bun's built-in prompt
    console.log(
      "\n\x1b[1;33mApprove these changes? (y/n or provide feedback with rejection): \x1b[0m",
    );
    const answer = prompt("") || "n";

    // Check if the answer starts with y/yes for approval
    const approved =
      answer.toLowerCase() === "y" ||
      answer.toLowerCase() === "yes" ||
      answer.toLowerCase().startsWith("y ");

    // Extract feedback if provided (anything after the y/n)
    let feedback = "";
    if (!approved && answer.length > 1 && answer.toLowerCase() !== "no") {
      // If it starts with "n" or "no", extract everything after that
      if (
        answer.toLowerCase().startsWith("n ") ||
        answer.toLowerCase().startsWith("no ")
      ) {
        const match = answer.match(/^(n|no)\s+(.*)/i);
        feedback = match ? match[2] : answer;
      } else {
        // Otherwise, assume the entire response is feedback
        feedback = answer;
      }
    }

    // If approved, ask about remembering the choice
    let rememberChoice = false;
    if (approved) {
      console.log(
        "Remember this choice for all edits to this file/directory for the rest of the session? (y/n): ",
      );
      const rememberAnswer = prompt("") || "n";
      rememberChoice =
        rememberAnswer.toLowerCase() === "y" ||
        rememberAnswer.toLowerCase() === "yes";
    }

    return { approved, rememberChoice, feedback };
  }
}

/**
 * Edit a file by replacing a specific string with a new one
 * @param filePath Path to the file to edit
 * @param oldString The string to replace
 * @param newString The new string to insert
 * @returns Result message
 */
export async function editFile(
  filePath: string,
  oldString: string,
  newString: string,
): Promise<string> {
  try {
    // Check if path is allowed for editing
    const { allowed, reason } = await isPathAllowedForEdit(filePath);
    if (!allowed) {
      return `Error: ${reason}`;
    }

    // Convert to absolute path if needed
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Check if file exists (for edit) or directory exists (for new file)
    let isNewFile = false;
    try {
      const stats = await fs.stat(absolutePath);
      isNewFile = false;
    } catch (error) {
      // File doesn't exist, check if we're creating a new file
      if (oldString === "") {
        isNewFile = true;

        // Check if parent directory exists
        const parentDir = path.dirname(absolutePath);
        try {
          await fs.access(parentDir);
        } catch (e) {
          return `Error: Parent directory ${parentDir} does not exist. Please create it first.`;
        }
      } else {
        return `Error: File ${absolutePath} not found.`;
      }
    }

    // Check if this file or directory is already approved for editing
    const sessionState = getSessionState();
    if (
      sessionState.fileEditApprovals &&
      sessionState.fileEditApprovals.isApproved(absolutePath)
    ) {
      log(
        `[Edit] Using pre-approved edit permission for ${absolutePath}`,
        "system",
      );

      // Generate the diff to show to user even if pre-approved
      let diff = "";
      if (isNewFile) {
        diff = generateDiff("", newString, absolutePath);
      } else {
        const currentContent = await fs.readFile(absolutePath, "utf8");
        if (!currentContent.includes(oldString)) {
          return `Error: The text to replace was not found in the file. Make sure to include exact whitespace and formatting.`;
        }

        // Make sure only a single instance is found
        const count = (
          currentContent.match(new RegExp(escapeRegExp(oldString), "g")) || []
        ).length;
        if (count > 1) {
          return `Error: The text to replace appears ${count} times in the file. Please provide more context to uniquely identify which instance to replace.`;
        }

        const newContent = currentContent.replace(oldString, newString);
        diff = generateDiff(currentContent, newContent, absolutePath);
      }

      // Display the file path and diff for pre-approved edit
      log(`[Edit] File: ${absolutePath}`, "system");
      console.log(`\n\x1b[1;36mPre-approved Changes:\x1b[0m`);
      console.log(diff);

      // Perform the edit since it's pre-approved
      return await performFileEdit(
        absolutePath,
        oldString,
        newString,
        isNewFile,
      );
    }

    // Generate the diff to show to user
    let diff = "";
    if (isNewFile) {
      // For new files, just show the content to be added
      diff = generateDiff("", newString, absolutePath);
    } else {
      // Read the current file content
      const currentContent = await fs.readFile(absolutePath, "utf8");

      if (!currentContent.includes(oldString)) {
        return `Error: The text to replace was not found in the file. Make sure to include exact whitespace and formatting.`;
      }

      // Make sure only a single instance is found
      const count = (
        currentContent.match(new RegExp(escapeRegExp(oldString), "g")) || []
      ).length;
      if (count > 1) {
        return `Error: The text to replace appears ${count} times in the file. Please provide more context to uniquely identify which instance to replace.`;
      }

      // Generate diff between old and new content
      const newContent = currentContent.replace(oldString, newString);
      diff = generateDiff(currentContent, newContent, absolutePath);
    }

    // Ask user for approval
    const { approved, rememberChoice, feedback } =
      await askUserFileEditApproval(absolutePath, diff);

    if (approved) {
      log(`[Edit] User approved edits to ${absolutePath}`, "system");

      // Remember approval for this file/directory if requested
      if (rememberChoice && sessionState.fileEditApprovals) {
        sessionState.fileEditApprovals.approve(absolutePath);
        log(`[Edit] Remembering approval for: ${absolutePath}`, "system");
      }

      return await performFileEdit(
        absolutePath,
        oldString,
        newString,
        isNewFile,
      );
    } else {
      log(
        `[Edit] User rejected edits to ${absolutePath}${feedback ? `: ${feedback}` : ""}`,
        "system",
      );

      if (feedback) {
        return `File edit rejected: ${feedback}`;
      } else {
        return `File edit cancelled by user. Please provide alternative instructions or modifications.`;
      }
    }
  } catch (error) {
    log(`[Edit Error] ${error}`, "error");
    return `Error editing file: ${error}`;
  }
}

/**
 * Actually perform the file edit after approval
 * @param filePath Path to the file
 * @param oldString String to replace
 * @param newString New string to insert
 * @param isNewFile Whether this is a new file
 * @returns Result message
 */
async function performFileEdit(
  filePath: string,
  oldString: string,
  newString: string,
  isNewFile: boolean,
): Promise<string> {
  try {
    if (isNewFile) {
      // Create new file with content
      await fs.writeFile(filePath, newString, "utf8");
      return `Created new file ${filePath} successfully.`;
    } else {
      // Read current content
      const currentContent = await fs.readFile(filePath, "utf8");

      // Replace the old string with the new one
      if (!currentContent.includes(oldString)) {
        return `Error: The text to replace was not found in the file.`;
      }

      const newContent = currentContent.replace(oldString, newString);

      // Write the modified content back to the file
      await fs.writeFile(filePath, newContent, "utf8");
      return `File ${filePath} updated successfully.`;
    }
  } catch (error) {
    log(`[Edit Error] ${error}`, "error");
    return `Error performing file edit: ${error}`;
  }
}

/**
 * Escape special regex characters for exact string matching
 * @param string String to escape
 * @returns Escaped string for RegExp
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Completely replace a file with new content
 * @param filePath Path to the file
 * @param content New content
 * @returns Result message
 */
export async function replaceFile(
  filePath: string,
  content: string,
  reason: string,
): Promise<string> {
  try {
    // Check if path is allowed for editing
    const { allowed, reason } = await isPathAllowedForEdit(filePath);
    if (!allowed) {
      return `Error: ${reason}`;
    }

    // Convert to absolute path if needed
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Check if file exists or we're creating a new one
    let isNewFile = false;
    let oldContent = "";

    try {
      oldContent = await fs.readFile(absolutePath, "utf8");
      isNewFile = false;
    } catch (error) {
      isNewFile = true;

      // Check if parent directory exists
      const parentDir = path.dirname(absolutePath);
      try {
        await fs.access(parentDir);
      } catch (e) {
        return `Error: Parent directory ${parentDir} does not exist. Please create it first.`;
      }
    }

    // Check if this file or directory is already approved for editing
    const sessionState = getSessionState();
    if (
      sessionState.fileEditApprovals &&
      sessionState.fileEditApprovals.isApproved(absolutePath)
    ) {
      log(
        `[Edit] Using pre-approved edit permission for ${absolutePath}`,
        "system",
      );

      // Generate the diff to show to user even if pre-approved
      const diff = generateDiff(oldContent, content, absolutePath);
      log(`${reason}`, "info");

      // Display the file path and diff for pre-approved edit
      log(`[Edit] File: ${absolutePath}`, "system");
      console.log(`\n\x1b[1;36mPre-approved Changes:\x1b[0m`);
      console.log(diff);

      // Perform the edit since it's pre-approved
      await fs.writeFile(absolutePath, content, "utf8");
      return `File ${absolutePath} ${isNewFile ? "created" : "replaced"} successfully.`;
    }

    // Generate the diff to show to user
    const diff = generateDiff(oldContent, content, absolutePath);

    // Ask user for approval
    const { approved, rememberChoice, feedback } =
      await askUserFileEditApproval(absolutePath, diff);

    if (approved) {
      log(
        `[Edit] User approved ${isNewFile ? "creation" : "replacement"} of ${absolutePath}`,
        "system",
      );

      // Remember approval for this file/directory if requested
      if (rememberChoice && sessionState.fileEditApprovals) {
        sessionState.fileEditApprovals.approve(absolutePath);
        log(`[Edit] Remembering approval for: ${absolutePath}`, "system");
      }

      // Write the file
      await fs.writeFile(absolutePath, content, "utf8");
      return `File ${absolutePath} ${isNewFile ? "created" : "replaced"} successfully.`;
    } else {
      log(
        `[Edit] User rejected edits to ${absolutePath}${feedback ? `: ${feedback}` : ""}`,
        "system",
      );

      if (feedback) {
        return `File edit rejected: ${feedback}`;
      } else {
        return `File edit cancelled by user. Please provide alternative instructions or modifications.`;
      }
    }
  } catch (error) {
    log(`[Edit Error] ${error}`, "error");
    return `Error writing file: ${error}`;
  }
}
