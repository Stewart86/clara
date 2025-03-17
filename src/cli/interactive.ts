import chalk from "chalk";
import { createInterface } from "readline/promises";
import path from "path";
import fs from "fs/promises";
import {
  type CoreMessage,
  experimental_createMCPClient as createMCPClient,
} from "ai";
import { setProjectIdentifier } from "../tools/index.js";
import { log, markdownToTerminal, TokenTracker } from "../utils/index.js";
import { getSettings, type Settings } from "../utils/settings.js";
import boxen, { type Options } from "boxen";
import { AgentRegistry, getAgent } from "../agents/registry.js";
import { createOrchestratorAgent } from "../agents/orchestrator.js";

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
 * Function to display agent status during execution
 */
function displayAgentActivity(agentName: string, action: string) {
  const agentColor =
    {
      orchestrator: chalk.blue,
      search: chalk.yellow,
      memory: chalk.green,
      command: chalk.red,
      verification: chalk.magenta,
      userIntent: chalk.cyan,
    }[agentName] || chalk.white;

  process.stdout.write(`\r${agentColor(`${agentName}:`)} ${action}...`);
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

  // Ensure features object is always defined
  const features = settings.features || {
    multiAgentSystem: false,
    memoryIndexing: false, 
    agentActivity: true,
    contextSharing: true
  };

  for (const [key, transport] of Object.entries(settings.mcpServers)) {
    log(`Creating MCP client for ${key}`);
    try {
      // Only pass the transport parameter to createMCPClient
      const mcpClient = await createMCPClient({ 
        transport
      });
      
      // Store features in session state instead
      const sessionState = await import("../utils/sessionState.js").then(
        (module) => module.getSessionState()
      );
      sessionState.set("features", {
        multiAgentSystem: features.multiAgentSystem ?? false,
        memoryIndexing: features.memoryIndexing ?? false,
        agentActivity: features.agentActivity ?? true,
        contextSharing: features.contextSharing ?? true
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
  return [mcpClients, mcpTools];
}

/**
 * Initialize the agent registry and create necessary agents
 */
function initializeAgentRegistry() {
  const registry = AgentRegistry.getInstance();
  log(`[Interactive] Initializing agent registry`, "system");

  // Force initialization of all agents
  getAgent("search");
  getAgent("memory");
  getAgent("command");
  getAgent("verification");
  getAgent("userIntent");

  log(
    `[Interactive] Agent registry initialized with ${registry.getRegisteredAgentCount()} agents`,
    "system",
  );
  return registry;
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

/**
 * Execute the request using the multi-agent system
 */
async function executeWithMultiAgentSystem(
  prompt: string,
  additionalContext: string = "",
): Promise<string> {
  log(`[Interactive] Processing request: ${prompt}`, "system");
  process.stdout.write("analyzing request...");

  // Create orchestrator agent
  const orchestrator = createOrchestratorAgent();

  try {
    // Fall back to direct search if anything goes wrong
    try {
      // Create a plan
      displayAgentActivity("orchestrator", "creating plan");
      const plan = await orchestrator.createPlan(prompt, additionalContext);

      // Validate the plan has steps
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error("Plan was created but contains no steps");
      }

      log(
        `[Interactive] Plan created with ${plan.steps.length} steps`,
        "system",
      );

      // Debug log the plan details
      log(
        `[Interactive Debug] Plan details: ${JSON.stringify(plan, null, 2)}`,
        "system",
      );

      // For debugging, check if steps have proper agent assignments
      const invalidAgentSteps = plan.steps.filter(
        (step) =>
          ![
            "search",
            "memory",
            "command",
            "verification",
            "userIntent",
          ].includes(step.agent),
      );
      if (invalidAgentSteps.length > 0) {
        log(
          `[Interactive] Warning: Plan contains ${invalidAgentSteps.length} steps with invalid agent assignments`,
          "error",
        );
        invalidAgentSteps.forEach((step) => {
          log(
            `[Interactive] Step ${step.id} has invalid agent: "${step.agent}"`,
            "error",
          );
        });
      }

      process.stdout.write("\rexecuting plan...                     ");

      // Execute plan and get results
      displayAgentActivity("orchestrator", "executing plan");
      const result = await orchestrator.executePlan();

      // If the result contains any of these error messages, provide a better response
      const errorMessages = [
        "Plan has no executable steps",
        "Plan has steps but none are executable",
        "Plan has steps but they have circular dependencies",
        "The plan was created with no steps",
      ];

      if (errorMessages.some((err) => result.includes(err))) {
        throw new Error(`Plan execution failed: ${result}`);
      }

      // Clear the progress indicator
      process.stdout.write("\r" + " ".repeat(100) + "\r");

      // Return successful result
      return result;
    } catch (orchestratorError) {
      // If anything fails with the orchestrator, fall back to direct search
      log(
        `[Interactive] Orchestrator failed: ${orchestratorError}. Falling back to search agent.`,
        "error",
      );

      // Clear the progress indicator
      process.stdout.write("\r" + " ".repeat(100) + "\r");

      // Get the search agent directly
      const { getAgent } = await import("../agents/registry.js");
      const searchAgent = getAgent("search");

      // Execute search to find information related to the request
      displayAgentActivity("search", "examining file contents");

      // Create a more specific search prompt to ensure useful concise results
      const enhancedPrompt = `
I need to investigate: ${prompt}

Please provide a concise, focused answer (maximum 3 paragraphs) with exactly what I need to know.
Focus on giving me useful information directly rather than just listing files. Examine relevant code
if needed and explain what you find.
`;

      const searchResult = await searchAgent.execute(enhancedPrompt);

      return searchResult;
    }
  } catch (error) {
    // This is the absolute last resort if even the fallback fails
    log(`[Interactive] All approaches failed: ${error}`, "error");

    // Clear the progress indicator
    process.stdout.write("\r" + " ".repeat(100) + "\r");

    // Provide a more helpful error message to the user
    return `I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}.\n\nPlease try rephrasing your request or providing more specific details about what you'd like me to help with.`;
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

    // Share the display agent activity function via session state
    const sessionState = await import("../utils/sessionState.js").then(
      (module) => module.getSessionState(),
    );
    sessionState.set("displayAgentActivity", displayAgentActivity);

    // Initialize agent registry with all worker agents
    initializeAgentRegistry();
    log(`[Interactive] Using multi-agent workflow system`, "system");

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

        // Process with the multi-agent system
        const text = await executeWithMultiAgentSystem(prompt);

        // Display formatted response
        const formattedText = markdownToTerminal(text);
        displayAssistantMessage(formattedText, terminalWidth);
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
