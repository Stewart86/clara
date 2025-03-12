import path from "path";
import fs from "fs/promises";
import { mkdir } from "fs/promises";
import { log } from "../utils/logger.js";
import { 
  setMemoryReadStatus, 
  resolveMemoryPaths, 
  sanitizeMemoryPath, 
  createMemoryPath 
} from "./memoryUtils.js";

/**
 * Gets all files recursively in a directory
 * @param dirPath Directory to scan
 * @returns Array of file paths
 */
async function getAllFilesRecursively(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      // Recursively get files from subdirectories
      const subFiles = await getAllFilesRecursively(itemPath);
      files.push(...subFiles);
    } else {
      // Add file to the list
      files.push(itemPath);
    }
  }
  
  return files;
}

/**
 * Reads from Clara's memory system
 * @param memoryPath Path to memory file/directory within the memory system
 * @param projectPath Current project path relative to home directory (determined automatically if not provided)
 * @returns Memory contents or directory listing
 */
export async function readMemory(
  memoryPath: string = "",
  projectPath: string = "",
): Promise<string> {
  try {
    log(`[Memory] Reading from memory: ${memoryPath}`, "system");
    
    // Set the flag to indicate memory has been accessed
    setMemoryReadStatus(true);
    
    // Use the centralized utility to resolve paths
    const { projectMemoryDir, resolvedProjectPath } = resolveMemoryPaths(projectPath);
    
    // Sanitize the memory path
    const sanitizedPath = sanitizeMemoryPath(memoryPath);
    
    // Construct the full path to the memory item
    const fullMemoryPath = createMemoryPath(projectMemoryDir, sanitizedPath);
    
    log(`[Memory] Original path: ${memoryPath}`, "system");
    log(`[Memory] Sanitized path: ${sanitizedPath}`, "system");
    log(`[Memory] Full memory path: ${fullMemoryPath}`, "system");
    
    // Check if the path exists
    try {
      const stats = await fs.stat(fullMemoryPath);
      
      if (stats.isDirectory()) {
        try {
          // List directory contents
          const files = await fs.readdir(fullMemoryPath);
          
          if (files.length === 0) {
            return `No memory files found in ${memoryPath || "the root memory directory"}`;
          }
          
          try {
            // Get detailed file information recursively
            const allFiles = await getAllFilesRecursively(fullMemoryPath);
            
            if (allFiles.length === 0) {
              return `No memory files found in ${memoryPath || "the root memory directory"}`;
            }
            
            // Create a more readable format with relative paths instead of full paths
            const formattedFiles = allFiles.map(file => {
              // Convert the full path to a path relative to the base memory path
              const relativePath = path.relative(projectMemoryDir, file);
              return relativePath;
            });
            
            return `Memory contents in ${memoryPath || "root memory directory"}:\n\nUse the readFileTool to read any of these files:\n\n${formattedFiles.join('\n')}`;
          } catch (error) {
            // Fallback to simple directory listing if recursive search fails
            log(`[Memory] Error in recursive search: ${error}`, "system");
            return `Files in ${memoryPath || "root memory directory"}:\n\n${files.join('\n')}`;
          }
        } catch (error) {
          log(`[Memory] Error reading directory: ${error}`, "system");
          return `Error reading memory directory: ${error.message}`;
        }
      } else {
        // For file requests, suggest using readFileTool instead
        // Use relative path for readability
        const relativePath = path.relative(projectMemoryDir, fullMemoryPath);
        
        return `Found memory file: ${relativePath}\n\nPlease use the readFileTool to read this file with:\n\n{
  "filePath": "${relativePath}"
}`;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Path doesn't exist yet - create the default directory structure if this is the root
        if (!memoryPath || memoryPath === "") {
          try {
            // Create default memory structure with common folders
            await mkdir(fullMemoryPath, { recursive: true });
            
            // Create standard subdirectories
            const standardDirs = ['codebase', 'insights', 'technical', 'business', 'preferences'];
            
            for (const dir of standardDirs) {
              await mkdir(path.join(fullMemoryPath, dir), { recursive: true });
            }
            
            // Create a welcome file
            const welcomeContent = `# Welcome to Clara's Memory System
            
## Project: ${resolvedProjectPath}
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
            
            await fs.writeFile(path.join(fullMemoryPath, 'README.md'), welcomeContent);
            
            return `I've initialized my memory system for this project with the following structure:
            
- codebase/ - Information about code structure and architecture
- insights/ - Key insights about the project's business logic
- technical/ - Technical details and implementation notes
- business/ - Business context and requirements
- preferences/ - User preferences and settings

I don't have any specific information stored yet. As we discuss your project, I'll save important details here for future reference.`;
          } catch (initError) {
            log(`[Memory] Error initializing memory: ${initError}`, "error");
            return `Error initializing memory system: ${initError.message}`;
          }
        } else {
          return `No memory found at "${memoryPath}". Available directories are: codebase, insights, technical, business, preferences`;
        }
      }
      log(`[Memory Error] ${error}`, "error");
      return `Error accessing memory: ${error.message}`;
    }
  } catch (error) {
    log(`[Memory Error] ${error}`, "error");
    return `Error reading memory: ${error.message}`;
  }
}