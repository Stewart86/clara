import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { log } from "../utils/logger.js";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";

/**
 * The thinker agent - for deep reasoning and complex problem solving
 * @param thought The prompt for the thinker agent
 * @returns The generated insights
 */
export async function thinkerAgent(thought: string): Promise<string> {
  log(
    `[Thinker] Processing thought: ${thought.substring(0, 50)}${thought.length > 50 ? "..." : ""}`,
    "system",
  );

  const systemPrompt = `Use the tool to think about something. It will not obtain new information or make any changes to the repository, but just log the thought. Use it when complex reasoning or brainstorming is needed. 

Common use cases:
1. When exploring a repository and discovering the source of a bug, call this tool to brainstorm several unique ways of fixing the bug, and assess which change(s) are likely to be simplest and most effective
2. After receiving test results, use this tool to brainstorm ways to fix failing tests
3. When planning a complex refactoring, use this tool to outline different approaches and their tradeoffs
4. When designing a new feature, use this tool to think through architecture decisions and implementation details
5. When debugging a complex issue, use this tool to organize your thoughts and hypotheses

The tool simply logs your thought process for better transparency and does not execute any code or make changes.`;

  try {
    const model: OpenAIChatModelId = "o1";
    log(`[Thinker] Generating response with ${model}`, "system");
    const { text } = await generateText({
      model: openai(model),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: thought },
      ],
      maxTokens: 15000,
    });

    log(
      `[Thinker] Response generated successfully (${text.length} chars)`,
      "system",
    );
    return text;
  } catch (error) {
    log(
      `[Thinker Error] ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    return `Error in Thinker Agent: ${error instanceof Error ? error.message : String(error)}`;
  }
}
