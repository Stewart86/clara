import { log } from "../utils/logger";
import { openai } from "@ai-sdk/openai";
import { getTools } from "../tools";
import { generateText, type Tool } from "ai";
import { z } from "zod";
import { searchFiles } from "../tools/search";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";

/**
 * Search agent powered by OpenAI 4o-mini
 * Specialized in advanced file search using rg and fd commands
 *
 * @param prompt - The detailed search query prompt
 * @returns The search agent's response with found files
 */
export async function searchAgent(prompt: string): Promise<string> {
  try {
    const systemPrompt = `You are a commandline search specialist agent integrated into Clara, designed to find files and code efficiently.
You are an expert at using terminal search tools like ripgrep (rg) and fd. You should only return a comphensive list of files you have found.

Follow these best practices for file searching:
1. For content searches:
   - Use ripgrep with proper flags: rg -l -i "pattern" /path
   - Use word boundaries for multi-word searches: rg -l -i "\\bword1\\b.*\\bword2\\b" /path
   - Use pipe for alternative words: rg -l -i "(word1|word2|word3)" /path
   - Combine techniques: rg -l -i "\\b(login|auth)\\b.*\\b(token|session)\\b" /path
   - Use case-insensitive flags: -i
   - Filter by file type: -t js, -t ts, etc.
   - Include context when needed: -A/-B/-C for lines after/before/around matches

2. For filename searches:
   - Use fd with appropriate flags: fd -i "pattern" /path
   - For partial matches: fd -i "partial" /path
   - For specific extensions: fd -e ts -e js "pattern" /path
   - For folder-specific searches: fd "pattern" path/to/folder
   - Use pipe for multiple patterns: fd -e ts "(auth|login)" /path
   
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
   - When a search returns too many results, narrow with additional patterns
   - When no results are found, simplify the pattern
`;

    const tool: Tool = {
      description:
        "Search for files in the project using a specialized search agent that can use advanced rg and fd commands. Always use this tool for any file searches.",
      parameters: z.object({
        pattern: z
          .string()
          .describe(
            'the pattern to search for, excluding the command. For example: "src/**/*.ts"',
          ),
      }),
      execute: async ({ pattern }) => {
        return await searchFiles(pattern);
      },
    };

    const model: OpenAIChatModelId = "o3-mini";

    log(`[SearchAgent] Generating response with ${model}`, "system");
    const response = await generateText({
      model: openai(model),
      tools: {
        search: tool,
      },
      toolChoice: "auto",
      maxSteps: 20,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    return response.text;
  } catch (error) {
    log(`[searchAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while searching: ${error}`;
  }
}
