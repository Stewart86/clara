import { log } from "../utils/logger";
import { openai } from "@ai-sdk/openai";
import { getTools } from "../tools";
import { generateText } from "ai";
import { TokenTracker } from "../utils/tokenTracker";

/**
 * Assistant agent powered by OpenAI o1-mini
 *
 * @param prompt - The detailed prompt for the assistant agent
 * @returns The assistant's response
 */
export async function assistantAgent(prompt: string): Promise<string> {
  try {
    const systemPrompt = `You are an AI assistant integrated into Clara, designed to help with complex tasks.
When you are searching for a keyword or file and are not confident that you will find the right match on the first try, perform the search diligently.
For specific file paths, look for exact matches quickly.
For specific class definitions, search efficiently.

Provide comprehensive, accurate, and helpful responses to queries.
Your primary goal is to assist with complex code analysis and explanation tasks.`;

    const tools = getTools();

    const model = "o1-mini";

    log(`[Assistant] Generating response with ${model}`, "system");
    const response = await generateText({
      model: openai(model),
      tools,
      toolChoice: "auto",
      maxSteps: 50,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    // Track token usage - extract usage data from response if available
    const tokenTracker = TokenTracker.getInstance();
    if (response.usage) {
      tokenTracker.recordTokenUsage(
        "assistant",
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
        model
      );
    } else {
      // Fallback if usage stats aren't available
      // Estimate based on typical token counts (rough estimate)
      const promptTokenEstimate = Math.ceil((systemPrompt.length + prompt.length) / 4);
      const completionTokenEstimate = Math.ceil(response.text.length / 4);
      tokenTracker.recordTokenUsage("assistant", promptTokenEstimate, completionTokenEstimate, model);
    }

    return response.text;
  } catch (error) {
    log(`[assistantAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while processing your request: ${error}`;
  }
}
