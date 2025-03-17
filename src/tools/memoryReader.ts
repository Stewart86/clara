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
import { getMemoryIndexer } from "./memoryIndex.js";

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
          // Get the indexer
          const indexer = getMemoryIndexer();
          
          // Try to get indexed files first
          try {
            const index = await indexer.getIndex(projectPath);
            const categoryEntries = Object.entries(index.entries)
              .filter(([path]) => {
                // Only include files in the requested directory
                if (!sanitizedPath) return true; // All files if no path specified
                return path.startsWith(sanitizedPath);
              })
              .sort((a, b) => {
                // Sort by access count (most accessed first)
                const countA = a[1].accessCount || 0;
                const countB = b[1].accessCount || 0;
                
                if (countA === countB) {
                  // Then by updated date (newest first)
                  const dateA = new Date(a[1].updated).getTime();
                  const dateB = new Date(b[1].updated).getTime();
                  return dateB - dateA;
                }
                
                return countB - countA;
              });
              
            if (categoryEntries.length > 0) {
              let result = `# Memory Contents in ${sanitizedPath || "root memory directory"}\n\n`;
              
              // Group by tags
              const tagGroups: Record<string, any[]> = {};
              
              // First collect entries for each tag
              for (const [path, entry] of categoryEntries) {
                for (const tag of entry.tags) {
                  if (!tagGroups[tag]) {
                    tagGroups[tag] = [];
                  }
                  tagGroups[tag].push({ path, entry });
                }
              }
              
              // Add files grouped by tags
              if (Object.keys(tagGroups).length > 0) {
                result += "## Files By Tag\n\n";
                
                for (const [tag, entries] of Object.entries(tagGroups)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 10)) { // Top 10 tags
                  result += `### ${tag} (${entries.length} files)\n`;
                  
                  for (const { path, entry } of entries.slice(0, 5)) { // Top 5 files per tag
                    result += `- **${entry.title}** (${path}) - ${entry.summary || "No summary"}\n`;
                  }
                  
                  if (entries.length > 5) {
                    result += `- ... and ${entries.length - 5} more files\n`;
                  }
                  
                  result += "\n";
                }
              }
              
              // Add recently updated files
              result += "## Recently Updated Files\n\n";
              
              const recentlyUpdated = [...categoryEntries]
                .sort((a, b) => {
                  const dateA = new Date(a[1].updated).getTime();
                  const dateB = new Date(b[1].updated).getTime();
                  return dateB - dateA;
                })
                .slice(0, 10); // Top 10 recently updated
              
              for (const [path, entry] of recentlyUpdated) {
                result += `- **${entry.title}** (${path}) - Updated ${new Date(entry.updated).toLocaleDateString()}\n`;
              }
              
              result += "\n## All Files in Directory\n\n";
              for (const [path, entry] of categoryEntries) {
                result += `- **${entry.title}** (${path})\n`;
              }
              
              result += "\n\nUse the readFileTool to read any of these files. Example:\n\n```\n{\n  \"filePath\": \"" + categoryEntries[0][0] + "\"\n}\n```";
              
              return result;
            }
          } catch (indexError) {
            log(`[Memory] No index found, falling back to filesystem: ${indexError}`, "system");
            // Fall back to filesystem if index doesn't exist or has issues
          }
          
          // Traditional filesystem-based approach as fallback
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
        
        // Record the memory file access in the index
        try {
          const indexer = getMemoryIndexer();
          await indexer.recordAccess(relativePath, projectPath);
        } catch (indexError) {
          log(`[Memory] Error recording file access: ${indexError}`, "system");
          // Continue even if indexing fails
        }
        
        return `Found memory file: ${relativePath}\n\nPlease use the readFileTool to read this file with:\n\n{
  "filePath": "${relativePath}"
}`;
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === "ENOENT") {
        if (!memoryPath || memoryPath === "") {
          try {
            const result = await initializeMemoryStructure(
              fullMemoryPath,
              resolvedProjectPath,
            );
            
            // Initialize index
            try {
              const indexer = getMemoryIndexer();
              await indexer.reindexAll(projectPath);
            } catch (indexError) {
              log(`[Memory] Error initializing index: ${indexError}`, "system");
              // Continue even if indexing fails
            }
            
            return result;
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
