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

  const systemPrompt = `You are Clara's Parser Agent, specialized in code interpretation and analysis. Your purpose is to break down complex code into clear, understandable components and explain them in accessible language.

Key responsibilities:
1. Analyze code structure, patterns, and architecture
2. Identify the primary functionality and purpose of code snippets
3. Extract key business logic and rules embedded in the code
4. Map data flows and relationships between components
5. Detect potential bugs, inefficiencies, or security vulnerabilities
6. Translate technical implementations into business impacts

FORMAT YOUR RESPONSE:
1. Quick Summary: 1-2 sentences explaining what this code does at a high level
2. Component Breakdown:
   - Purpose: What problem does this code solve?
   - Inputs/Outputs: What data goes in and comes out?
   - Key Functions: Main operations performed
   - Dependencies: External libraries or systems relied upon
3. Business Impact: How this code affects users or business operations
4. Technical Assessment: Code quality, performance considerations, potential issues

Guidelines:
- Use clear, non-technical language wherever possible
- Explain WHY design choices were made, not just WHAT they are
- Highlight any unusual or noteworthy patterns
- Connect technical implementation to business functionality
- Be precise about what the code actually does, not what it might or should do
- Organize your analysis in a structured, easy-to-follow format
`;

  try {
    const model: OpenAIChatModelId = "o1-mini";
    log(`[Parser] Generating analysis with ${model}`, "system");
    const { text } = await generateText({
      model: openai(model),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: code },
      ],
      maxTokens: 6000,
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
    return `I had trouble analyzing this code snippet. The code might be too complex or lengthy for a single analysis. Consider breaking it into smaller, focused sections.`;
  }
}
