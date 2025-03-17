import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { log } from "../utils/logger.js";
import { TokenTracker } from "../utils/index.js";

/**
 * The pun agent - for generating programming-related puns
 * @param keywords Array of keywords to use in puns
 * @returns Array of generated puns
 */
export async function punAgent(keywords: string[]): Promise<string[]> {
  log(`[Pun] Generating puns for keywords: ${keywords.join(', ')}`, "system");
  
  const systemPrompt = `You are Clara's Pun Agent. Your job is to create clever programming-related puns.
When given keywords, generate 3-5 short, clever puns or jokes that incorporate these keywords and relate to programming concepts.
The puns should be:
- Brief (one-liner style)
- Developer-friendly
- Groan-worthy (in a good way!)
- Clean and professional

Example output format:
["Pun 1", "Pun 2", "Pun 3"]`;

  try {
    log(`[Pun] Generating with gpt-4o-mini model`, "system");
    const response = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create programming puns using these keywords: ${keywords.join(', ')}` }
      ],
      temperature: 0.9, // Higher temperature for more creative outputs
      maxTokens: 500,
    });
    
    const { text } = response;
    
    // Track token usage
    const tokenTracker = TokenTracker.getInstance();
    if (response.usage) {
      tokenTracker.recordTokenUsage(
        "pun",
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
        "gpt-4o-mini"
      );
    } else {
      // Fallback if usage stats aren't available
      const userPrompt = `Create programming puns using these keywords: ${keywords.join(', ')}`;
      const promptTokenEstimate = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
      const completionTokenEstimate = Math.ceil(text.length / 4);
      tokenTracker.recordTokenUsage("pun", promptTokenEstimate, completionTokenEstimate, "gpt-4o-mini");
    }

    log(`[Pun] Generated successfully (${text.length} chars)`, "system");

    // Parse the text to extract puns as array
    try {
      const parsedPuns = JSON.parse(text);
      log(`[Pun] Successfully parsed ${parsedPuns.length} puns as JSON array`, "system");
      return parsedPuns;
    } catch (e) {
      // If can't parse as JSON, split by newlines and clean up
      log(`[Pun] Couldn't parse as JSON, falling back to text parsing`, "system");
      const textPuns = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('*') && !line.startsWith('-'))
        .map(line => line.replace(/^\d+\.\s*/, '')); // Remove numbering if present
      
      log(`[Pun] Extracted ${textPuns.length} puns via text parsing`, "system");
      return textPuns;
    }
  } catch (error) {
    log(`[Pun Error] ${error instanceof Error ? error.message : String(error)}`, "error");
    return [`Error in Pun Agent: ${error instanceof Error ? error.message : String(error)}`];
  }
}