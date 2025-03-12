import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { log } from "../utils/logger.js";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";

/**
 * The parser agent - for code understanding and parsing
 * @param code The code to parse
 * @returns Analysis of the code
 */
export async function parserAgent(code: string): Promise<string> {
  log(`[Parser] Processing code snippet (${code.length} chars)`, "system");

  const systemPrompt = `You are Clara's Parser Agent. You excel at reading and understanding code.
Your job is to analyze the provided code snippet and extract its key components, structure, and functionality.
Focus on accurately identifying:
1. The primary purpose and functionality of the code
2. Data structures and their relationships
3. Control flow and execution paths
4. API endpoints and interfaces
5. Important business logic or rules encoded in the code

Be thorough but concise. Avoid speculating beyond what's evident in the code.`;

  try {
    const model: OpenAIChatModelId = "o1-mini";
    log(`[Parser] Generating analysis with ${model}`, "system");
    const { text } = await generateText({
      model: openai(model),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: code },
      ],
    });

    log(
      `[Parser] Analysis generated successfully (${text.length} chars)`,
      "system",
    );
    return text;
  } catch (error) {
    log(
      `[Parser Error] ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    return `I had trouble analyzing this code snippet. Perhaps it's too complex or lengthy. Try sharing a smaller, more focused piece of code.`;
  }
}
