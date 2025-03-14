import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { log } from "../utils/logger.js";
import { TokenTracker } from "../utils/index.js";

/**
 * The meme agent - for generating programming-related memes
 * @param topic The topic for the meme
 * @returns A text-based meme description
 */
export async function memeAgent(topic: string): Promise<string> {
  log(`[Meme] Generating meme for topic: ${topic}`, "system");
  
  const systemPrompt = `You are Clara's Meme Agent. Your job is to create clever and humorous programming memes.
When given a programming concept, technology, or scenario, generate a brief textual description of a
meme that a developer would find funny. Be concise, clever, and relatable to the developer experience.
The meme should be:
- Developer-friendly (understanding programming concepts)
- Respectful (no offensive content)
- Brief (1-3 sentences maximum)
- Clearly describe an image and text combination that would work as a meme

Example output format:
"Image: [description of image]
Caption: [text that would go on the meme]"`;

  try {
    log(`[Meme] Generating with gpt-4o-mini model`, "system");
    const response = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a programming meme about: ${topic}` }
      ],
      temperature: 0.9, // Higher temperature for more creative outputs
      maxTokens: 300,
    });
    
    const { text } = response;
    
    // Track token usage
    const tokenTracker = TokenTracker.getInstance();
    if (response.usage) {
      tokenTracker.recordTokenUsage(
        "meme",
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0
      );
    } else {
      // Fallback if usage stats aren't available
      const promptTokenEstimate = Math.ceil((systemPrompt.length + topic.length + 40) / 4); // +40 for the "Create a programming meme about: " text
      const completionTokenEstimate = Math.ceil(text.length / 4);
      tokenTracker.recordTokenUsage("meme", promptTokenEstimate, completionTokenEstimate);
    }

    log(`[Meme] Generated successfully (${text.length} chars)`, "system");
    return text;
  } catch (error) {
    log(`[Meme Error] ${error instanceof Error ? error.message : String(error)}`, "error");
    return `Error in Meme Agent: ${error instanceof Error ? error.message : String(error)}`;
  }
}