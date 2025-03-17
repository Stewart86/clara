import { z } from "zod";
import { tool, type Tool, type ToolSet } from "ai";
import { readFile } from "./fileReader.js";
import { secureCommand } from "./command.js";
import {
  parserAgent,
  memeAgent,
  punAgent,
  assistantAgent as assistant,
  searchAgent as searchAssistant,
  webSearchAgent,
} from "../agents/index.js";
import { writeMemory, createDirectory } from "./memoryWriter.js";
import { readMemory } from "./memoryReader.js";
import { editFile, replaceFile } from "./fileWriter.js";
import {
  resetMemoryReadStatus,
  getMemoryReadStatus,
  setMemoryReadStatus,
  setProjectIdentifier,
  extractProjectIdentifier,
} from "./memoryUtils.js";
import { log } from "../utils/index.js";
import { commandPrompt } from "../prompts/command-prompt.js";
import { listDirectory } from "./listDirectory.js";

// Tool for writing to Clara's memory system (restricted to ~/.config/clara/ directory)
const writeMemoryTool: Tool = tool({
  description:
    "Creates or updates a memory file in Clara's knowledge system. Use this to store important information about the codebase that might be needed again later.",
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "Simple relative path to the memory file. For example: 'codebase/routes.md', 'insights/auth-flow.md', 'technical/authentication.md'. DO NOT use absolute paths or include ~/.config/clara/",
      ),
    content: z.string().describe("Content to write to the memory file"),
    projectPath: z
      .string()
      .describe("Optional project path if different from current project"),
  }),
  execute: async ({ filePath, content, projectPath }) => {
    return await writeMemory(filePath, content, projectPath || "");
  },
});

// Tool for creating directories in Clara's memory system
const mkdirTool: Tool = tool({
  description:
    "Creates a new directory in Clara's memory system. Use this to organize memory files into logical categories.",
  parameters: z.object({
    dirPath: z
      .string()
      .describe(
        "Simple relative path to the directory to create. For example: 'codebase/routes', 'insights/auth'. DO NOT use absolute paths or include ~/.config/clara/",
      ),
    projectPath: z
      .string()
      .describe("Optional project path if different from current project"),
  }),
  execute: async ({ dirPath, projectPath }) => {
    return await createDirectory(dirPath, projectPath || "");
  },
});

// Tool for retrieving available memory files from Clara's memory system
const readMemoryTool: Tool = tool({
  description:
    "Lists all memory files available in a specified directory of Clara's memory system. Returns paths that can be read with readFileTool. ALWAYS check memory first before performing codebase searches to see if relevant information is already stored.",
  parameters: z.object({
    memoryPath: z
      .string()
      .describe(
        "Simple relative path to memory directory. For example: 'codebase', 'insights', 'technical'. DO NOT use absolute paths or include ~/.config/clara/",
      ),
    projectPath: z
      .string()
      .describe("Optional project path if different from current project"),
  }),
  execute: async ({ memoryPath, projectPath }) => {
    return await readMemory(memoryPath || "", projectPath || "");
  },
});

// Tool for advanced file and content search within the codebase
const searchAgent: Tool = tool({
  description:
    "Performs powerful searches across the codebase using a specialized agent with access to advanced search commands (rg, fd). ALWAYS use this tool when searching for files, code patterns, or specific content within the project.",
  parameters: z.object({
    prompt: z
      .string()
      .describe(
        'Detailed description of what you need to find. Be specific about file types, patterns, or content. Examples: "Find all React components that use authentication", "Locate files handling cart promotions", "Search for functions that process payment data".',
      ),
  }),
  execute: async ({ prompt }) => {
    return await searchAssistant(prompt);
  },
});

// Tool for reading file contents
const readFileTool: Tool = tool({
  description:
    "Reads the contents of a specified file. For efficiency, read focused sections (20-40 lines) when possible rather than entire files. Always use searchAgent first to locate relevant files.",
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "Name or path of the file to read (can be partial or full path)",
      ),
    directory: z
      .string()
      .describe("Directory to search in, defaults to current directory"),
    lineRange: z
      .object({
        start: z.number().describe("Start line number (1-based indexing)"),
        end: z.number().describe("End line number (inclusive)"),
      })
      .describe(
        'Optional range of lines to read for large files, e.g. { "start": 10, "end": 30 }',
      ),
  }),
  execute: async ({ filePath, directory, lineRange }) => {
    return await readFile(filePath, directory || ".", lineRange ?? null);
  },
});

// Tool for safely executing shell commands
const commandTool: Tool = tool({
  description: commandPrompt,
  parameters: z.object({
    command: z
      .string()
      .describe(
        'Shell command to execute. Common examples: "ls", "grep", "find". All commands are validated for security before execution.',
      ),
  }),
  execute: async ({ command }) => {
    return await secureCommand(command);
  },
});

// Tool for deep thinking and complex problem solving - no file changes or information retrieval
const thinkTool: Tool = tool({
  description: `Provides a space for structured reasoning about complex problems without making any changes to files or retrieving new information. Use when you need to brainstorm or work through a problem methodically.

Common use cases:
1. Brainstorming multiple approaches to fix a bug and evaluating which would be most effective
2. Analyzing failing tests to determine potential solutions
3. Planning a complex refactoring by outlining different approaches and their tradeoffs
4. Designing a new feature's architecture and implementation strategy
5. Organizing thoughts and hypotheses when debugging complex issues

This tool simply logs your thought process for transparency and does not execute code or make changes.`,
  parameters: z.object({
    thought: z
      .string()
      .describe("Your structured thoughts and reasoning process"),
  }),
  execute: async ({ thought }) => {
    log(`Thinking...\n${thought}`, "system");
    return `thoughts noted.`;
  },
});

// Tool for code analysis and understanding
const parserTool: Tool = tool({
  description:
    "Analyzes code snippets to explain their structure, purpose, and functionality in clear terms. Ideal for quickly understanding unfamiliar code or complex implementations.",
  parameters: z.object({
    code: z.string().describe("The code snippet to analyze and explain"),
  }),
  execute: async ({ code }) => {
    return await parserAgent(code);
  },
});

// Tool for generating programming-related meme descriptions
const memeTool: Tool = tool({
  description:
    "Generates creative programming-related meme descriptions about a given technical topic. Use to add light humor to technical discussions or explanations.",
  parameters: z.object({
    topic: z
      .string()
      .describe("The programming topic, concept, or technology for the meme"),
  }),
  execute: async ({ topic }) => {
    return await memeAgent(topic);
  },
});

// Tool for generating programming-related puns from keywords
const punTool: Tool = tool({
  description:
    "Creates clever programming-related puns using the provided keywords. Perfect for lightening technical discussions or adding a touch of humor to explanations.",
  parameters: z.object({
    keywords: z
      .array(z.string())
      .describe(
        "Keywords to incorporate into the puns (provide 1-3 technical or programming terms)",
      ),
  }),
  execute: async ({ keywords }) => {
    return await punAgent(keywords);
  },
});

// Tool for delegating complex tasks to a specialized assistant agent
const assistantAgent: Tool = tool({
  description:
    "Delegates complex tasks to a powerful assistant agent (powered by OpenAI o1-mini) that has access to all Clara tools. Use for comprehensive searches, in-depth analyses, or multi-step tasks that require sophisticated reasoning.",
  parameters: z.object({
    prompt: z
      .string()
      .describe(
        "Detailed description of the task for the assistant agent to perform. Be specific about what you need analyzed or accomplished.",
      ),
  }),
  execute: async ({ prompt }) => {
    return await assistant(prompt);
  },
});

// Tool for retrieving up-to-date information from the web
const webSearchTool: Tool = tool({
  description:
    "Performs web searches to retrieve current information on any topic using the OpenAI Responses API. Returns accurate, up-to-date information with source citations, ideal for answering questions about recent developments or documentation.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "The specific search query to look up on the web. Be clear and precise for best results (e.g., 'Current React 18 lifecycle methods' rather than 'React methods').",
      ),
  }),
  execute: async ({ query }) => {
    return await webSearchAgent(query);
  },
});

// Tool for making targeted edits to files with user approval
const editFileTool: Tool = tool({
  description:
    "Makes precise edits to files by replacing specific text with new content. Requires explicit user approval before changes are applied. Works only on files in the current working directory or Clara's memory system. When replacing text, include sufficient context (3-5 lines before/after) to ensure uniqueness. If a change is rejected, revise based on user feedback rather than resubmitting the same edit.",
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "The path to the file to edit (can be relative to current directory)",
      ),
    oldString: z
      .string()
      .describe(
        "The exact string to replace. Must be unique within the file. For new files, use an empty string.",
      ),
    newString: z
      .string()
      .describe(
        "The new string to insert in place of the old string (or entire file content for new files)",
      ),
    reason: z
      .string()
      .describe("A clear explanation of why this change is needed"),
  }),
  execute: async ({ filePath, oldString, newString, reason }) => {
    return await editFile(filePath, oldString, newString, reason);
  },
});

// Tool for creating new files or completely replacing existing files with user approval
const replaceFileTool: Tool = tool({
  description:
    "Creates new files or completely replaces existing files with new content. Requires explicit user approval before changes are applied. Works only on files in the current working directory or Clara's memory system. Useful for major refactoring or creating new files from scratch. If changes are rejected, adjust based on user feedback rather than resubmitting identical content.",
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "The path to the file to create or replace (can be relative to current directory)",
      ),
    content: z.string().describe("The complete new content for the file"),
    reason: z
      .string()
      .describe("A clear explanation of why this change is needed"),
  }),
  execute: async ({ filePath, content, reason }) => {
    return await replaceFile(filePath, content, reason);
  },
});

// Get all available tools
export function getTools(): ToolSet {
  return {
    thinkTool,
    fileAndContentSearchAgent: searchAgent,
    webSearchAgent: webSearchTool,
    assistantAgent,
    commandTool,
    readFileTool,
    parserAgent: parserTool,
    writeMemoryTool,
    readMemoryTool,
    mkdirTool,
    editFileTool,
    replaceFileTool,
    memeAgent: memeTool,
    punAgent: punTool,
  };
}

export function getPlannerTools(): ToolSet {
  return {
    fileAndContentSearchAgent: searchAgent,
    webSearchAgent: webSearchTool,
    readFileTool,
    readMemoryTool,
  };
}

export {
  log,
  resetMemoryReadStatus,
  getMemoryReadStatus,
  setMemoryReadStatus,
  setProjectIdentifier,
  extractProjectIdentifier,
  listDirectory,
};
