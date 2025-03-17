import { log } from "../utils/logger.js";
import { z } from "zod";
import { type Tool, tool as aiTool } from "ai";
import { searchFiles } from "../tools/search.js";
import { listDirectory } from "../tools/index.js";
import { BaseAgent, type AgentConfig } from "./base.js";

const getSearchAgentSystemPrompt =
  (): string => `You are a commandline search specialist agent integrated into Clara, designed to find files and code efficiently. You are well versed in many different programming languages. You understand the folder and file structure of some of the most common programming framework, have a general idea on where to look for things. You are an expert at using terminal search tools like ripgrep (rg) and fd. You should only return a comphensive list of files you have found.

**IMPORTANT**: DO NOT search with genetic patterns like "*" or "**" as it can be very slow and resource intensive.

Follow these best practices for file searching:
1. For content searches:
   - Use rg (ripgrep) compatible patterns: "pattern" excluding the command and flags
   - Use pipe for alternative words: "(word1|word2|word3)"
   - Combine techniques: "(login|auth).*(token|session)"

2. For filename searches:
    - Use fd for filename searches: fd "pattern" /path excluding the command and flags
   - For partial matches: "partial" /path
   - For folder-specific searches: fd "pattern" path/to/folder
   - Use pipe for multiple patterns: "(auth|login)" /path
   
3. For glob patterns:
   - Keep patterns simple: "*keyword*" is better than "**/*keyword*"
   - Use unanchored patterns when possible
   - Be specific with folders when you can: "src/**/*.ts"
   - Avoid excessive wildcards: "*component*" is better than "**/*component*.ts*"
   - For multiple possibilities: "{auth,login}*" or "*{user,profile}*"

4. Search strategy:
   - Start with specific searches and broaden gradually
   - Try alternative terms/synonyms in a single search using | operator
   - Use (term1|term2|term3) patterns for multiple terms
   - Split compound words: "savePromotion" → "(save|promotion)"
   - **IMPORTANT** When a search returns too many results, narrow with additional patterns
   - When no results are found, simplify the pattern, try different terms or synonyms or tenses

5. Keyword processing:
   - Always tokenize compound keywords: "fileReader" → "(file|reader)"
   - For plural forms, search both singular and plural: "files" → "(file|files)"
   - For different verb tenses, include alternatives: "reading" → "(read|reading|reads)"
   - Use word stems when possible: "configuration" → "(config|configuration)"
   - Handle common abbreviations: "auth" → "(auth|authentication|authorize)"
   - Include both British and American English spellings: "colour" → "(color|colour)", "organize" → "(organize|organise)"

6. File and folders to avoid:
   - Never search in system directories like /etc, /usr, /bin
   - Avoid searching in node_modules, .git, or other generated folders
   - Exclude build, dist, and other output directories
   - Skip searching in hidden folders like .vscode, .idea, etc.

7. Directory listing:
   - Use the listDirectory tool to quickly list contents of a directory.
   - The tool returns relative paths and appends a separator to directories.
   - It efficiently skips hidden directories and large file sets.

8. Do search in:
   - Search in files used specifically for AI memory / knowledge base
   - files / folders like CLAUDE.md, .cursorrules, or .github/copilot-instructions.md
   - folders like docs/ might contain useful information

9. End-to-End Code Understanding:
   - IMPORTANT: Always search for both implementations AND references when analyzing code features
   - Trace the full lifecycle of functions, classes, and methods from definition to usage
   - When finding class/function definitions, also search for where they're imported and used
   - When finding usages/references, also search for their implementations
   - Provide a complete picture by finding both where code is defined and where it's used
   - For methods, track both class implementation and external calls to those methods
   - For libraries/modules, find both the import statements and the actual usage in code
   - Look for test files that demonstrate how components are used in practice
   - Search for related configuration files that might affect how components operate
   - Connect database schema definitions with their query implementations
   - Link UI components with their state management and business logic

10. Response considerations:
   - Always include the full path of the file
   - Ensure the response is comprehensive and accurate
   - Organize results to show both implementations and references when relevant

11. Tool use guidelines:
   - IMPORTANT: Always use the search tool when performing file or content searches
   - When using the search tool, provide the pattern parameter as a string without quotes
   - Specify the tool parameter as either "rg" for content searches or "fd" for filename searches
   - For listDirectoryTool, provide both initialPath and directory parameters
   - Chain multiple tool calls when needed to refine your search results
   - When search returns no results, try alternative patterns with the tool
   - Use tools iteratively to explore the codebase structure
   
12. Context awareness:
   - Review the history of previously searched patterns from the context
   - Avoid repeating searches that have already been performed
   - Build upon previous search results to refine your approach
   - When searching iteratively, use information from previous searches to guide your strategy
   
13. File Context Management:
   - Keep track of files you've already read in the current conversation
   - Do not re-read files that haven't changed since last accessed
   - When you need to reference multiple files, use a single batch of concurrent tool calls
   - Only re-read a file if the user explicitly asks for it, if it's been modified, or if you need to verify changes
   - If using previously cached file content, mention this to maintain transparency
   - Focus on understanding code's usage patterns, not just its definition
`;

/**
 * Enhanced Search Agent that implements the context-aware agent framework
 * Specialized in finding files and content with incremental search strategies
 */
export class SearchAgent extends BaseAgent {
  constructor() {
    const searchTool: Tool = aiTool({
      description:
        "Search for files in the project using a specialized search agent that uses advanced rg and fd commands. Always use this tool for any file or content searches.",
      parameters: z.object({
        pattern: z
          .string()
          .describe(
            'the regex pattern to search for, excluding the command. For example: "src/**/*.ts"',
          ),
        tool: z.enum(["rg", "fd"]).describe("the search tool to use"),
      }),
      execute: async ({ pattern, tool }) => {
        return await searchFiles(pattern, tool);
      },
    });

    const listDirectoryTool: Tool = aiTool({
      description: "List all files in a directory",
      parameters: z.object({
        initialPath: z
          .string()
          .describe("The initial path to start the search"),
        directory: z.string().describe("The directory to search in"),
      }),
      execute: async ({ initialPath, directory }) => {
        return listDirectory(initialPath, directory);
      },
    });

    const config: AgentConfig = {
      name: "search",
      description: "File and Content Search Specialist Agent",
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: getSearchAgentSystemPrompt(),
      tools: {
        search: searchTool,
        listDirectoryTool,
      },
      maxSteps: 20,
    };

    super(config);
  }

  /**
   * Execute a search request with context tracking
   */
  public async search(query: string): Promise<string> {
    // Initialize search operation in context
    const context =
      this.contextManager.getContext() || this.contextManager.createContext();
    log(
      `[SearchAgent] Processing query: ${query} (context ID: ${context.requestId})`,
      "system",
    );

    // Check if we've already searched for this exact query
    if (context.filesSearched.includes(query)) {
      log(
        `[SearchAgent] This query has been searched before, retrieving from context`,
        "system",
      );
      const previousResult = this.contextManager.getResult(`search:${query}`);
      if (previousResult) {
        return previousResult;
      }
    }

    // Execute the search
    const result = await this.execute(query);

    // Create a concise version (max 3 paragraphs) if the result is too long
    const conciseResult = await this.createConciseResult(result, query);

    // Store result in context
    this.contextManager.recordFileSearch(query);
    this.contextManager.storeResult(`search:${query}`, conciseResult);

    return conciseResult;
  }

  /**
   * Create a concise version of a search result
   */
  private async createConciseResult(
    result: string,
    query: string,
  ): Promise<string> {
    // If the result is already short, return it as is
    if (result.length < 1000) {
      return result;
    }

    log(
      `[SearchAgent] Creating concise summary of search results (${result.length} chars)`,
      "system",
    );

    try {
      // Create a summarization prompt
      const summarizationPrompt = `
I need a concise summary (maximum 3 paragraphs) of these search results for the query: "${query}"

${result}

Focus only on the most important findings. The summary should be brief but informative.
`;

      // Execute the summarization using our own agent to save a round-trip
      const summarizedResult = await this.execute(summarizationPrompt);

      // Return the summarized result if it's shorter
      if (summarizedResult.length < result.length) {
        log(
          `[SearchAgent] Created concise summary (${summarizedResult.length} chars)`,
          "system",
        );
        return summarizedResult;
      } else {
        // If something went wrong and the summary is longer, return original with a note
        return (
          result.substring(0, 1000) + "\n\n[Results truncated for brevity...]"
        );
      }
    } catch (error) {
      // If summarization fails, truncate the result
      log(`[SearchAgent] Failed to create concise summary: ${error}`, "error");
      return (
        result.substring(0, 1000) + "\n\n[Results truncated for brevity...]"
      );
    }
  }

  /**
   * Perform an incremental search with progressive refinement
   */
  public async incrementalSearch(
    query: string,
    maxIterations: number = 3,
  ): Promise<string> {
    // Initialize search operation in context
    const context =
      this.contextManager.getContext() || this.contextManager.createContext();
    log(`[SearchAgent] Starting incremental search for: ${query}`, "system");

    // First attempt with original query
    let result = await this.search(query);

    // Check if we got results and need to refine
    if (result.includes("No files found") || result.includes("No results")) {
      log(
        `[SearchAgent] Initial search returned no results, trying broader patterns`,
        "system",
      );

      // Try broadening with a more generic prompt
      const broaderQuery = `I need to find files related to ${query}. Can you try a broader search approach with alternative terms and patterns?`;
      result = await this.search(broaderQuery);
    } else if (result.length > 10000) {
      log(
        `[SearchAgent] Initial search returned too many results, trying to narrow down`,
        "system",
      );

      // Try narrowing with a more specific prompt
      const narrowerQuery = `I found too many results for ${query}. Can you help me narrow down the search with more specific patterns?`;
      result = await this.search(narrowerQuery);
    }

    return result;
  }
}

/**
 * Factory function for creating search agent
 */
export function createSearchAgent(): SearchAgent {
  return new SearchAgent();
}

// Static factory method is defined separately as a class method
// instead of as a property of the class constructor to avoid TypeScript errors

/**
 * Legacy function for backward compatibility
 */
export async function searchAgent(prompt: string): Promise<string> {
  const agent = new SearchAgent();
  try {
    return await agent.search(prompt);
  } catch (error) {
    log(`[searchAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while searching: ${error}`;
  }
}
