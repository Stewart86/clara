import path from "path";
import os from "os";
import fs from "fs/promises";
import { log } from "../utils/logger.js";

// Memory system configuration
export const CONFIG = {
  // A consistent project identifier that will be used across sessions
  projectIdentifier: "",
  // Set this to false to preserve the full project path structure
  // Set to true to use only the project name (without parent directories)
  useSimplifiedPaths: false,
};

// Global flag to track if memory has been accessed
let _hasReadMemory = false;

/**
 * Gets the current memory read status
 * @returns Current status of memory reading
 */
export function getMemoryReadStatus(): boolean {
  return _hasReadMemory;
}

/**
 * Sets the memory read status
 * @param status New status value
 */
export function setMemoryReadStatus(status: boolean): void {
  _hasReadMemory = status;
  log(`[Memory] Set memory read status to: ${status}`, "system");
}

/**
 * Resets the memory read status
 * Called at the start of new conversations
 */
export function resetMemoryReadStatus(): void {
  _hasReadMemory = false;
  log(`[Memory] Reset memory read status`, "system");
}

/**
 * Sets the project identifier for memory paths
 * @param identifier Project identifier to use
 */
export function setProjectIdentifier(identifier: string): void {
  CONFIG.projectIdentifier = identifier;
}

/**
 * Extracts a clean, simplified project identifier from a path
 * @param fullPath Full path to extract from
 * @returns Simplified project identifier
 */
export function extractProjectIdentifier(fullPath: string): string {
  // Get just the project name from a path like /home/user/Projects/ProjectName/...
  const parts = fullPath.split("/").filter((part) => part.length > 0);

  // Find the most likely project name by checking parts from the end
  for (let i = parts.length - 1; i >= 0; i--) {
    if (
      parts[i] !== "src" &&
      parts[i] !== "dist" &&
      !parts[i].startsWith(".")
    ) {
      // Check for generic app names and try to use the parent directory instead
      if (
        parts[i] === "web-app" ||
        parts[i] === "app" ||
        parts[i] === "website"
      ) {
        // If it's a generic "app" name, look one level up if possible
        if (i > 0) {
          return parts[i - 1];
        }
      }

      // Return the current part as the project identifier
      return parts[i];
    }
  }

  // Fallback to the last path segment
  return path.basename(fullPath);
}

/**
 * Single source of truth for determining project and memory paths
 * @param projectPath Optional project path override
 * @returns Object with baseDir, projectPath, and projectMemoryDir
 */
export async function ensureMemoryDirectoryExists(
  memoryDir: string,
): Promise<void> {
  try {
    try {
      await fs.access(memoryDir);
      // Directory exists
    } catch (error) {
      // Directory doesn't exist, create it
      log(`[Memory] Creating memory directory: ${memoryDir}`, "system");
      await fs.mkdir(memoryDir, { recursive: true });

      // Create standard subdirectories
      const standardDirs = [
        "codebase",
        "insights",
        "technical",
        "business",
        "preferences",
      ];
      for (const dir of standardDirs) {
        await fs.mkdir(path.join(memoryDir, dir), { recursive: true });
      }

      // Create a welcome README
      const welcomeContent = `# Clara Memory System
      
Created: ${new Date().toISOString()}

This directory stores Clara's memory for your project.

## Directory Structure
- codebase/ - Information about code structure and architecture
- insights/ - Key insights about the project
- technical/ - Technical details and implementation notes
- business/ - Business context and requirements
- preferences/ - User preferences and settings
`;

      await fs.writeFile(path.join(memoryDir, "README.md"), welcomeContent);
      log(
        `[Memory] Initialized memory directory with standard structure`,
        "system",
      );
    }
  } catch (error) {
    log(`[Memory] Error ensuring memory directory: ${error}`, "error");
  }
}

/**
 * Gets a list of all memory files in the project memory directory
 * @param projectPath Optional project path override
 * @returns Object with memory files information
 */
export async function getMemoryFilesInfo(projectPath: string = ""): Promise<{
  memoryDir: string;
  files: string[];
  message: string;
}> {
  try {
    const { projectMemoryDir, resolvedProjectPath } =
      resolveMemoryPaths(projectPath);

    // Ensure the directory exists
    await ensureMemoryDirectoryExists(projectMemoryDir);

    // Get all files recursively
    const files: string[] = [];

    // Function to recursively get files
    async function getFilesRecursively(dir: string) {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          await getFilesRecursively(fullPath);
        } else {
          // Store paths relative to the project memory directory
          const relativePath = path.relative(projectMemoryDir, fullPath);
          files.push(relativePath);
        }
      }
    }

    await getFilesRecursively(projectMemoryDir);

    // Create helpful message
    const message = `
# Clara's Memory Files
I have access to ${files.length} memory files for project: ${resolvedProjectPath}
Memory directory: ${projectMemoryDir}

## Available Memory Files
${files.map((file) => `- ${file}`).join("\n")}

I'll start my investigation using these memory files to understand the project better.
`;

    return {
      memoryDir: projectMemoryDir,
      files,
      message,
    };
  } catch (error) {
    log(`[Memory] Error getting memory files: ${error}`, "error");
    return {
      memoryDir: "",
      files: [],
      message: `Error accessing memory files: ${error}`,
    };
  }
}

export function resolveMemoryPaths(projectPath: string = ""): {
  homeDir: string;
  baseDir: string;
  resolvedProjectPath: string;
  projectMemoryDir: string;
} {
  // Get the home directory
  const homeDir = os.homedir();

  // Get the base memory directory
  const baseDir = path.join(homeDir, ".config", "clara");

  // Use explicitly configured project identifier if available
  let resolvedProjectPath = projectPath;

  if (CONFIG.projectIdentifier) {
    // If a project identifier has been explicitly set, use it
    resolvedProjectPath = CONFIG.projectIdentifier;
  } else if (!projectPath) {
    // Get current working directory
    const cwd = process.cwd();

    // Use a simplified project identifier extraction
    const projectId = extractProjectIdentifier(cwd);

    // Determine if we should use the full relative path or just the project identifier
    if (CONFIG.useSimplifiedPaths) {
      // Just use the project name
      resolvedProjectPath = projectId;
      log(
        `[Memory] Using simplified project identifier: ${resolvedProjectPath}`,
        "system",
      );
    } else if (cwd.startsWith(homeDir)) {
      // Get the path relative to home directory, with Projects/ prefix removed if present
      let relativePath = cwd.substring(homeDir.length).replace(/^\/+/, "");

      // If the path includes 'Projects' or 'projects', extract everything after that
      const projectsMatch = relativePath.match(/^(?:Projects|projects)\/(.+)$/);
      if (projectsMatch && projectsMatch[1]) {
        relativePath = projectsMatch[1];
      }

      resolvedProjectPath = relativePath;
      log(`[Memory] Using relative path: ${resolvedProjectPath}`, "system");
    } else {
      // Use the last directory name as the project identifier
      resolvedProjectPath = path.basename(cwd);
      log(
        `[Memory] Using fallback project path: ${resolvedProjectPath}`,
        "system",
      );
    }
  }

  // Get the project-specific memory directory
  const projectMemoryDir = path.join(baseDir, resolvedProjectPath);

  // Trigger directory creation (non-blocking, don't wait for it)
  ensureMemoryDirectoryExists(projectMemoryDir).catch((err) => {
    log(`[Memory] Failed to ensure memory directory exists: ${err}`, "error");
  });

  return {
    homeDir,
    baseDir,
    resolvedProjectPath,
    projectMemoryDir,
  };
}

/**
 * Sanitizes a file or directory path for safe usage
 * @param filePath Path to sanitize
 * @returns Sanitized path (relative path only)
 */
export function sanitizeMemoryPath(filePath: string): string {
  return filePath
    .replace(/^[\/~]+/, "") // Remove leading slashes and tildes
    .replace(/\.\.\//g, "") // Remove any "../" components
    .replace(/^\.\//, "") // Remove leading "./"
    .replace(/^(\.config|home|clara)\//i, ""); // Remove any attempts to specify system directories
}

/**
 * Creates the full, safe path for a memory file or directory
 * @param projectMemoryDir The base project memory directory
 * @param relativePath The relative path within project memory
 * @returns Full sanitized path
 */
export function createMemoryPath(
  projectMemoryDir: string,
  relativePath: string,
): string {
  const sanitizedPath = sanitizeMemoryPath(relativePath);
  return path.join(projectMemoryDir, sanitizedPath);
}
