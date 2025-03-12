import path from "path";
import { mkdir } from "fs/promises";
import { log } from "../utils/logger.js";
import { write } from "bun";
import {
  getMemoryReadStatus,
  resolveMemoryPaths,
  sanitizeMemoryPath,
  createMemoryPath,
} from "./memoryUtils.js";

/**
 * Create a directory (restricted to ~/.config/clara/ directory)
 * @param dirPath Path to the directory to create
 * @param projectPath Optional project path relative to home directory (determined automatically if not provided)
 * @returns Success message or error
 */
export async function createDirectory(
  dirPath: string,
  projectPath: string = "",
): Promise<string> {
  try {
    // Check if memory has been read before creating directories
    if (!getMemoryReadStatus()) {
      return `MEMORY READ REQUIRED: Before creating new directories in memory, you must first check if related memory already exists. Please use the memoryTool to list available memory files and directories.`;
    }

    // Use the centralized utility to resolve paths
    const { projectMemoryDir } = resolveMemoryPaths(projectPath);

    // Sanitize the directory path
    const sanitizedPath = sanitizeMemoryPath(dirPath);

    // Create the full path
    const fullPath = createMemoryPath(projectMemoryDir, sanitizedPath);

    // Log the path transformation for debugging
    log(`[Directory] Original path: ${dirPath}`, "system");
    log(`[Directory] Sanitized path: ${sanitizedPath}`, "system");
    log(`[Directory] Full path: ${fullPath}`, "system");

    // Create the directory
    await mkdir(fullPath, { recursive: true });

    log(`[Directory] Successfully created ${fullPath}`, "system");
    return `Successfully created directory ${sanitizedPath} in project memory`;
  } catch (error) {
    if (error instanceof Error) {
      log(`[Directory Error] ${error.message}`, "error");
      return `Error creating directory: ${error.message}`;
    }
    return `Error creating directory: ${error}`;
  }
}

/**
 * Write content to Clara's memory system (restricted to ~/.config/clara/ directory)
 * @param filePath Path to the memory file to write
 * @param content Content to write to memory file
 * @param projectPath Optional project path relative to home directory (determined automatically if not provided)
 * @returns Success message or error
 */
export async function writeMemory(
  filePath: string,
  content: string,
  projectPath: string = "",
): Promise<string> {
  try {
    log(`[MemoryWrite] Saving to memory file: ${filePath}`, "system");

    // Check if memory has been read before writing
    if (!getMemoryReadStatus()) {
      return `MEMORY READ REQUIRED: Before writing new information to memory, you must first check if related memory already exists. Please use the memoryTool to list available memory files, then read any relevant files using readFileTool. This prevents duplication and fragmentation of knowledge.`;
    }

    // Use the centralized utility to resolve paths
    const { projectMemoryDir } = resolveMemoryPaths(projectPath);

    // Sanitize the file path
    const sanitizedPath = sanitizeMemoryPath(filePath);

    // Create the full path
    const fullPath = createMemoryPath(projectMemoryDir, sanitizedPath);

    // Log the path transformation for debugging
    log(`[MemoryWrite] Original path: ${filePath}`, "system");
    log(`[MemoryWrite] Sanitized path: ${sanitizedPath}`, "system");
    log(`[MemoryWrite] Target path: ${fullPath}`, "system");

    // Ensure the directory exists
    const dirPath = path.dirname(fullPath);
    await mkdir(dirPath, { recursive: true });

    // Write the file using Bun.write
    const bytesWritten = await write(fullPath, content);

    log(
      `[MemoryWrite] Successfully wrote ${bytesWritten} bytes to ${fullPath}`,
      "system",
    );
    return `Successfully wrote ${bytesWritten} bytes to memory file ${sanitizedPath}`;
  } catch (error) {
    if (error instanceof Error) {
      log(`[MemoryWrite Error] ${error.message}`, "error");
      return `Error writing memory file: ${error.message}`;
    }
    return `Error writing memory file: ${error}`;
  }
}
