import { log } from "../utils/logger";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { TokenTracker } from "../utils/tokenTracker";

const systemPrompt = `You are Clara's web search specialist, designed to find accurate and up-to-date information from the internet. 
When asked questions, you'll search the web for the most relevant and current information.

Follow these guidelines:
1. Include sources with your results to ensure verifiability
2. If the web search doesn't return relevant results, clearly state this limitation
3. Prioritize recent information when available
4. Organize information clearly and concisely
5. For technical questions, focus on authoritative sources
6. Maintain a professional but approachable tone
7. When providing code examples, ensure they're correct and well-explained
8. Verify information from multiple sources when possible

Always cite your sources when providing factual information.`;

/**
 * Web search agent powered by OpenAI Responses API
 * 
 * @param query - The search query
 * @returns The search results along with sources
 */
export async function webSearchAgent(query: string): Promise<string> {
  try {
    log(`[WebSearchAgent] Searching for: ${query}`, "system");
    
    const response = await generateText({
      model: openai.responses('gpt-4o'),
      prompt: query,
      tools: {
        web_search_preview: openai.tools.webSearchPreview({
          searchContextSize: 'high',
        })
      }
    });

    // Track token usage
    const tokenTracker = TokenTracker.getInstance();
    if (response.usage) {
      tokenTracker.recordTokenUsage(
        "websearch",
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
        "gpt-4o" // Using response API with gpt-4o
      );
    } else {
      // Fallback if usage stats aren't available
      const promptTokenEstimate = Math.ceil((systemPrompt.length + query.length) / 4);
      const completionTokenEstimate = Math.ceil(response.text.length / 4);
      tokenTracker.recordTokenUsage("websearch", promptTokenEstimate, completionTokenEstimate, "gpt-4o");
    }

    // Include sources in the response if available
    let result = response.text.trim();
    
    if (response.sources && response.sources.length > 0) {
      result += "\n\nSources:\n";
      response.sources.forEach((source, index) => {
        result += `[${index + 1}] ${source.title || 'Untitled'}: ${source.url}\n`;
      });
    }

    return result;
  } catch (error) {
    log(`[webSearchAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while searching the web: ${error}`;
  }
}