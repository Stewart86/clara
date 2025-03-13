import path from "path";
import fs from "fs/promises";
import { log } from "../utils/logger.js";
import {
  setMemoryReadStatus,
  resolveMemoryPaths,
  sanitizeMemoryPath,
  createMemoryPath,
  ensureMemoryDirectoryExists,
} from "./memoryUtils.js";

async function getAllFilesRecursively(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subFiles = await getAllFilesRecursively(itemPath);
        files.push(...subFiles);
      } else {
        files.push(itemPath);
      }
    }
  } catch (error) {
    log(`[Memory] Error scanning directory ${dirPath}: ${error}`, "error");
  }

  return files;
}

function formatFilesList(files: string[], projectMemoryDir: string): string {
  if (files.length === 0) {
    return "No memory files found";
  }

  const formattedFiles = files
    .map((file) => path.relative(projectMemoryDir, file))
    .sort();

  return formattedFiles.join("\n");
}

async function initializeMemoryStructure(
  memoryPath: string,
  projectName: string,
): Promise<string> {
  try {
    await ensureMemoryDirectoryExists(memoryPath);

    const welcomeContent = `# Welcome to Clara's Memory System
    
## Project: ${projectName}
Created: ${new Date().toISOString()}

This memory system stores information about your project to provide continuity between sessions.

## Memory Structure
- codebase/ - Information about code structure and architecture
- insights/ - Key insights about the project's business logic
- technical/ - Technical details and implementation notes
- business/ - Business context and requirements
- preferences/ - User preferences and settings

Feel free to ask me about anything you've previously explained, and I'll check my memory!
`;

    await fs.writeFile(path.join(memoryPath, "README.md"), welcomeContent);

    return `I've initialized my memory system for this project with the following structure:
    
- codebase/ - Information about code structure and architecture
- insights/ - Key insights about the project's business logic
- technical/ - Technical details and implementation notes
- business/ - Business context and requirements
- preferences/ - User preferences and settings

I don't have any specific information stored yet. As we discuss your project, I'll save important details here for future reference.`;
  } catch (error) {
    const err = error as Error;
    log(`[Memory] Error initializing memory: ${err.message}`, "error");
    throw err;
  }
}

export async function readMemory(
  memoryPath: string = "",
  projectPath: string = "",
): Promise<string> {
  try {
    log(`[Memory] Reading from memory: ${memoryPath}`, "system");

    setMemoryReadStatus(true);
    const { projectMemoryDir, resolvedProjectPath } =
      resolveMemoryPaths(projectPath);
    const sanitizedPath = sanitizeMemoryPath(memoryPath);
    const fullMemoryPath = createMemoryPath(projectMemoryDir, sanitizedPath);

    try {
      const stats = await fs.stat(fullMemoryPath);

      if (stats.isDirectory()) {
        try {
          const allFiles = await getAllFilesRecursively(fullMemoryPath);
          const formattedFiles = formatFilesList(allFiles, projectMemoryDir);

          const pathLabel = memoryPath || "root memory directory";
          return `Memory contents in ${pathLabel}:\n\nUse the readFileTool to read any of these files:\n\n${formattedFiles}`;
        } catch (error) {
          const err = error as Error;
          log(`[Memory] Error listing directory: ${err.message}`, "error");
          return `Error reading memory directory: ${err.message}`;
        }
      } else {
        const relativePath = path.relative(projectMemoryDir, fullMemoryPath);
        return `Found memory file: ${relativePath}\n\nPlease use the readFileTool to read this file with:\n\n{
  "filePath": "${relativePath}"
}`;
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === "ENOENT") {
        if (!memoryPath || memoryPath === "") {
          try {
            return await initializeMemoryStructure(
              fullMemoryPath,
              resolvedProjectPath,
            );
          } catch (initError) {
            const err = initError as Error;
            return `Error initializing memory system: ${err.message}`;
          }
        } else {
          return `No memory found at "${memoryPath}". Available directories are: codebase, insights, technical, business, preferences`;
        }
      }

      log(`[Memory Error] ${err.message}`, "error");
      return `Error accessing memory: ${err.message}`;
    }
  } catch (error) {
    const err = error as Error;
    log(`[Memory Error] ${err.message}`, "error");
    return `Error reading memory: ${err.message}`;
  }
}
