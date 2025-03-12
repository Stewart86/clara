import { log } from "./logger.js";
import { getProjectContext, getMemoryFilesContext } from "./codebase.js";

/**
 * Transforms markdown formatting to terminal ANSI escape codes
 * @param text Text with markdown formatting
 * @returns Text with terminal formatting
 */
export function markdownToTerminal(text: string): string {
  // Bold: Convert **text** or __text__ to terminal bold
  text = text.replace(/(\*\*|__)(.*?)\1/g, '\x1b[1m$2\x1b[0m');
  
  // Italic: Convert *text* or _text_ to terminal italic
  text = text.replace(/(\*|_)(.*?)\1/g, '\x1b[3m$2\x1b[0m');
  
  // Code: Convert `text` to a different color
  text = text.replace(/`([^`]+)`/g, '\x1b[36m$1\x1b[0m');
  
  return text;
}

export { log, getProjectContext, getMemoryFilesContext };
