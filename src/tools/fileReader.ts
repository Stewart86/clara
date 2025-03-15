import { file, $ } from "bun";
import fs from "fs/promises";
import path from "path";
import { log } from "../utils/logger.js";
import { CONFIG } from "./memoryUtils.js";
import { SETTING_DIR } from "../../constants.js";

/**
 * Read the contents of a specified file
 * @param filePath Path to read
 * @param directory Optional directory to resolve relative paths (defaults to current directory)
 * @param lineRange Optional range of lines to read (format: {start: number, end: number})
 * @param readEntireFile Optional flag to force reading the entire file, even if it's large
 * @returns File contents as string
 */
export async function readFile(
  filePath: string,
  directory: string = ".",
  lineRange?: { start: number; end: number },
  readEntireFile: boolean = false,
): Promise<string> {
  try {
    // Special handling for memory files
    // Check if the path starts with a common memory path pattern
    if (
      filePath.includes(".config/clara") ||
      filePath.includes("codebase/") ||
      filePath.includes("insights/") ||
      filePath.includes("technical/")
    ) {
      // This might be a memory file path - attempt to check in the memory location
      const projectId = CONFIG.projectIdentifier || "default";
      const memoryBasePath = path.join(SETTING_DIR, projectId);

      // Strip any .config/clara prefix if present
      const cleanPath = filePath.replace(/.*\.config\/clara\/[^\/]+\//, "");

      // Create the full memory path
      const memoryPath = path.join(memoryBasePath, cleanPath);
      log(`[Read] Checking memory path: ${memoryPath}`, "system");

      try {
        const stats = await fs.stat(memoryPath);
        if (stats.isFile()) {
          log(`[Read] Found file in memory: ${memoryPath}`, "system");
          return await readFileContent(memoryPath, lineRange, readEntireFile);
        }
      } catch (error) {
        // Memory file doesn't exist, continue with normal path
        log(`[Read] Memory file not found: ${memoryPath}`, "system");
      }
    }

    // Check if the path exists directly (absolute or relative path)
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(directory, filePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isFile()) {
        return await readFileContent(absolutePath, lineRange, readEntireFile);
      } else {
        return `Error: ${absolutePath} exists but is not a file.`;
      }
    } catch (error) {
      return `File not found: ${absolutePath}. Please provide a valid file path.`;
    }
  } catch (error) {
    if (error instanceof Error) {
      log(`[Read Error] ${error.message}`, "error");
      return `Error finding or reading file: ${error.message}`;
    }
    return `Error finding or reading file: ${error}`;
  }
}

/**
 * Read the content of a file once the path is confirmed
 * @param filePath Absolute path to the file
 * @param lineRange Optional range of lines to read (format: {start: number, end: number})
 * @param readEntireFile Optional flag to force reading the entire file, even if it's large
 * @returns File contents as string
 */
async function readFileContent(
  filePath: string,
  lineRange?: { start: number; end: number },
  readEntireFile: boolean = false,
): Promise<string> {
  $.throws(true); // Throw an error if the command fails
  try {
    log(`[Read] Opening file: ${filePath}`, "system");
    
    // Special case: If lineRange.start is 0, treat it as a request to read the entire file
    if (lineRange && lineRange.start === 0) {
      readEntireFile = true;
      log(`[Read] Line range starts with 0, enabling full file read`, "system");
      // Proceed to full file reading below (we'll skip the lineRange handling)
    }
    // If line range is specified and not the special case (start=0), use bat or another method to read specific lines
    else if (lineRange) {
      try {
        log(
          `[Read] Reading lines ${lineRange.start}-${lineRange.end || "end"} from ${filePath}`,
          "system",
        );

        // Try to use 'bat' command to read specific lines
        try {
          // First check if bat is available
          await $`which bat`.quiet();

          // Prepare the line range argument
          let rangeArg: string;
          if (lineRange.end) {
            rangeArg = `${lineRange.start}:${lineRange.end}`;
          } else {
            rangeArg = `${lineRange.start}:`; // Read from start to end of file
          }

          // Use bat with line-range option and plain style (no decorations)
          const { stdout } =
            await $`bat --line-range=${rangeArg} --plain --color=never ${filePath}`.quiet();
          const relativeFile = path.relative(process.cwd(), filePath);
          log(`[Read] Successfully read lines ${rangeArg} from ${relativeFile}`, "system");
          return stdout.toString();
        } catch (e) {
          // bat is not available, fallback to using Bun.file and manual line processing
          log(
            `[Read] 'bat' command not available, falling back to line processing`,
            "system",
          );

          // Read the file with Bun.file
          const content = await file(filePath).text();
          const lines = content.split("\n");

          // Calculate start and end lines (1-based indexing for user input, 0-based for array)
          const startIdx = Math.max(0, lineRange.start - 1);
          const endIdx = lineRange.end
            ? Math.min(lines.length, lineRange.end)
            : lines.length;

          // Extract the requested lines
          const selectedLines = lines.slice(startIdx, endIdx);
          return selectedLines.join("\n");
        }
      } catch (error) {
        if (error instanceof Error) {
          log(`[Read] Error reading line range: ${error.message}`, "system");
          // Fall through to full file reading
        }
      }
    }

    // Use Bun.file for efficient file reading of the whole file
    try {
      const initFile = file(filePath);
      const size = initFile.size;
      log(`[Read] File size: ${size} bytes`, "system");

      // Check if the file is too large and readEntireFile is not set
      if (size > 1000000 && !readEntireFile) {
        // over 1MB
        log(
          `[Read] File is large (${size} bytes), reading first and last parts`,
          "system",
        );

        // For large files, read first and last parts
        const start = await initFile.slice(0, 500000).text();
        const end = await initFile.slice(-200000).text();

        return `${start}\n\n[...file too large (${size} bytes), showing beginning and end...]\n\n${end}`;
      }

      // For normal sized files or when readEntireFile is true, read the entire content
      const content = await initFile.text();
      const relativeFile = path.relative(process.cwd(), filePath);
      log(`[Read] Successfully read ${content.length} bytes from ${relativeFile}`, "system");
      return content;
    } catch (error) {
      if (error instanceof Error) {
        log(`[Read] Error reading with Bun.file: ${error.message}`, "system");

        // Check if it's a binary file
        try {
          const { stdout } = await $`file ${filePath}`.quiet();
          const fileTypeOutput = stdout.toString();

          if (fileTypeOutput.includes("binary")) {
            return `[Binary file detected: ${fileTypeOutput}]`;
          }
        } catch (e) {
          // Ignore file type detection errors
        }

        return `Error reading file: ${filePath}: ${error.message}`;
      }
      return `Error reading file: ${filePath}: ${error}`;
    }
  } catch (error) {
    if (error instanceof Error) {
      log(`[Read Error] ${error.message}`, "error");
      return `Error reading file: ${error.message}`;
    }
    return `Error reading file: ${error}`;
  }
}
