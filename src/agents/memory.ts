import { z } from "zod";
import { tool as aiTool } from "ai";
import { log } from "../utils/logger.js";
import { BaseAgent, type AgentConfig } from "./base.js";
import { writeMemory, createDirectory } from "../tools/memoryWriter.js";
import { readMemory } from "../tools/memoryReader.js";
import { readFile } from "../tools/fileReader.js";
import { getMemoryIndexer } from "../tools/memoryIndex.js";
import { resolveMemoryPaths } from "../tools/memoryUtils.js";
import path from "path";

const getMemoryAgentSystemPrompt = (): string => `You are a specialized Memory Management Agent for Clara, responsible for organizing and managing Clara's knowledge base in an optimized way.

Your primary responsibilities are:
1. Categorizing information into the appropriate memory structure
2. Creating and maintaining a hierarchical organization of knowledge
3. Adding metadata to memory files for improved searchability
4. Consolidating related information to avoid fragmentation
5. Managing cross-references between related memory files
6. Utilizing the memory index system for efficient search and retrieval
7. Maintaining relationship networks between related memory files

## Memory Structure

Clara's memory is organized in a file-based system under ~/.config/clara/ with project-specific directories. The main categories are:

- codebase/: Information about the structure, architecture, and components of the codebase
- technical/: Technical details about languages, frameworks, libraries used
- business/: Business logic, workflows, processes, and requirements
- insights/: Higher-level observations, learnings, and strategic information
- users/: User-specific information, preferences, and history

## Memory File Format

Each memory file should include:
1. A YAML frontmatter section with metadata
2. The main content in Markdown format

Example format:
\`\`\`
---
title: Authentication Flow
created: 2023-04-20T14:53:00Z
updated: 2023-05-15T09:30:00Z
tags: [auth, security, jwt, oauth]
related: [technical/jwt.md, technical/oauth.md]
summary: Overview of the authentication process using JWT tokens and OAuth 2.0
importance: high
---

# Authentication Flow

The authentication system uses JWT tokens with OAuth 2.0...
\`\`\`

## Memory Management Tasks

When organizing memory, you should:
- Create appropriate directory structures
- Add detailed YAML frontmatter with tags, summary, and related files
- Use the importance field (low, medium, high) to indicate priority
- Consolidate similar information
- Split large topics into focused sub-topics
- Create index files for complex topics
- Add cross-references between related topics
- Use consistent naming conventions
- Maintain the memory index for efficient search

## Memory Index System

Clara uses an advanced memory indexing system that:
1. Automatically extracts keywords from memory file content
2. Tracks relationships between memory files
3. Records access patterns and usage statistics 
4. Provides relevance-based search results
5. Enables finding related information across the memory system

You can use these special indexing tools:
- searchMemoryTool: Search the memory index with natural language queries
- relationshipGraphTool: Generate a visual graph of memory relationships
- rebuildIndexTool: Rebuild the memory index if needed

## Important Guidelines

1. ALWAYS check existing memory before creating new files to avoid duplication
2. Use descriptive, consistent file naming: lowercase with hyphens (e.g., "authentication-flow.md")
3. Include relevant tags in the frontmatter for improved searchability
4. Add "related" links to connect associated information
5. Include a clear summary in the frontmatter (1-2 sentences)
6. Set an appropriate importance level in the frontmatter
7. Keep files focused on a single topic - split if they become too broad
8. Maintain backward compatibility with existing memory structures
9. Use proper Markdown formatting for content structure
10. Include creation and update timestamps in the frontmatter
11. Always save memory files with the .md extension
12. Create bidirectional relationships between related files
`;

/**
 * Schema for memory file metadata
 */
const MemoryMetadataSchema = z.object({
  title: z.string().describe("Clear, descriptive title of the memory file"),
  created: z.string().describe("Creation timestamp in ISO format"),
  updated: z.string().describe("Last update timestamp in ISO format"),
  tags: z.array(z.string()).describe("Relevant tags for searchability"),
  related: z.array(z.string()).describe("Related memory file paths"),
  summary: z.union([z.string(), z.null()]).describe("Brief summary of the content"),
  importance: z.union([z.enum(["low", "medium", "high"]), z.null()]).describe("Importance level of this information"),
  source: z.union([z.string(), z.null()]).describe("Source of the information"),
});

/**
 * Schema for memory organization operations
 */
const MemoryOrganizationSchema = z.object({
  directories: z.array(z.object({
    path: z.string().describe("Path to create within the memory system"),
    purpose: z.string().describe("Description of what this directory will contain"),
  })),
  files: z.array(z.object({
    path: z.string().describe("Path where the file should be stored"),
    metadata: MemoryMetadataSchema,
    content: z.string().describe("The markdown content of the memory file (without frontmatter)"),
  })),
  consolidations: z.array(z.object({
    sourcePaths: z.array(z.string()).describe("Paths of files to consolidate"),
    targetPath: z.string().describe("Path where the consolidated information should be stored"),
    reason: z.string().describe("Reason for consolidation"),
  })).describe("Consolidation operations for merging related information"),
});

/**
 * Enhanced Memory Management Agent that implements the context-aware agent framework
 * Specialized in organizing and managing Clara's knowledge system
 */
export class MemoryAgent extends BaseAgent {
  constructor() {
    const readMemoryTool = aiTool({
      description: "Lists all memory files available in a specified directory of Clara's memory system",
      parameters: z.object({
        memoryPath: z.string().describe("Simple relative path to memory directory. For example: 'codebase', 'insights', 'technical'"),
        projectPath: z.string().describe("Project path if different from current project"),
      }),
      execute: async ({ memoryPath, projectPath }) => {
        return await readMemory(memoryPath || "", projectPath || "");
      },
    });

    const writeMemoryTool = aiTool({
      description: "Creates or updates a memory file in Clara's knowledge system",
      parameters: z.object({
        filePath: z.string().describe("Simple relative path to the memory file. For example: 'codebase/routes.md'"),
        content: z.string().describe("Content to write to the memory file"),
        projectPath: z.string().describe("Project path if different from current project"),
      }),
      execute: async ({ filePath, content, projectPath }) => {
        return await writeMemory(filePath, content, projectPath || "");
      },
    });

    const createDirectoryTool = aiTool({
      description: "Creates a new directory in Clara's memory system",
      parameters: z.object({
        dirPath: z.string().describe("Simple relative path to the directory to create. For example: 'codebase/routes'"),
        projectPath: z.string().describe("Project path if different from current project"),
      }),
      execute: async ({ dirPath, projectPath }) => {
        return await createDirectory(dirPath, projectPath || "");
      },
    });
    
    const readFileTool = aiTool({
      description: "Reads the contents of a specified file",
      parameters: z.object({
        filePath: z.string().describe("Name or path of the file to read (can be partial or full path)"),
        directory: z.string().describe("Directory to search in (defaults to current directory if empty)"),
        lineRange: z.union([
          z.object({
            start: z.number().describe("Start line number"),
            end: z.number().describe("End line number"),
          }),
          z.null()
        ]).describe('Range of lines to read, e.g. { "start": 10, "end": 20 }'),
        readEntireFile: z.boolean().describe("Force reading the entire file, even if it's large"),
      }),
      execute: async ({ filePath, directory, lineRange, readEntireFile }) => {
        return await readFile(filePath, directory || ".", lineRange || undefined, readEntireFile || false);
      },
    });
    
    const searchMemoryTool = aiTool({
      description: "Searches Clara's memory system using the enhanced index",
      parameters: z.object({
        query: z.string().describe("Search query to find relevant memory files"),
        projectPath: z.string().describe("Project path if different from current project"),
      }),
      execute: async ({ query, projectPath }) => {
        const self = new MemoryAgent();
        return await self.findRelatedMemory(query, projectPath || "");
      },
    });
    
    const relationshipGraphTool = aiTool({
      description: "Generates a graph of relationships between memory files",
      parameters: z.object({
        projectPath: z.string().describe("Project path if different from current project"),
      }),
      execute: async ({ projectPath }) => {
        const self = new MemoryAgent();
        return await self.generateRelationshipGraph(projectPath || "");
      },
    });
    
    const rebuildIndexTool = aiTool({
      description: "Rebuilds the memory index for improved search",
      parameters: z.object({
        projectPath: z.string().describe("Project path if different from current project"),
      }),
      execute: async ({ projectPath }) => {
        const self = new MemoryAgent();
        return await self.rebuildIndex(projectPath || "");
      },
    });

    const config: AgentConfig = {
      name: 'memory',
      description: 'Memory Management and Organization Agent',
      provider: 'openai',
      model: 'o3-mini',
      systemPrompt: getMemoryAgentSystemPrompt(),
      tools: {
        readMemoryTool,
        writeMemoryTool,
        createDirectoryTool,
        readFileTool,
        searchMemoryTool,
        relationshipGraphTool,
        rebuildIndexTool,
      },
      maxSteps: 20,
      reasoningEffort: 'medium',
    };

    super(config);
  }

  /**
   * Organize a new piece of information into the memory system
   */
  public async organizeInformation(content: string, category: string, sourcePath?: string): Promise<string> {
    // Initialize operation in context
    const context = this.contextManager.getContext() || this.contextManager.createContext();
    
    log(`[MemoryAgent] Organizing information in category: ${category}`, "system");
    
    let prompt = `I need to organize the following information into Clara's memory system under the '${category}' category.

Information to store:
---
${content}
---

${sourcePath ? `This information was extracted from: ${sourcePath}` : ''}

Please:
1. Analyze the content to understand its topic and importance
2. Determine the appropriate location(s) for storing this information
3. Create any necessary directories
4. Generate appropriate metadata (frontmatter) with tags, related files, etc.
5. Format the content appropriately in Markdown
6. Store the information in the memory system

Return a detailed plan of your organization strategy in JSON format according to the schema.`;

    try {
      // Generate the organization strategy
      const organization = await this.executeWithSchema(
        prompt,
        MemoryOrganizationSchema
      );

      // Execute the organization plan
      let results: string[] = [];

      // Create directories
      for (const dir of organization.directories) {
        log(`[MemoryAgent] Creating directory: ${dir.path}`, "system");
        const result = await createDirectory(dir.path, "");
        results.push(`Directory ${dir.path}: ${result}`);
        this.contextManager.recordMemoryCreation(dir.path);
      }

      // Create or update files
      for (const file of organization.files) {
        // Create the frontmatter
        const frontmatter = this.generateFrontmatter(file.metadata);
        
        // Combine frontmatter and content
        const fullContent = `${frontmatter}\n\n${file.content}`;
        
        log(`[MemoryAgent] Writing file: ${file.path}`, "system");
        const result = await writeMemory(file.path, fullContent, "");
        results.push(`File ${file.path}: ${result}`);
        this.contextManager.recordMemoryCreation(file.path);
      }

      // Report results
      const summary = `Successfully organized information into memory:
- Created ${organization.directories.length} directories
- Created/updated ${organization.files.length} files
- Files: ${organization.files.map(f => f.path).join(", ")}`;
      
      log(`[MemoryAgent] ${summary}`, "system");
      return summary;
    } catch (error) {
      log(
        `[MemoryAgent Error] ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
      return `Error organizing information: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Generate YAML frontmatter from metadata
   */
  private generateFrontmatter(metadata: any): string {
    let frontmatter = "---\n";
    
    // Add required fields
    frontmatter += `title: ${metadata.title}\n`;
    frontmatter += `created: ${metadata.created}\n`;
    frontmatter += `updated: ${metadata.updated}\n`;
    
    // Add tags
    frontmatter += `tags: [${metadata.tags.join(", ")}]\n`;
    
    // Add optional fields if present
    if (metadata.related && metadata.related.length > 0) {
      frontmatter += `related: [${metadata.related.join(", ")}]\n`;
    }
    
    if (metadata.summary) {
      frontmatter += `summary: ${metadata.summary}\n`;
    }
    
    if (metadata.importance) {
      frontmatter += `importance: ${metadata.importance}\n`;
    }
    
    if (metadata.source) {
      frontmatter += `source: ${metadata.source}\n`;
    }
    
    frontmatter += "---";
    
    return frontmatter;
  }
  
  /**
   * Search for specific information across the memory system
   */
  public async findRelatedMemory(query: string, projectPath: string = ""): Promise<string> {
    log(`[MemoryAgent] Searching for related memory: ${query}`, "system");
    
    try {
      // First try to use the memory indexer
      const indexer = getMemoryIndexer();
      const searchResults = await indexer.search(query, projectPath);
      
      if (searchResults.length > 0) {
        // Format the results
        let response = `# Memory Search Results for "${query}"\n\n`;
        
        // Group by relevance
        const highRelevance = searchResults.filter(r => r.score >= 10);
        const mediumRelevance = searchResults.filter(r => r.score >= 5 && r.score < 10);
        const lowRelevance = searchResults.filter(r => r.score > 0 && r.score < 5);
        
        // Display high relevance results
        if (highRelevance.length > 0) {
          response += `## Highly Relevant Results\n\n`;
          for (const result of highRelevance) {
            response += `### ${result.entry.title}\n`;
            response += `- **Path:** ${result.entry.path}\n`;
            if (result.entry.summary) {
              response += `- **Summary:** ${result.entry.summary}\n`;
            }
            response += `- **Tags:** ${result.entry.tags.join(', ')}\n`;
            response += `- **Created:** ${new Date(result.entry.created).toLocaleDateString()}\n`;
            response += `- **Updated:** ${new Date(result.entry.updated).toLocaleDateString()}\n\n`;
          }
        }
        
        // Display medium relevance results
        if (mediumRelevance.length > 0) {
          response += `## Related Results\n\n`;
          for (const result of mediumRelevance) {
            response += `- **${result.entry.title}** (${result.entry.path}) - ${result.entry.summary || 'No summary'}\n`;
          }
          response += '\n';
        }
        
        // Mention low relevance results
        if (lowRelevance.length > 0) {
          response += `## Additional Results\n\n`;
          response += `- ${lowRelevance.map(r => r.entry.path).join('\n- ')}\n\n`;
        }
        
        // Show related files
        if (highRelevance.length > 0) {
          try {
            const relatedResults = await indexer.getRelated(highRelevance[0].entry.path, projectPath);
            
            if (relatedResults.length > 0) {
              response += `## Related Information\n\nThese files might also be relevant to your query:\n\n`;
              
              for (const related of relatedResults.slice(0, 5)) {
                response += `- **${related.entry.title}** (${related.entry.path}) - ${related.entry.summary || 'No summary'}\n`;
              }
              response += '\n';
            }
          } catch (error) {
            log(`[MemoryAgent] Error getting related files: ${error}`, "error");
          }
        }
        
        // Add instructions
        response += `To view any of these files, use the readFileTool. Example:\n\n\`\`\`\n{\n  "filePath": "${searchResults[0].entry.path}"\n}\n\`\`\``;
        
        return response;
      }
    } catch (error) {
      log(`[MemoryAgent] Error using index search, falling back to traditional search: ${error}`, "error");
    }
    
    // Fall back to traditional search if indexing fails or returns no results
    const prompt = `Find information in Clara's memory system related to: "${query}"
    
Please:
1. Determine the most likely categories where this information might be stored
2. Search through those categories thoroughly
3. Find the most relevant files that match the query
4. Return the content of those files with their paths
5. Provide a summary of what you found

Be thorough in your search, checking multiple categories if needed.`;

    return await this.execute(prompt);
  }
  
  /**
   * Generate a relationship graph of memory files
   */
  public async generateRelationshipGraph(projectPath: string = ""): Promise<string> {
    log(`[MemoryAgent] Generating relationship graph`, "system");
    
    try {
      const indexer = getMemoryIndexer();
      return await indexer.generateRelationshipGraph(projectPath);
    } catch (error) {
      log(`[MemoryAgent] Error generating relationship graph: ${error}`, "error");
      return `Error generating relationship graph: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Rebuild the memory index
   */
  public async rebuildIndex(projectPath: string = ""): Promise<string> {
    log(`[MemoryAgent] Rebuilding memory index`, "system");
    
    try {
      const indexer = getMemoryIndexer();
      return await indexer.reindexAll(projectPath);
    } catch (error) {
      log(`[MemoryAgent] Error rebuilding index: ${error}`, "error");
      return `Error rebuilding memory index: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Factory function for creating memory agent
   */
  public static create(): MemoryAgent {
    return new MemoryAgent();
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function memoryAgent(prompt: string): Promise<string> {
  const agent = new MemoryAgent();
  try {
    return await agent.execute(prompt);
  } catch (error) {
    log(`[memoryAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while managing memory: ${error}`;
  }
}