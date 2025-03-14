import chalk from "chalk";
import { createInterface } from "readline/promises";
import path from "path";
import fs from "fs/promises";
import {
  type CoreMessage,
  streamText,
  experimental_createMCPClient as createMCPClient,
  generateText,
} from "ai";
import { systemPrompt } from "../prompts/system-prompt.js";
import { getTools, setProjectIdentifier } from "../tools/index.js";
import { openai } from "@ai-sdk/openai";
import { getProjectContext, getMemoryFilesContext } from "../utils/codebase.js";
import { log, markdownToTerminal, TokenTracker } from "../utils/index.js";
import { getSettings } from "../utils/settings.js";
import boxen, { type Options } from "boxen";

/**
 * Display token usage summary from TokenTracker
 */
function displayTokenUsageSummary() {
  const tokenTracker = TokenTracker.getInstance();
  const totalUsage = tokenTracker.getTotalTokenUsage();
  const agentUsage = tokenTracker.getTokenUsageByAgent();

  console.log(chalk.yellow("\n📊 Token Usage Summary:"));
  console.log(chalk.yellow("───────────────────────"));

  // Display usage by agent
  Object.entries(agentUsage).forEach(([agent, usage]) => {
    console.log(chalk.cyan(`${agent}:`));
    console.log(`  Prompt: ${usage.promptTokens.toLocaleString()} tokens`);
    console.log(
      `  Completion: ${usage.completionTokens.toLocaleString()} tokens`,
    );
    console.log(`  Total: ${usage.totalTokens.toLocaleString()} tokens`);
  });

  // Display total usage
  console.log(chalk.yellow("\nTotal Usage:"));
  console.log(`  Prompt: ${totalUsage.promptTokens.toLocaleString()} tokens`);
  console.log(
    `  Completion: ${totalUsage.completionTokens.toLocaleString()} tokens`,
  );
  console.log(
    chalk.green(`  Total: ${totalUsage.totalTokens.toLocaleString()} tokens`),
  );
  console.log();
}

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

  // Define mcpClients at the outer scope so it's accessible in the finally block
  let mcpClients: any[] = [];
  const terminalWidth = process.stdout.columns || 80;

  // Handle Ctrl+C gracefully
  process.on("SIGINT", async () => {
    console.log(chalk.blue("\nClara: ") + "Goodbye! Have a great day!");

    // Display token usage summary
    displayTokenUsageSummary();

    rl.close();

    // Close all MCP clients if they exist
    if (mcpClients.length > 0) {
      log("Closing MCP clients...");
      await Promise.allSettled(
        mcpClients.map(async (client) => {
          try {
            await client.close();
          } catch (error) {
            log(`Error closing MCP client: ${error}`, "error");
          }
        }),
      );
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
        console.log(
          chalk.gray("Tip: Enter a blank line to finish multiline input"),
        );

        // Custom multiline input handler for getting input
        let lines: string[] = [];
        let firstLine = await rl.question(chalk.green(" > "));

        // Set up prompt variable that will be used throughout the rest of the loop
        let prompt = "";

        // Check for exit command on the first line
        if (firstLine.toLowerCase() === "exit") {
          prompt = "exit";
        } else {
          // Start collecting lines
          lines.push(firstLine);

          // Keep collecting lines until an empty line is entered
          let nextLine = "";
          while (true) {
            nextLine = await rl.question(chalk.green("... "));
            // Empty line signals end of input
            if (nextLine.trim() === "") break;
            lines.push(nextLine);
          }

          prompt = lines.join("\n");
        }

        // Skip displaying empty prompts
        if (prompt.trim()) {
          // Display the user message in a box on the right
          const terminalWidth = process.stdout.columns || 80;
          const boxWidth = Math.min(Math.floor(terminalWidth * 0.7), 80);

          const userBoxOptions: Options = {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 10, right: 1 },
            borderStyle: "round",
            borderColor: "green",
            title: chalk.green("You"),
            width: boxWidth,
            float: "right",
            titleAlignment: "right",
            textAlignment: "left",
          };

          // Just display the boxed message without trying to clear the line
          process.stdout.moveCursor(0, -1);
          process.stdout.clearLine(1);
          console.log(boxen(prompt, userBoxOptions));
        }

        if (prompt.toLowerCase() === "exit") {
          const boxWidth = Math.min(Math.floor(terminalWidth * 0.7), 80);

          const goodbyeBoxOptions: Options = {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 1, right: 10 },
            borderStyle: "round",
            borderColor: "blue",
            title: chalk.blue("Clara"),
            width: boxWidth,
            float: "left",
          };

          console.log(
            boxen("Goodbye! Have a great day! 👋", goodbyeBoxOptions),
          );
          console.log(); // Add extra space

          // Display token usage summary
          displayTokenUsageSummary();

          running = false;
          break;
        }

        // Add user message to conversation history
        messages.push({ role: "user", content: prompt });

        process.stdout.write("thinking...");

        // Process the prompt and get streaming response
        const response = await generateText({
          model: openai.responses("o3-mini"),
          messages,
          providerOptions: {
            openai: { reasoningEffort: "medium" },
          },
          tools: {
            ...tools,
            ...Object.fromEntries(
              mcpTools.flatMap((toolSet) => Object.entries(toolSet)),
            ),
          },
          maxSteps: 100,
        });

        const { text } = response;

        // Track token usage for the main conversation
        const tokenTracker = TokenTracker.getInstance();
        if (response.usage) {
          tokenTracker.recordTokenUsage(
            "main",
            response.usage.promptTokens || 0,
            response.usage.completionTokens || 0,
          );
        } else {
          // Fallback estimation if usage stats aren't available
          const promptTokenEstimate = Math.ceil(
            messages.reduce(
              (total, msg) => total + (msg.content?.length || 0),
              0,
            ) / 4,
          );
          const completionTokenEstimate = Math.ceil(text.length / 4);
          tokenTracker.recordTokenUsage(
            "main",
            promptTokenEstimate,
            completionTokenEstimate,
          );
        }

        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);

        // Format the text with markdown conversion
        const formattedText = markdownToTerminal(text);

        // Display the response in a box on the left
        // Reuse the same terminalWidth variable
        const boxWidth = Math.min(Math.floor(terminalWidth * 0.7), 80);

        const claraBoxOptions: Options = {
          padding: 1,
          margin: { top: 1, bottom: 1, left: 1, right: 10 },
          borderStyle: "round",
          borderColor: "blue",
          title: chalk.blue("Clara"),
          width: boxWidth,
          float: "left",
        };

        console.log(boxen(formattedText, claraBoxOptions));

        messages.push({
          role: "assistant",
          content: text,
        });

        // Add extra space after response
        console.log();
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
    // Display token usage summary if there was a non-graceful exit
    if (TokenTracker.getInstance().getTotalTokenUsage().totalTokens > 0) {
      displayTokenUsageSummary();
    }

    // Close the readline interface
    rl.close();

    // Close all MCP clients if they exist
    if (mcpClients.length > 0) {
      log("Closing MCP clients...");
      await Promise.allSettled(
        mcpClients.map(async (client) => {
          try {
            await client.close();
          } catch (error) {
            log(`Error closing MCP client: ${error}`, "error");
          }
        }),
      );
      log("All MCP clients closed", "success");
    }
  }
}
