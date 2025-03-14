import path from "path";
import fs from "fs/promises";
import { $ } from "bun";
import { log } from "../utils/logger.js";

/**
 * Search for files in the project that match a pattern
 * @param pattern Pattern to search for
 * @param directory Directory to search in (defaults to current directory)
 * @returns Search results
 */
export async function searchFiles(
  pattern: string,
  tool: string,
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

    let searchResult = "";

    if (pattern.length < 3 || /^[a-z0-9]{1,2}$/i.test(pattern)) {
      log(`[Search] Pattern '${pattern}' is too generic`, "warning");
      return `Your search term '${pattern}' is too generic. Please use a more specific search pattern with at least 3 characters.`;
    }

    try {
      switch (tool) {
        case "rg":
          searchResult += await $`rg -n -i "${pattern}" ${absDirectory}`
            .throws(true)
            .text();
          break;
        case "fd":
          searchResult += await $`fd -i "${pattern}" ${absDirectory}`
            .throws(true)
            .text();
          break;
      }
    } catch (error) {
      log(`[Search] No content matches found or error occurred`, "system");
    }
    return (
      searchResult.trim() ||
      `No files found matching "${pattern}". Please try diffent words with the similar meaning or different tenses.`
    );
  } catch (error) {
    if (error instanceof Error) {
      log(`[Search Error] ${error.message}`, "error");
      return `Error searching for "${pattern}": ${error.message}`;
    }
    log(`[Search Error] ${error}`, "error");
    return `Error searching for "${pattern}": ${error}`;
  }
}
