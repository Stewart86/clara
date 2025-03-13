import chalk from "chalk";
import { createInterface } from "readline/promises";
import path from "path";
import fs from "fs/promises";
import {
  type CoreMessage,
  streamText,
  experimental_createMCPClient as createMCPClient,
  type ToolSet,
} from "ai";
import { systemPrompt } from "../prompts/system-prompt.js";
import { getTools, setProjectIdentifier } from "../tools/index.js";
import { openai } from "@ai-sdk/openai";
import { getProjectContext, getMemoryFilesContext } from "../utils/codebase.js";
import { log, markdownToTerminal } from "../utils/index.js";
import { getSettings } from "../utils/settings.js";

export async function interactive(projectPath: string = process.cwd()) {
  console.log(
    chalk.bold.blue("Clara") +
    chalk.blue(" - Your AI Assistant for code clarity"),
  );
  console.log(chalk.gray('Type "exit" or press Ctrl+C to quit\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Share the readline interface via session state
  setProjectIdentifier(process.cwd());
  const sessionState = await import("../utils/sessionState.js").then((module) =>
    module.getSessionState(),
  );
  sessionState.setSharedReadline(rl);

  // Handle Ctrl+C gracefully
  process.on("SIGINT", async () => {
    console.log(chalk.blue("\nClara: ") + "Goodbye! Have a great day!");
    rl.close();
    
    // Close all MCP clients if they exist in the broader scope
    if (typeof mcpClients !== 'undefined' && mcpClients.length > 0) {
      log("Closing MCP clients...");
      await Promise.allSettled(mcpClients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          log(`Error closing MCP client: ${error}`, "error");
        }
      }));
      log("All MCP clients closed", "success");
    }
    
    process.exit(0);
  });

  try {
    let running = true;

    // Save original working directory
    const originalDir = process.cwd();
    const absoluteProjectPath = path.resolve(projectPath);

    // Verify the directory exists
    try {
      const stats = await fs.stat(absoluteProjectPath);
      if (!stats.isDirectory()) {
        console.error(
          chalk.red(`Error: ${absoluteProjectPath} is not a directory.`),
        );
        return;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          chalk.red(
            `Error: Cannot access directory ${absoluteProjectPath}: ${error.message}`,
          ),
        );
        return;
      }
      console.error(
        chalk.red(
          `Error: Cannot access directory ${absoluteProjectPath}: ${error}`,
        ),
      );
    }

    // Change to the specified project directory
    try {
      process.chdir(absoluteProjectPath);
      console.log(chalk.gray(`Working directory: ${process.cwd()}`));
      setProjectIdentifier(process.cwd());
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          chalk.red(
            `Error changing to directory ${absoluteProjectPath}: ${error.message}`,
          ),
        );
        return;
      }
      console.log(chalk.gray(`Staying in current directory: ${originalDir}`));
    }

    const settings = await getSettings();

    const mcpTools = [];
    const mcpClients = [];
    
    for (const [key, transport] of Object.entries(settings.mcpServers)) {
      log(`Creating MCP client for ${key}`);
      try {
        const mcpClient = await createMCPClient({
          transport,
        });
        mcpClients.push(mcpClient);
        
        const tool = await mcpClient.tools();
        mcpTools.push(tool);
        log(`MCP client created for ${key}`, "success");
      } catch (error) {
        log(`Failed to create MCP client for ${key}: ${error}`, "error");
      }
    }
    
    log(`${mcpTools.length} MCP tools created`, "success");

    const messages: CoreMessage[] = [
      { role: "system", content: systemPrompt },
      await getProjectContext(),
      await getMemoryFilesContext(),
    ];

    const tools = getTools();

    while (running) {
      try {
        const prompt = await rl.question(chalk.green("You: "));

        if (prompt.toLowerCase() === "exit") {
          console.log(chalk.blue("Clara: ") + "Goodbye! Have a great day!");
          running = false;
          break;
        }

        // Print "Thinking..." message
        const thinkingMessage = `${chalk.blue("Clara: ")}Thinking...`;
        process.stdout.write(thinkingMessage);

        // Clear space for tool usage messages (which will appear below)
        console.log();

        // Clear the "Thinking..." message before response starts
        setTimeout(() => {
          // Move cursor up one line and clear to the beginning of the line
          process.stdout.write("\x1B[1A\x1B[K");
          process.stdout.write(chalk.blue("Clara: "));
        }, 500);

        // Add user message to conversation history
        messages.push({ role: "user", content: prompt });

        // Process the prompt and get streaming response
        const stream = streamText({
          model: openai("o3-mini"),
          messages,
          providerOptions: {
            openai: { reasoningEffort: "low" },
          },
          tools: {
            ...tools,
            ...Object.fromEntries(mcpTools.flatMap(toolSet => 
              Object.entries(toolSet)
            )),
          },
          maxSteps: 50,
          maxTokens: 15000,
        });

        let fullText = "";

        process.stdout.write("\n");
        for await (const chunk of stream.textStream) {
          const formattedChunk = markdownToTerminal(chunk);
          process.stdout.write(formattedChunk);
          fullText += chunk; // Store the original text in the conversation history
        }

        messages.push({
          role: "assistant",
          content: fullText,
        });

        console.log("\n");
      } catch (error) {
        const inputError = error as unknown as {
          code: string;
          message: string;
        };
        if (inputError.code === "ERR_USE_AFTER_CLOSE") {
          running = false;
          break;
        }
        console.error(chalk.red("Input Error:"), inputError.message);
      }
    }
    process.chdir(originalDir);
  } catch (error) {
    console.error(chalk.red("Error:"), error);
  } finally {
    // Close the readline interface
    rl.close();
    
    // Close all MCP clients if they exist
    if (typeof mcpClients !== 'undefined' && mcpClients.length > 0) {
      log("Closing MCP clients...");
      await Promise.allSettled(mcpClients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          log(`Error closing MCP client: ${error}`, "error");
        }
      }));
      log("All MCP clients closed", "success");
    }
  }
}
