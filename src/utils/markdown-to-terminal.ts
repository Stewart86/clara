import { highlight } from "cli-highlight";
import { execSync } from "child_process";

/**
 * Transforms markdown formatting to terminal ANSI escape codes
 * @param text Text with markdown formatting
 * @returns Text with terminal formatting
 */
export function markdownToTerminal(text: string): string {
  // Process code blocks with syntax highlighting
  text = processCodeBlocks(text);

  // Bold: Convert **text** or __text__ to terminal bold
  text = text.replace(/(\*\*|__)(.*?)\1/g, "\x1b[1m$2\x1b[0m");

  // Italic: Convert *text* or _text_ to terminal italic
  text = text.replace(/(\*|_)(.*?)\1/g, "\x1b[3m$2\x1b[0m");

  return text;
}

/**
 * Process markdown code blocks with syntax highlighting
 * @param text Text with markdown code blocks
 * @returns Text with highlighted code blocks
 */
function processCodeBlocks(text: string): string {
  // Match code blocks with optional language specification
  // Format: ```[language]\ncode\n```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;

  return text.replace(codeBlockRegex, (match, language, code) => {
    return highlightCode(code, language);
  });
}

/**
 * Check if bat command is available
 * @returns Command to use or null if not available
 */
function getBatCommand(): string | null {
  try {
    // Check if bat or batcat is installed
    return execSync("which bat || which batcat", { encoding: "utf8" }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Highlight code using bat if available
 * @param code Code to highlight
 * @param language Language identifier (optional)
 * @returns Highlighted code
 */
function tryBatHighlight(code: string, language: string): string | null {
  const batCmd = getBatCommand();
  if (!batCmd) return null;

  try {
    // Set language flag if provided
    const langFlag = language ? `-l ${language}` : "";

    // Create a temporary file to avoid shell escaping issues
    const tempFile = `/tmp/clara-code-${Date.now()}.${language || "txt"}`;
    execSync(`cat > ${tempFile}`, { input: code });

    // Use bat for syntax highlighting with plain style (no line numbers, etc)
    const result = execSync(
      `${batCmd} ${langFlag} --color=always --plain --decorations=never ${tempFile}`,
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );

    // Clean up temporary file
    execSync(`rm ${tempFile}`);

    return result;
  } catch (error) {
    // Clean up any temporary file if it exists
    try {
      const tempFile = `/tmp/clara-code-${Date.now()}.${language || "txt"}`;
      execSync(`rm -f ${tempFile}`);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Silently fall back to other methods
    return null;
  }
}

/**
 * Highlight code using either bat or cli-highlight
 * @param code Code to highlight
 * @param language Language identifier (optional)
 * @returns Highlighted code string
 */
function highlightCode(code: string, language: string): string {
  try {
    // Try bat first if available (it has better highlighting)
    const batResult = tryBatHighlight(code, language);
    if (batResult) {
      return batResult;
    }

    // Use cli-highlight as fallback
    const options = language ? { language } : { autoDetect: true };
    return highlight(code, options);
  } catch (error) {
    // Fallback to simple formatting if all highlighting attempts fail
    return "\x1b[36m" + code + "\x1b[0m";
  }
}
