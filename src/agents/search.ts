import { log } from "../utils/logger";
import { openai } from "@ai-sdk/openai";
import { generateText, type Tool, tool as aiTool } from "ai";
import { z } from "zod";
import { searchFiles } from "../tools/search";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { TokenTracker } from "../utils/index.js";
import { listDirectory } from "../tools/index.js";

const systemPrompt = `You are a commandline search specialist agent integrated into Clara, designed to find files and code efficiently. You are well versed in many different programming languages. You understand the folder and file structure of some of the most common programming framework, have a general idea on where to look for things. You are an expert at using terminal search tools like ripgrep (rg) and fd. You should only return a comphensive list of files you have found.

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

9. Response considerations:
   - Always include the full path of the file
   - Ensure the response is comprehensive and accurate

10. Tool use guidelines:
   - IMPORTANT: Always use the search tool when performing file or content searches
   - When using the search tool, provide the pattern parameter as a string without quotes
   - Specify the tool parameter as either "rg" for content searches or "fd" for filename searches
   - For listDirectoryTool, provide both initialPath and directory parameters
   - Chain multiple tool calls when needed to refine your search results
   - When search returns no results, try alternative patterns with the tool
   - Use tools iteratively to explore the codebase structure
`;

/**
 * Search agent powered by OpenAI 4o-mini
 * Specialized in advanced file search using rg and fd commands
 *
 * @param prompt - The detailed search query prompt
 * @returns The search agent's response with found files
 */
export async function searchAgent(prompt: string): Promise<string> {
  try {
    const search: Tool = aiTool({
      description:
        "Search for files in the project using a specialized search agent that can use advanced rg and fd commands. Always use this tool for any file searches.",
      parameters: z.object({
        pattern: z
          .string()
          .describe(
            'the pattern to search for, excluding the command. For example: "src/**/*.ts"',
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

    const model: OpenAIChatModelId = "gpt-4o-mini";
    log(`[SearchAgent] Generating response with ${model}`, "system");
    log(`[SearchAgent] Clara's Prompt: ${prompt}`, "system");
    const response = await generateText({
      model: openai(model),
      tools: {
        search,
        listDirectoryTool,
      },
      toolChoice: "auto",
      maxSteps: 20,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    // Track token usage
    const tokenTracker = TokenTracker.getInstance();
    if (response.usage) {
      tokenTracker.recordTokenUsage(
        "search",
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
      );
    } else {
      // Fallback if usage stats aren't available
      const promptTokenEstimate = Math.ceil(
        (systemPrompt.length + prompt.length) / 4,
      );
      const completionTokenEstimate = Math.ceil(response.text.length / 4);
      tokenTracker.recordTokenUsage(
        "search",
        promptTokenEstimate,
        completionTokenEstimate,
      );
    }

    const result = response.text.trim();
    return result;
  } catch (error) {
    log(`[searchAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while searching: ${error}`;
  }
}
