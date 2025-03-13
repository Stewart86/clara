import { z } from "zod";
import { tool, type Tool, type ToolSet } from "ai";
import { readFile } from "./fileReader.js";
import { secureCommand } from "./command.js";
import {
  parserAgent,
  memeAgent,
  punAgent,
  assistantAgent,
  searchAgent as searchAssistant,
} from "../agents/index.js";
import { writeMemory, createDirectory } from "./memoryWriter.js";
import { readMemory } from "./memoryReader.js";
import {
  resetMemoryReadStatus,
  getMemoryReadStatus,
  setMemoryReadStatus,
  setProjectIdentifier,
  extractProjectIdentifier,
} from "./memoryUtils.js";
import { log } from "../utils/index.js";

// Tool for writing files (restricted to ~/.config/clara/ directory)
const writeMemoryTool: Tool = tool({
  description:
    "Write content to a memory file. Creates or updates knowledge in Clara's memory system.",
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

// Tool for creating directories (restricted to ~/.config/clara/ directory)
const mkdirTool: Tool = tool({
  description: "Create a directory in Clara's memory system.",
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

// Tool for reading from Clara's memory system
const memoryTool: Tool = tool({
  description:
    "List memory files available in Clara's memory system. This tool will return a list of file paths that can then be read using the readFileTool.",
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

// Tool for specialized search using the search agent
const searchAgent: Tool = tool({
  description:
    "Search for files in the project using a specialized search agent that can use advanced rg and fd commands. Always use this tool for any keyword searches.",
  parameters: z.object({
    prompt: z
      .string()
      .describe(
        'Detailed description of what you are searching for. Be specific about file types, patterns, or content you need. For example: "Find all React components that use authentication", "Search for files handling cart promotions", etc.',
      ),
  }),
  execute: async ({ prompt }) => {
    return await searchAssistant(prompt);
  },
});

// Tool for reading files
const readFileTool: Tool = tool({
  description:
    "Read the contents of a file. To reduce token usage, avoid reading entire files or a large line range unless necessary. Read in chunk of 20 - 40 lines when possible. Use the search tool to find relevant files first.",
  parameters: z.object({
    filePath: z
      .string()
      .describe("Name or path of the file to read (can be partial)"),
    directory: z
      .string()
      .describe("Directory to search in, defaults to current directory"),
    lineRange: z
      .object({
        start: z.number().describe("Start line number"),
        end: z.number().describe("End line number"),
      })
      .describe(
        'Optional range of lines to read, e.g. { "start": 10, "end": 20 }',
      ),
  }),
  execute: async ({ filePath, directory, lineRange }) => {
    return await readFile(filePath, directory || ".", lineRange ?? null);
  },
});

// Tool for running shell commands
const commandTool: Tool = tool({
  description:
    "Run a shell command and return the output. Useful for listing directories, checking git history, etc. Potentially dangerous commands will require user approval.",
  parameters: z.object({
    command: z
      .string()
      .describe('Command to run, such as "ls", "cat", "find", etc.'),
  }),
  execute: async ({ command }) => {
    return await secureCommand(command);
  },
});

// Tool for analyzing code structure
const analyzeTool: Tool = tool({
  description:
    "Analyze the structure of code in a file or directory. Use after reading file contents to understand complex patterns.",
  parameters: z.object({
    target: z.string().describe("File or directory to analyze"),
    analysisType: z
      .enum(["dependencies", "business_logic", "data_flow", "api_surface"])
      .describe("Type of analysis to perform"),
  }),
  execute: async ({ target, analysisType }) => {
    // TODO: Implement code analysis
    return `Analysis of ${target} for ${analysisType} (not yet implemented)`;
  },
});

// Tool for deep thinking and complex problem solving
const thinkTool: Tool = tool({
  description: `Use the tool to think about something. It will not obtain new information or make any changes to the repository, but just log the thought. Use it when complex reasoning or brainstorming is needed. 

Common use cases:
1. When exploring a repository and discovering the source of a bug, call this tool to brainstorm several unique ways of fixing the bug, and assess which change(s) are likely to be simplest and most effective
2. After receiving test results, use this tool to brainstorm ways to fix failing tests
3. When planning a complex refactoring, use this tool to outline different approaches and their tradeoffs
4. When designing a new feature, use this tool to think through architecture decisions and implementation details
5. When debugging a complex issue, use this tool to organize your thoughts and hypotheses

The tool simply logs your thought process for better transparency and does not execute any code or make changes.`,
  parameters: z.object({
    thought: z.string().describe("Your thoughts."),
  }),
  execute: async ({ thought }) => {
    log(`Thinking...\n${thought}`, "system");
    return `thoughts noted.`;
  },
});

// Tool for code parsing and understanding
const parserTool: Tool = tool({
  description:
    "Analyze a code snippet to understand its structure, purpose, and functionality. Use for quick insights into unfamiliar code.",
  parameters: z.object({
    code: z.string().describe("The code snippet to analyze"),
  }),
  execute: async ({ code }) => {
    return await parserAgent(code);
  },
});

// Tool for generating programming memes
const memeTool: Tool = tool({
  description:
    "Use the Meme Agent to generate a programming-related meme description about a given topic. Use for light humor.",
  parameters: z.object({
    topic: z.string().describe("The programming topic or concept for the meme"),
  }),
  execute: async ({ topic }) => {
    return await memeAgent(topic);
  },
});

// Tool for generating programming puns
const punTool: Tool = tool({
  description:
    "Use the Pun Agent to generate programming-related puns using the provided keywords. Great for adding humor.",
  parameters: z.object({
    keywords: z
      .array(z.string())
      .describe("Keywords to use in the puns (provide 1-3 keywords)"),
  }),
  execute: async ({ keywords }) => {
    return await punAgent(keywords);
  },
});

// Tool for using the Assistant agent
const assistantTool: Tool = tool({
  description:
    "Use the Assistant Agent powered by OpenAI o1-mini to help with complex tasks. This agent has access to all Clara tools and can perform comprehensive searches and analyses.",
  parameters: z.object({
    prompt: z
      .string()
      .describe(
        "Detailed prompt describing the task for the assistant agent to perform",
      ),
  }),
  execute: async ({ prompt }) => {
    return await assistantAgent(prompt);
  },
});

// Get all available tools
export function getTools(): ToolSet {
  return {
    searchAgent,
    readFileTool,
    commandTool,
    // analyzeTool,
    thinkTool,
    parserTool,
    memeTool,
    punTool,
    writeMemoryTool,
    mkdirTool,
    memoryTool,
    assistantTool,
  };
}

export {
  log,
  resetMemoryReadStatus,
  getMemoryReadStatus,
  setMemoryReadStatus,
  setProjectIdentifier,
  extractProjectIdentifier,
};
