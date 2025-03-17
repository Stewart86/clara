import chalk from "chalk";
import { createInterface } from "readline/promises";
import path from "path";
import fs from "fs/promises";
import {
  type CoreMessage,
  experimental_createMCPClient as createMCPClient,
  generateText,
  type ToolSet,
} from "ai";
import { systemPrompt } from "../prompts/system-prompt.js";
import { getTools, setProjectIdentifier } from "../tools/index.js";
import { openai } from "@ai-sdk/openai";
import { getProjectContext, getMemoryFilesContext } from "../utils/codebase.js";
import { log, markdownToTerminal, TokenTracker } from "../utils/index.js";
import { getSettings, type Settings } from "../utils/settings.js";
import boxen, { type Options } from "boxen";
import { plannerAgent } from "../agents/planner.js";

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
    const model = usage.model || "default";
    const costInfo = tokenTracker.calculateCost(
      model,
      usage.promptTokens,
      usage.completionTokens,
    );

    console.log(chalk.cyan(`${agent} (${model}):`));
    console.log(
      `  Prompt: ${usage.promptTokens.toLocaleString()} tokens ($${costInfo.promptCost.toFixed(6)})`,
    );
    console.log(
      `  Completion: ${usage.completionTokens.toLocaleString()} tokens ($${costInfo.completionCost.toFixed(6)})`,
    );
    console.log(
      `  Total: ${usage.totalTokens.toLocaleString()} tokens ($${costInfo.totalCost.toFixed(6)})`,
    );
  });

  // Display total usage
  console.log(chalk.yellow("\nTotal Usage:"));
  console.log(`  Prompt: ${totalUsage.promptTokens.toLocaleString()} tokens`);
  console.log(
    `  Completion: ${totalUsage.completionTokens.toLocaleString()} tokens`,
  );
  console.log(
    chalk.green(
      `  Total: ${totalUsage.totalTokens.toLocaleString()} tokens ($${totalUsage.totalCost.toFixed(6)})`,
    ),
  );
  console.log();
}

/**
 * Function to safely close MCP clients
 */
async function closeMCPClients(clients: any[]) {
  if (clients.length === 0) return;

  log("Closing MCP clients...");
  await Promise.allSettled(
    clients.map(async (client) => {
      try {
        await client.close();
      } catch (error) {
        log(`Error closing MCP client: ${error}`, "error");
      }
    }),
  );
  log("All MCP clients closed", "success");
}

/**
 * Function to verify and change to project directory
 */
async function setupProjectDirectory(
  projectPath: string,
): Promise<string | null> {
  const originalDir = process.cwd();
  const absoluteProjectPath = path.resolve(projectPath);

  try {
    const stats = await fs.stat(absoluteProjectPath);
    if (!stats.isDirectory()) {
      console.error(
        chalk.red(`Error: ${absoluteProjectPath} is not a directory.`),
      );
      return null;
    }

    process.chdir(absoluteProjectPath);
    console.log(chalk.gray(`Working directory: ${process.cwd()}`));
    setProjectIdentifier(process.cwd());
    return originalDir;
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        chalk.red(
          `Error: Cannot access directory ${absoluteProjectPath}: ${error.message}`,
        ),
      );
    } else {
      console.error(
        chalk.red(
          `Error: Cannot access directory ${absoluteProjectPath}: ${error}`,
        ),
      );
    }
    return null;
  }
}

/**
 * Function to read multiline input from user
 */
async function readUserInput(rl: any): Promise<string> {
  console.log(chalk.gray("Tip: Enter a blank line to finish multiline input"));

  const lines: string[] = [];
  const firstLine = await rl.question(chalk.green(" > "));

  // Check for exit command on the first line
  if (firstLine.toLowerCase() === "exit") {
    return "exit";
  }

  // Start collecting lines
  lines.push(firstLine);

  // Keep collecting lines until an empty line is entered
  while (true) {
    const nextLine = await rl.question(chalk.green("... "));
    if (nextLine.trim() === "") break;
    lines.push(nextLine);
  }

  return lines.join("\n");
}

/**
 * Function to display user message in a box
 */
function displayUserMessage(prompt: string, terminalWidth: number) {
  if (!prompt.trim()) return;

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

  process.stdout.moveCursor(0, -1);
  process.stdout.clearLine(1);
  console.log(boxen(prompt, userBoxOptions));
}

/**
 * Function to display assistant message in a box
 */
function displayAssistantMessage(text: string, terminalWidth: number) {
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

  console.log(boxen(text, claraBoxOptions));
  console.log(); // Add extra space after response
}

/**
 * Function to display goodbye message
 */
function displayGoodbyeMessage(terminalWidth: number) {
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

  console.log(boxen("Goodbye! Have a great day! 👋", goodbyeBoxOptions));
  console.log(); // Add extra space
}

/**
 * Setup MCP clients and tools
 */
async function setupMCPTools(settings: Settings) {
  const mcpClients = [];
  const mcpTools = [];

  for (const [key, transport] of Object.entries(settings.mcpServers)) {
    log(`Creating MCP client for ${key}`);
    try {
      const mcpClient = await createMCPClient({ transport });
      mcpClients.push(mcpClient);

      const tool = await mcpClient.tools();
      mcpTools.push(tool);
      log(`MCP client created for ${key}`, "success");
    } catch (error) {
      log(`Failed to create MCP client for ${key}: ${error}`, "error");
    }
  }

  log(`${mcpTools.length} MCP tools created`, "success");
  return [mcpClients, mcpTools];
}

/**
 * Track token usage for conversation
 */
function trackTokenUsage(response: any, messages: CoreMessage[], text: string) {
  const tokenTracker = TokenTracker.getInstance();
  const model = "gpt-4o";

  if (response.usage) {
    tokenTracker.recordTokenUsage(
      "main",
      response.usage.promptTokens || 0,
      response.usage.completionTokens || 0,
      model,
    );
  } else {
    // Fallback estimation if usage stats aren't available
    const promptTokenEstimate = Math.ceil(
      messages.reduce((total, msg) => total + (msg.content?.length || 0), 0) /
        4,
    );
    const completionTokenEstimate = Math.ceil(text.length / 4);
    tokenTracker.recordTokenUsage(
      "main",
      promptTokenEstimate,
      completionTokenEstimate,
      model,
    );
  }
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
    displayTokenUsageSummary();
    rl.close();
    await closeMCPClients(mcpClients);
    process.exit(0);
  });

  try {
    // Setup project directory
    const originalDir = await setupProjectDirectory(projectPath);
    if (!originalDir) return;

    const settings = await getSettings();
    const [newMcpClients, mcpTools] = await setupMCPTools(settings);
    mcpClients = newMcpClients;

    const messages: CoreMessage[] = [
      { role: "system", content: systemPrompt },
      await getProjectContext(),
      await getMemoryFilesContext(),
    ];

    const tools = getTools();
    let running = true;

    while (running) {
      try {
        const prompt = await readUserInput(rl);

        // Skip empty prompts
        if (prompt.trim()) {
          displayUserMessage(prompt, terminalWidth);
        }

        if (prompt.toLowerCase() === "exit") {
          displayGoodbyeMessage(terminalWidth);
          displayTokenUsageSummary();
          running = false;
          break;
        }

        // Add user message to conversation history
        messages.push({ role: "user", content: prompt });

        process.stdout.write("thinking...");

        // First, run the planner agent to analyze the request
        const plannerOutput = await plannerAgent(prompt, "");
        log(
          `[Interactive] Planner output generated (${plannerOutput.length} chars)`,
          "system",
        );

        // Extract memory update points from planner output if they exist
        const memoryUpdateRegex =
          /Memory Update Points:\s*\n((?:- After .*\n)*)/;
        const memoryUpdateMatch = plannerOutput.match(memoryUpdateRegex);

        // Track memory update instructions to handle after the response
        let memoryUpdateInstructions: string[] = [];
        if (memoryUpdateMatch && memoryUpdateMatch[1]) {
          const updatePointsText = memoryUpdateMatch[1];
          const updatePoints = updatePointsText
            .split("\n")
            .filter((line) => line.trim().length > 0);

          log(
            `[Interactive] Found ${updatePoints.length} memory update points`,
            "system",
          );
          memoryUpdateInstructions = updatePoints.map((point) => point.trim());
        }

        // Store memory update instructions in session state for later use
        sessionState.set("pendingMemoryUpdates", memoryUpdateInstructions);

        // Create a combined prompt with planner insights
        const enhancedPrompt = `
USER ORIGINAL REQUEST: ${prompt}

PLANNER ANALYSIS:
${plannerOutput}

Please use the planner's analysis above to guide your approach. Follow the search keywords and step-by-step directions while addressing the user's request. If memory updates are needed based on what you learn, make sure to use the writeMemoryTool to store this information.
`;

        // Add the planner's analysis as a hidden system message
        messages.push({ role: "system", content: enhancedPrompt });

        // Process the prompt and get response
        const response = await generateText({
          model: openai.responses("gpt-4o"),
          messages,
          providerOptions: {
            openai: { reasoningEffort: "medium" },
          },
          tools: {
            ...tools,
            ...(Object.fromEntries(
              mcpTools.flatMap((toolSet) => Object.entries(toolSet)),
            ) as ToolSet),
          },
          maxSteps: 100,
        });

        const { text } = response;
        trackTokenUsage(response, messages, text);

        // Clear thinking indicator
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);

        // Display formatted response
        const formattedText = markdownToTerminal(text);
        displayAssistantMessage(formattedText, terminalWidth);

        // Add assistant message to conversation history
        messages.push({ role: "assistant", content: text });

        // Remove the planner analysis system message to keep history clean
        messages.pop(); // Remove assistant message temporarily
        messages.pop(); // Remove planner system message
        messages.push({ role: "assistant", content: text }); // Re-add assistant message
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

    // Restore original directory
    process.chdir(originalDir);
  } catch (error) {
    console.error(chalk.red("Error:"), error);
  } finally {
    // Display token usage summary if there was a non-graceful exit
    if (TokenTracker.getInstance().getTotalTokenUsage().totalTokens > 0) {
      displayTokenUsageSummary();
    }

    // Close the readline interface and MCP clients
    rl.close();
    await closeMCPClients(mcpClients);
  }
}
