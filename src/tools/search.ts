import chalk from "chalk";
import path from "path";
import fs from "fs/promises";
import { spawn } from "bun";
import { log } from "../utils/logger.js";

/**
 * Search for files in the project that match a pattern
 * @param pattern Pattern to search for
 * @param directory Directory to search in (defaults to current directory)
 * @returns Search results
 */
export async function searchFiles(
  pattern: string,
  directory: string = ".",
): Promise<string> {
  try {
    // Prevent searching outside the project directory
    if (
      directory === "/" ||
      directory === "~" ||
      directory === "/home" ||
      directory.startsWith("/usr") ||
      directory.startsWith("/etc")
    ) {
      return `Error: Searching system directories is not allowed for security and performance reasons. Please specify a project-related directory.`;
    }

    // Verify directory exists and is accessible
    try {
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        return `Error: ${directory} is not a directory.`;
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Error: Cannot access directory ${directory}: ${error.message}`;
      }
      return `Error: Cannot access directory ${directory}: ${error}`;
    }

    // Get absolute directory path
    const absDirectory = path.resolve(directory);
    log(`[Search] Current directory: ${process.cwd()}`, "system");
    log(`[Search] Looking for: ${pattern} in ${absDirectory}`, "system");

    let result = "";

    // Detect if pattern is likely a glob pattern
    const isGlob =
      pattern.includes("*") || pattern.includes("?") || pattern.includes("[");

    // If pattern looks like a glob, search for files matching that pattern
    if (isGlob) {
      try {
        const command = ["fd", "--glob", pattern, absDirectory];
        log(
          `[Search] Running filename glob search: ${command.join(" ")}`,
          "system",
        );
        // Use fd with --glob option for glob patterns
        const proc = spawn(command);
        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        log(
          `[Search] Command result: exit=${exitCode}, output=${stdout.trim().split("\n").length || "(no output)"}`,
          "system",
        );

        if (stdout && stdout.trim().length > 0) {
          result += `Files matching glob pattern '${pattern}':\n${stdout}\n\n`;
        } else {
          log(`[Search] No glob matches found`, "system");
        }
      } catch (error) {
        if (error instanceof Error) {
          log(`[Search] Error in glob search: ${error.message}`, "system");
          return `Error searching for "${pattern}": ${error.message}`;
        }
        log(`[Search] Error in glob search: ${error}`, "system");
      }
    } else {
      // Check if the pattern is too broad or generic before searching
      if (pattern.length < 3 || /^[a-z0-9]{1,2}$/i.test(pattern)) {
        log(`[Search] Pattern '${pattern}' is too generic`, "warning");
        return `Your search term '${pattern}' is too generic and may return too many results. Please use a more specific search pattern with at least 3 characters.`;
      }

      // Regular text search in file contents
      try {
        const command = ["rg", "-l", "-i", pattern, absDirectory];
        log(
          `[Search] Running content search with ripgrep: ${command.join(" ")}`,
          "system",
        );
        const proc = spawn(command);
        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        log(
          `[Search] Command result: exit=${exitCode}, output=${stdout.trim().split("\n").length || "(no output)"}`,
          "system",
        );

        if (stdout && stdout.trim().length > 0) {
          result += `Files containing '${pattern}':\n${stdout}\n\n`;
        } else {
          log(`[Search] No content matches found for '${pattern}'`, "system");
        }
      } catch (error) {
        log(`[Search] No content matches found or error occurred`, "system");
      }

      // Search for files with names containing the pattern
      try {
        const command = ["fd", "--fixed-strings", pattern, absDirectory];
        log(
          `[Search] Running filename search with fd: ${command.join(" ")}`,
          "system",
        );
        // For non-glob patterns, use --fixed-strings to disable regex
        const proc = spawn(command);
        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        log(
          `[Search] Command result: exit=${exitCode}, output=${stdout.trim().split("\n").length || "(no output)"}`,
          "system",
        );

        if (stdout && stdout.trim().length > 0) {
          result += `Files with names containing '${pattern}':\n${stdout}\n\n`;
        } else {
          log(`[Search] No filename matches found`, "system");
        }
      } catch (error) {
        log(`[Search] No filename matches found or error occurred`, "system");
      }
    }

    return result || `No files found matching "${pattern}".`;
  } catch (error) {
    if (error instanceof Error) {
      log(`[Search Error] ${error.message}`, "error");
      return `Error searching for "${pattern}": ${error.message}`;
    }
    log(`[Search Error] ${error}`, "error");
    return `Error searching for "${pattern}": ${error}`;
  }
}
