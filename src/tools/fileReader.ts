import { file, spawn } from "bun";
import fs from "fs/promises";
import path from "path";
import { log } from "../utils/logger.js";
import { searchFiles } from "./search.js";
import { CONFIG } from "./memoryUtils.js";

/**
 * Search for a file and then read its contents
 * @param filePath Path or name pattern to find and read
 * @param directory Optional directory to search in (defaults to current directory)
 * @returns File contents as string or search results if multiple matches found
 */
export async function readFile(
  filePath: string,
  directory: string = ".",
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
      const homeDir = process.env.HOME || "~";
      const projectId = CONFIG.projectIdentifier || "default";
      const memoryBasePath = path.join(homeDir, ".config", "clara", projectId);

      // Strip any .config/clara prefix if present
      const cleanPath = filePath.replace(/.*\.config\/clara\/[^\/]+\//, "");

      // Create the full memory path
      const memoryPath = path.join(memoryBasePath, cleanPath);
      log(`[Read] Checking memory path: ${memoryPath}`, "system");

      try {
        const stats = await fs.stat(memoryPath);
        if (stats.isFile()) {
          log(`[Read] Found file in memory: ${memoryPath}`, "system");
          return await readFileContent(memoryPath);
        }
      } catch (error) {
        // Memory file doesn't exist, continue with normal path
        log(`[Read] Memory file not found: ${memoryPath}`, "system");
      }
    }

    // First check if the path exists directly (absolute or relative path)
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(directory, filePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isFile()) {
        return await readFileContent(absolutePath);
      }
    } catch (error) {
      // File doesn't exist, proceed with search
      log(
        `[Read] File not found directly: ${absolutePath}, proceeding with search`,
        "system",
      );
    }

    // Determine if filePath is a specific filename or a pattern
    const filename = path.basename(filePath);

    // Search for the file
    log(`[Read] Searching for file: ${filename} in ${directory}`, "system");

    // First try exact filename match
    const exactSearch = await searchFiles(filename, directory);

    // If no exact match found, try with glob pattern
    if (exactSearch.includes("No files found")) {
      // Try with extension if provided, or with a glob pattern for common extensions
      const filePattern = filePath.includes(".")
        ? `**/*${filename}*`
        : `**/*${filename}*`;

      log(
        `[Read] No exact match found, trying with pattern: ${filePattern}`,
        "system",
      );
      const patternSearch = await searchFiles(filePattern, directory);

      if (patternSearch.includes("No files found")) {
        return `File not found: ${filePath}. Please try with a more specific filename or path.`;
      }

      // Extract file paths from search results
      const matchedFiles = extractFilePathsFromSearchResults(patternSearch);

      if (matchedFiles.length === 0) {
        return `No matching files found for: ${filePath}`;
      } else if (matchedFiles.length === 1) {
        // If only one file found, read it
        return await readFileContent(matchedFiles[0]);
      } else {
        // Multiple matches, list them and ask for clarification
        return `Multiple files found matching '${filePath}':\n${matchedFiles.join("\n")}\n\nPlease specify a more precise path.`;
      }
    } else {
      // Extract file paths from exact search results
      const matchedFiles = extractFilePathsFromSearchResults(exactSearch);

      if (matchedFiles.length === 0) {
        return `No matching files found for: ${filePath}`;
      } else if (matchedFiles.length === 1) {
        // If only one file found, read it
        return await readFileContent(matchedFiles[0]);
      } else {
        // Multiple matches, list them and ask for clarification
        return `Multiple files found matching '${filePath}':\n${matchedFiles.join("\n")}\n\nPlease specify a more precise path.`;
      }
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
 * Extracts file paths from search results text
 */
function extractFilePathsFromSearchResults(searchResults: string): string[] {
  const lines = searchResults.split("\n");
  const paths: string[] = [];

  let inFilesSection = false;

  for (const line of lines) {
    if (line.startsWith("Files ")) {
      inFilesSection = true;
      continue;
    }

    if (inFilesSection && line.trim() && !line.startsWith("No files")) {
      paths.push(line.trim());
    }

    if (inFilesSection && line === "") {
      inFilesSection = false;
    }
  }

  return paths;
}

/**
 * Read the content of a file once the path is confirmed
 * @param filePath Absolute path to the file
 * @returns File contents as string
 */
async function readFileContent(filePath: string): Promise<string> {
  try {
    log(`[Read] Opening file: ${filePath}`, "system");

    // Use Bun.file for efficient file reading
    try {
      const initFile = file(filePath);
      const size = initFile.size;
      log(`[Read] File size: ${size} bytes`, "system");

      // Check if the file is too large
      if (size > 1000000) {
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

      // For normal sized files, read the entire content
      const content = await initFile.text();
      log(`[Read] Successfully read ${content.length} bytes`, "system");
      return content;
    } catch (error) {
      if (error instanceof Error) {
        log(`[Read] Error reading with Bun.file: ${error.message}`, "system");

        // Check if it's a binary file
        try {
          const proc = spawn(["file", filePath]);
          const fileTypeOutput = await new Response(proc.stdout).text();
          await proc.exited;

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
