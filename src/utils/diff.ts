import { diffLines } from "diff";
import { highlight } from "cli-highlight";
import path from "path";
import boxen from "boxen";
import chalk from "chalk";

/**
 * Generate a colorized diff between two strings with line numbers
 * @param oldContent Original content
 * @param newContent New content
 * @param filePath Path to the file (for syntax highlighting)
 * @returns Formatted, colorized diff
 */
export function generateDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  try {
    // Get line by line differences
    const differences = diffLines(oldContent, newContent);

    // Get file extension and determine language for syntax highlighting
    const extension = path.extname(filePath).replace(".", "");

    // Map common file extensions to languages for better syntax highlighting
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      rb: "ruby",
      java: "java",
      c: "c",
      cpp: "cpp",
      h: "cpp",
      hpp: "cpp",
      cs: "csharp",
      go: "go",
      rs: "rust",
      php: "php",
      html: "html",
      css: "css",
      scss: "scss",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
      sh: "bash",
      bash: "bash",
      zsh: "bash",
      sql: "sql",
      xml: "xml",
    };

    // Set language based on the extension or fall back to plaintext
    let language = "plaintext";
    if (extension && extension in languageMap) {
      language = languageMap[extension];
    }

    // Define the context size (number of lines to show before and after changes)
    const contextSize = 3;

    // Process the diff chunks to add context and truncate unchanged sections
    const processedChunks: {
      type: "added" | "removed" | "unchanged" | "truncated";
      value: string;
      oldStart?: number;
      newStart?: number;
    }[] = [];

    let oldLineNumber = 1;
    let newLineNumber = 1;
    let lastChunkWasChange = false;

    // First pass: Identify chunks and line numbers
    differences.forEach((part, index) => {
      const lines = part.value.split("\n");
      // Remove empty line that appears due to trailing newline
      if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }

      if (part.added || part.removed) {
        // Add the chunk
        processedChunks.push({
          type: part.added ? "added" : "removed",
          value: part.value,
          oldStart: part.removed ? oldLineNumber : undefined,
          newStart: part.added ? newLineNumber : undefined,
        });

        // Update line numbers
        if (part.removed) {
          oldLineNumber += lines.length;
        }
        if (part.added) {
          newLineNumber += lines.length;
        }

        lastChunkWasChange = true;
      } else {
        // This is an unchanged chunk
        // If the chunk is small enough, include it entirely for context
        if (lines.length <= contextSize * 2 + 2) {
          processedChunks.push({
            type: "unchanged",
            value: part.value,
            oldStart: oldLineNumber,
            newStart: newLineNumber,
          });

          oldLineNumber += lines.length;
          newLineNumber += lines.length;
        } else {
          // Large unchanged chunk - show only the context parts at the beginning and end
          // Check if we just had a change chunk (show beginning context)
          if (lastChunkWasChange) {
            const beginContext = lines.slice(0, contextSize).join("\n");

            processedChunks.push({
              type: "unchanged",
              value: beginContext + (beginContext ? "\n" : ""),
              oldStart: oldLineNumber,
              newStart: newLineNumber,
            });

            oldLineNumber += contextSize;
            newLineNumber += contextSize;

            // Add truncation indicator if this isn't the last chunk
            if (index < differences.length - 1) {
              const truncatedLines = lines.length - contextSize * 2;
              processedChunks.push({
                type: "truncated",
                value: `... ${truncatedLines} more unchanged lines ...`,
              });
            }
          }

          // Check if the next chunk is a change (show ending context)
          const nextChunk = differences[index + 1];
          if (nextChunk && (nextChunk.added || nextChunk.removed)) {
            // Calculate starting line numbers for the end context
            const endContextOldStart =
              oldLineNumber + (lines.length - contextSize);
            const endContextNewStart =
              newLineNumber + (lines.length - contextSize);

            const endContext = lines.slice(-contextSize).join("\n");

            if (index < differences.length - 1) {
              processedChunks.push({
                type: "unchanged",
                value: (endContext ? "\n" : "") + endContext,
                oldStart: endContextOldStart,
                newStart: endContextNewStart,
              });
            }

            // Update line counts to the end of this chunk
            oldLineNumber += lines.length;
            newLineNumber += lines.length;
          } else if (index === differences.length - 1) {
            // Last chunk - just show beginning context
            oldLineNumber += lines.length;
            newLineNumber += lines.length;
          } else {
            // Middle chunk with no changes on either side - just show the truncation
            oldLineNumber += lines.length;
            newLineNumber += lines.length;
          }
        }

        lastChunkWasChange = false;
      }
    });

    // Format the diff with consistent alignment
    // Using dynamic width based on terminal size
    const terminalWidth = process.stdout.columns || 100;

    // Define column widths for consistent layout
    const LINE_COL_WIDTH = 8; // Width of the line number column (fixed at 8 characters)
    // Use non-breaking space and a consistent separator character to avoid ligature issues
    const NBSP = "\u00A0";
    const SEPARATOR = "│"; // Vertical separator between columns

    // Calculate max code width accounting for all display elements:
    // - boxen margins (2*1=2)
    // - boxen padding (2*1=2)
    // - boxen borders (2*1=2)
    // - line number column (8)
    // - separator (1)
    // - space after separator (1)
    // Total space needed: 16 characters
    const MAX_CODE_WIDTH = Math.max(terminalWidth - 16, 70); // Min width of 70 chars

    // Create header with consistent column widths - exactly 8 characters for line column
    // Use a perfectly predictable header format with consistent use of NBSP
    // Format LINE with proper spacing to align with 8-character column
    const headerLine = `${NBSP.repeat(3)}LINE${NBSP}`;
    
    // Calculate the exact width for the code column horizontal rule
    // We need to ensure it doesn't extend beyond the available space
    const codeRuleWidth = MAX_CODE_WIDTH - 2; // Subtract for the separator margin
    
    // Use NBSP after the separator to ensure consistent spacing
    // Use a more predictable character for the horizontal separator
    // Use "┼" at the intersection for better alignment
    const HORIZ_LINE = "─";
    const CROSS = "┼";
    
    let formattedDiff =
      `\x1b[90m${headerLine}${SEPARATOR}${NBSP}CODE\x1b[0m\n` +
      `\x1b[90m${HORIZ_LINE.repeat(LINE_COL_WIDTH)}${CROSS}${HORIZ_LINE.repeat(codeRuleWidth)}\x1b[0m\n`;

    // Process each chunk
    processedChunks.forEach((chunk) => {
      if (chunk.type === "truncated") {
        // Special format for truncation indicator - exactly 8 characters before separator
        // Use non-breaking spaces for consistent display with exact same formatting as other lines
        const spacer = NBSP.repeat(8);
        formattedDiff += `\x1b[90m${spacer}${SEPARATOR}${NBSP}${chunk.value}\x1b[0m\n`;
      } else {
        const lines = chunk.value.split("\n");
        // Remove trailing empty line if it exists
        if (lines.length > 0 && lines[lines.length - 1] === "") {
          lines.pop();
        }

        let oldLine = chunk.oldStart || 0;
        let newLine = chunk.newStart || 0;

        // Process each line in the chunk
        lines.forEach((line) => {
          // Apply syntax highlighting
          let highlightedLine;
          try {
            highlightedLine = highlight(line, { language });
          } catch (e) {
            highlightedLine = line;
          }

          // Only truncate lines that exceed the calculated maximum width
          if (highlightedLine.length > MAX_CODE_WIDTH) {
            highlightedLine =
              highlightedLine.substring(0, MAX_CODE_WIDTH - 3) + "...";
          }

          // Format line based on type - ensure consistent width of exactly 8 characters for all line numbers
          const formatLineNumber = (
            num: number,
            prefix: string,
            color: string,
          ) => {
            // Get the line number as a string
            const numStr = num.toString();

            // For consistent alignment:
            // 1. Right-align the number with prefix
            // 2. Ensure exactly 8 character width total

            // Format: [spaces][prefix][number][space] = total 8 chars
            // Calculate spaces needed to right-align, accounting for prefix (1 char), number, and trailing space (1 char)
            // Use non-breaking space (\u00A0) to prevent ligature issues in terminals
            const NBSP = "\u00A0";

            const leftPadding = Math.max(0, 8 - 1 - numStr.length - 1);
            const leftPad = NBSP.repeat(leftPadding);

            // Construct line number part with consistent width
            // Use NBSP for trailing space and for the space after separator
            return `\x1b[${color}${leftPad}${prefix}${numStr}${NBSP}\x1b[90m${SEPARATOR}\x1b[0m${NBSP}`;
          };

          if (chunk.type === "added") {
            const formattedLine = formatLineNumber(newLine, "+", "32m");
            formattedDiff += `${formattedLine}${highlightedLine}\x1b[0m\n`;
            newLine++;
          } else if (chunk.type === "removed") {
            const formattedLine = formatLineNumber(oldLine, "-", "31m");
            formattedDiff += `${formattedLine}${highlightedLine}\x1b[0m\n`;
            oldLine++;
          } else {
            const formattedLine = formatLineNumber(oldLine, " ", "90m");
            formattedDiff += `${formattedLine}${highlightedLine}\x1b[0m\n`;
            oldLine++;
            newLine++;
          }
        });
      }
    });

    // Count total lines and changes for the title
    const totalLines = oldContent.split("\n").length;
    const changedLines = processedChunks.reduce((count, chunk) => {
      if (chunk.type === "added" || chunk.type === "removed") {
        return count + chunk.value.split("\n").length;
      }
      return count;
    }, 0);

    // Get a shorter path for the title by removing the CWD prefix
    const cwd = process.cwd();
    let displayPath = filePath;

    // Remove current working directory from the path if it's a prefix
    if (filePath.startsWith(cwd)) {
      displayPath = filePath.substring(cwd.length);
      // Remove leading slash if present
      if (displayPath.startsWith("/")) {
        displayPath = displayPath.substring(1);
      }
      // If the path is empty after removing CWD, use just the filename
      if (!displayPath) {
        displayPath = path.basename(filePath);
      }
    }

    const title = `Diff for: ${displayPath} (${changedLines} of ${totalLines} lines changed)`;

    // Clean up the boxen output to remove any unwanted formatting artifacts
    const cleanupBoxenOutput = (result: string) => {
      return result.split('\n')
        .filter((line) => {
          // Remove any lines with just dashes that appear in the box content
          // This fixes a formatting issue where an extra line of dashes can appear
          if (line.includes('│') && line.includes('\x1b[90m') && line.includes('───────')) {
            const match = line.match(/\x1b\[90m(─+)\x1b\[0m/);
            if (match && match[1] && match[1].length > 5 && !line.includes('┼')) {
              return false;
            }
          }
          return true;
        })
        .join('\n');
    };
      
    // Use boxen to create a nice box around the diff
    try {
      // Calculate optimal box width based on:
      // - LINE_COL_WIDTH (8)
      // - Separator and space after (2)
      // - The code width (codeRuleWidth)
      // Add small margins to ensure it fits within the terminal
      const boxWidth = Math.min(terminalWidth - 4, LINE_COL_WIDTH + 2 + codeRuleWidth);

      // Generate the boxen output
      const boxResult = boxen(formattedDiff, {
        title,
        titleAlignment: "center",
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "blue",
        width: boxWidth,
      });
      
      // Apply cleanup to remove any unwanted formatting artifacts
      return cleanupBoxenOutput(boxResult);
    } catch (error) {
      // Fallback in case boxen fails
      const borderTitle = `=== ${title} ===`;
      const border = "=".repeat(borderTitle.length);
      return `\n${border}\n${borderTitle}\n${border}\n\n${formattedDiff}\n${border}\n`;
    }
  } catch (error) {
    return `Error generating diff: ${error}`;
  }
}
