import type { CoreMessage } from "ai";
import { $ } from "bun";
import { readFile, readdir } from "fs/promises";
import path from "path";

/**
 * Gets context about Clara's memory files for the current project
 * @returns CoreMessage with memory files context
 */
export async function getMemoryFilesContext(): Promise<CoreMessage> {
  try {
    // Import required functions from memoryUtils
    const { resolveMemoryPaths, ensureMemoryDirectoryExists } = await import(
      "../tools/memoryUtils.js"
    );

    let context = "<env>\n# Clara's Memory Files\n\n";

    // Use the existing utility to get correct project memory paths
    const { projectMemoryDir, resolvedProjectPath } = resolveMemoryPaths();

    context += `Project: ${resolvedProjectPath}\n`;
    context += `Memory directory: ${projectMemoryDir}\n\n`;

    // Ensure memory directory exists
    await ensureMemoryDirectoryExists(projectMemoryDir);

    // Function to recursively get all files
    async function getAllFiles(
      dir: string,
      relativeTo: string,
    ): Promise<string[]> {
      const files: string[] = [];

      try {
        const items = await readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            // Recursively get files from subdirectories
            const subFiles = await getAllFiles(fullPath, relativeTo);
            files.push(...subFiles);
          } else {
            // Get path relative to the base memory directory
            const relativePath = path.relative(relativeTo, fullPath);
            files.push(relativePath);
          }
        }
      } catch (error) {
        // Directory might not exist yet
      }

      return files;
    }

    // Get all memory files
    const memoryFiles = await getAllFiles(projectMemoryDir, projectMemoryDir);

    if (memoryFiles.length === 0) {
      context +=
        "No memory files found yet. I'll create memory files as we discuss the project.\n";
    } else {
      context += `Found ${memoryFiles.length} memory files for this project:\n\n`;
      memoryFiles.forEach((file) => {
        context += `- ${file}\n`;
      });

      context += `Today's local datetime is ${new Date().toLocaleString()}\n`;

      context +=
        "\nI'll start my investigation using these memory files to understand the project better.\n" +
        "You can ask me to read any of these files to explore information stored in my memory.\n" +
        "I'll make sure to keep my memory up-to-date whenever I've discover any new insight that is not in my memory.\n";
    }

    context += "</env>";

    return {
      role: "system",
      content: context,
    };
  } catch (error) {
    return {
      role: "system",
      content: `Error accessing memory files: ${error}`,
    };
  }
}

/**
 * Get context about the current project
 * @returns String with project context
 */
export async function getProjectContext() {
  try {
    let context = "<env>\n# Project Context\n\n";

    // Get current directory
    const pwdResult = await $`pwd`.quiet();
    const pwd = pwdResult.text();
    context += `Current directory: ${pwd.trim()}\n\n`;

    // Check if this is a git repository
    try {
      const gitCheckResult =
        await $`git rev-parse --is-inside-work-tree`.quiet();
      if (gitCheckResult.exitCode === 0) {
        context += "This is a git repository.\n";

        // Get git remote info
        try {
          const remoteResult = await $`git remote -v`.quiet();
          const remoteInfo = remoteResult.text();
          context += `Git remotes:\n${remoteInfo}\n`;
        } catch (e) {
          context += "No git remotes found.\n";
        }

        // Get current branch
        try {
          const branchResult = await $`git branch --show-current`.quiet();
          const branchInfo = branchResult.text();
          context += `Current branch: ${branchInfo.trim()}\n`;
        } catch (e) {
          context += "Could not determine current branch.\n";
        }
      }
    } catch (e) {
      context += "This is not a git repository.\n";
    }

    // Try to get package.json for Node.js projects
    try {
      const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
      context += "\nProject Info:\n";
      context += `Name: ${packageJson.name || "unknown"}\n`;
      context += `Version: ${packageJson.version || "unknown"}\n`;
      context += `Description: ${packageJson.description || "No description"}\n`;

      if (packageJson.dependencies) {
        context += "\nDependencies:\n";
        Object.entries(packageJson.dependencies).forEach(([name, version]) => {
          context += `- ${name}: ${version}\n`;
        });
      }

      // Retrieve project related commands from package.json scripts if available
      if (packageJson.scripts) {
        context += "\nProject Scripts (Commands):\n";
        Object.entries(packageJson.scripts).forEach(([script, command]) => {
          context += `- ${script}: ${command}\n`;
        });
      }
    } catch (e) {
      // Not a Node.js project or package.json not found
    }

    // Try to get file structure (limiting depth to avoid overwhelming output)
    try {
      const findCommand = `find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*"`;
      const findResult = await $`${findCommand} | sort | head -50`.quiet();
      const findOutput = findResult.text();

      context += "\nProject Structure (limited to 50 files):\n";
      context += findOutput;
    } catch (e) {
      context += "Could not determine file structure.\n";
    }
    context += "</env>";

    const projectContext: CoreMessage = {
      role: "system",
      content: context,
    };
    return projectContext;
  } catch (error) {
    throw new Error(`Error getting project context: ${error}`);
  }
}
