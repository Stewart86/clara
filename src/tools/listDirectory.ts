import { basename, join, relative, sep } from "path";
import { MAX_FILES } from "../../constants";
import { readdirSync } from "fs";
import { log } from "../utils";

export function listDirectory(
  initialPath: string,
  directory: string,
): string[] {
  log(`[ListDirectory] Listing files in ${directory}`, "system");
  const results: string[] = [];

  const queue = [initialPath];
  while (queue.length > 0) {
    if (results.length > MAX_FILES) {
      return results;
    }

    const path = queue.shift()!;
    if (skip(path)) {
      continue;
    }

    if (path !== initialPath) {
      results.push(relative(directory, path) + sep);
    }

    let children;
    try {
      children = readdirSync(path, { withFileTypes: true });
    } catch (e) {
      // eg. EPERM, EACCES, ENOENT, etc.
      const err = e as unknown as Error;
      log(err.message, "error");
      continue;
    }

    for (const child of children) {
      if (child.isDirectory()) {
        queue.push(join(path, child.name) + sep);
      } else {
        const fileName = join(path, child.name);
        if (skip(fileName)) {
          continue;
        }
        results.push(relative(directory, fileName));
        if (results.length > MAX_FILES) {
          return results;
        }
      }
    }
  }

  log(`[ListDirectory] Found: ${results}`, "system");
  return results;
}

function skip(path: string): boolean {
  if (path !== "." && basename(path).startsWith(".")) {
    return true;
  }
  if (path.includes(`__pycache__${sep}`)) {
    return true;
  }
  return false;
}
