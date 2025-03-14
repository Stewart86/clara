import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { log } from "../utils/logger.js";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { TokenTracker } from "../utils/index.js";

/**
 * The planner agent - for deep reasoning and complex problem solving
 * @param thought The prompt for the planner agent
 * @returns The generated insights
 */
export async function plannerAgent(
  description: string,
  additonalContext: string,
): Promise<string> {
  log(
    `[Planner] Description: ${description}, additonalContext: ${additonalContext}`,
    "system",
  );

  const systemPrompt = `You are Clara's Planner Agent, a powerful analytical engine for deep reasoning and complex problem solving. Your primary purpose is to provide thorough analysis and actionable insights on code and software engineering questions.

Key responsibilities:
1. Analyze code patterns, architecture decisions, and technical implementations
2. Identify potential bugs, performance issues, and security vulnerabilities
3. Suggest improvements and refactoring opportunities with concrete examples
4. Connect technical details to business implications and user experiences
5. Provide step-by-step reasoning for complex technical problems
6. Provide actionable recommendations for codebase maintainability and scalability

Guidelines:
- Be comprehensive but structured in your analysis
- Always provide specific, actionable recommendations
- Consider multiple perspectives and approaches
- Explain technical concepts in accessible language
- When discussing code, explain the "why" behind implementation choices
- Provide concrete examples whenever possible
- Always relate your insights back to Clara's core purpose of making codebases understandable

FORMAT YOUR RESPONSE:
1. Brief summary of your analysis (1-2 sentences)
2. Key insights or findings (bullet points)
3. Detailed explanation with examples (paragraphs)
4. Actionable recommendations (numbered list)
5. Business impact assessment (brief paragraph)
`;

  try {
    const model: OpenAIChatModelId = "o1";
    log(`[Planner] Generating response with ${model}`, "system");
    const response = await generateText({
      model: openai(model),
      providerOptions: {
        openai: { reasoningEffort: "high" },
      },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyse this "${description}". Here are some additional context: ${additonalContext}`,
        },
      ],
    });

    const { text } = response;

    // Track token usage
    const tokenTracker = TokenTracker.getInstance();
    if (response.usage) {
      tokenTracker.recordTokenUsage(
        "planner",
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
      );
    } else {
      // Fallback if usage stats aren't available
      const promptTokenEstimate = Math.ceil(
        (systemPrompt.length + description.length + additonalContext.length) /
          4,
      );
      const completionTokenEstimate = Math.ceil(text.length / 4);
      tokenTracker.recordTokenUsage(
        "planner",
        promptTokenEstimate,
        completionTokenEstimate,
      );
    }

    log(
      `[Planner] Response generated successfully (${text.length} chars)`,
      "system",
    );
    log(`[Planner] thinking...\n${text}`, "system");
    return text;
  } catch (error) {
    log(
      `[Planner Error] ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    return `Error in Planner Agent: ${error instanceof Error ? error.message : String(error)}`;
  }
}
