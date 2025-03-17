#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { interactive } from "./interactive.js";
import { version } from "../../package.json";
import path from "path";
import { getSettings, updateSettings } from "../utils/settings.js";

const program = new Command();

program
  .name("clara")
  .description(
    "An AI Assistant that provides clarity to your business codebase",
  )
  .version(version);

program
  .command("interactive")
  .description("Start an interactive session with Clara")
  .option(
    "-p, --path <dirPath>",
    "Path to the project directory",
    process.cwd(),
  )
  .action(async (options) => {
    try {
      // Convert to absolute path if relative
      const projectPath = path.isAbsolute(options.path)
        ? options.path
        : path.resolve(process.cwd(), options.path);

      console.log(
        chalk.blue(
          `Starting interactive session with Clara for project at ${projectPath}...`,
        ),
      );
      await interactive(projectPath);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
      }
    }
  });

program
  .command("analyze")
  .description("Analyze the current codebase")
  .option("-d, --directory <dir>", "Specify a directory to analyze", ".")
  .option("-o, --output <file>", "Write output to a file")
  .action(async (options) => {
    const dirPath = path.isAbsolute(options.directory)
      ? options.directory
      : path.resolve(process.cwd(), options.directory);

    console.log(chalk.blue(`Analyzing codebase in ${dirPath}...`));
    // TODO: Implement analysis
  });

program
  .command("explain")
  .description("Explain a specific file or function")
  .argument("<target>", "File or function to explain")
  .option("-b, --business", "Focus on business impact")
  .option("-t, --technical", "Focus on technical details")
  .option(
    "-p, --path <dirPath>",
    "Path to the project directory",
    process.cwd(),
  )
  .action(async (target, options) => {
    const projectPath = path.isAbsolute(options.path)
      ? options.path
      : path.resolve(process.cwd(), options.path);

    console.log(
      chalk.blue(`Explaining ${target} in project at ${projectPath}...`),
    );
    // TODO: Implement explanation
  });

// Feature command to manage experimental features
const featureCommand = program.command("feature");
featureCommand
  .description("Manage experimental Clara features");

// List all available features
featureCommand
  .command("list")
  .description("List all available experimental features and their status")
  .action(async () => {
    try {
      const settings = await getSettings();
      console.log(chalk.blue("Clara Experimental Features:"));
      console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
      
      const features = {
        "multi-agent-system": {
          name: "Multi-Agent System",
          enabled: settings.features?.multiAgentSystem || true,
          description: "Advanced orchestrator with specialized worker agents (enabled by default)"
        },
        "memory-indexing": {
          name: "Memory Indexing",
          enabled: settings.features?.memoryIndexing || false,
          description: "Enhanced memory organization with relationships and search"
        },
        "agent-activity": {
          name: "Agent Activity Display",
          enabled: settings.features?.agentActivity || true,
          description: "Show active agent and current step during execution"
        },
        "context-sharing": {
          name: "Context Sharing",
          enabled: settings.features?.contextSharing || true,
          description: "Share context between agents via message-based persistence"
        }
      };
      
      Object.entries(features).forEach(([key, feature]) => {
        const status = feature.enabled 
          ? chalk.green("Enabled")
          : chalk.gray("Disabled");
        
        console.log(`${chalk.cyan(feature.name)} (${key}): ${status}`);
        console.log(`  ${feature.description}`);
        console.log();
      });
      
      console.log(chalk.gray("Use 'clara feature enable <feature-id>' to enable a feature"));
      console.log(chalk.gray("Use 'clara feature disable <feature-id>' to disable a feature"));
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
    }
  });

// Enable a specific feature
featureCommand
  .command("enable")
  .description("Enable an experimental feature")
  .argument("<feature-id>", "ID of the feature to enable")
  .action(async (featureId) => {
    try {
      const settings = await getSettings();
      
      switch (featureId) {
        case "multi-agent-system":
          await updateSettings({
            features: {
              multiAgentSystem: true,
              memoryIndexing: settings.features?.memoryIndexing ?? false,
              agentActivity: settings.features?.agentActivity ?? true,
              contextSharing: settings.features?.contextSharing ?? true
            }
          });
          console.log(chalk.green("✓ Multi-Agent System has been enabled"));
          break;
        case "memory-indexing":
          await updateSettings({
            features: {
              multiAgentSystem: settings.features?.multiAgentSystem ?? false,
              memoryIndexing: true,
              agentActivity: settings.features?.agentActivity ?? true,
              contextSharing: settings.features?.contextSharing ?? true
            }
          });
          console.log(chalk.green("✓ Memory Indexing has been enabled"));
          break;
        case "agent-activity":
          await updateSettings({
            features: {
              multiAgentSystem: settings.features?.multiAgentSystem ?? false,
              memoryIndexing: settings.features?.memoryIndexing ?? false,
              agentActivity: true,
              contextSharing: settings.features?.contextSharing ?? true
            }
          });
          console.log(chalk.green("✓ Agent Activity Display has been enabled"));
          break;
        case "context-sharing":
          await updateSettings({
            features: {
              multiAgentSystem: settings.features?.multiAgentSystem ?? false,
              memoryIndexing: settings.features?.memoryIndexing ?? false,
              agentActivity: settings.features?.agentActivity ?? true,
              contextSharing: true
            }
          });
          console.log(chalk.green("✓ Context Sharing has been enabled"));
          break;
        default:
          console.error(chalk.red(`Unknown feature: ${featureId}`));
          console.log(chalk.gray("Use 'clara feature list' to see available features"));
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
    }
  });

// Disable a specific feature
featureCommand
  .command("disable")
  .description("Disable an experimental feature")
  .argument("<feature-id>", "ID of the feature to disable")
  .action(async (featureId) => {
    try {
      const settings = await getSettings();
      
      switch (featureId) {
        case "multi-agent-system":
          await updateSettings({
            features: {
              multiAgentSystem: false,
              memoryIndexing: settings.features?.memoryIndexing ?? false,
              agentActivity: settings.features?.agentActivity ?? true,
              contextSharing: settings.features?.contextSharing ?? true
            }
          });
          console.log(chalk.yellow("✓ Multi-Agent System has been disabled"));
          break;
        case "memory-indexing":
          await updateSettings({
            features: {
              multiAgentSystem: settings.features?.multiAgentSystem ?? false,
              memoryIndexing: false,
              agentActivity: settings.features?.agentActivity ?? true,
              contextSharing: settings.features?.contextSharing ?? true
            }
          });
          console.log(chalk.yellow("✓ Memory Indexing has been disabled"));
          break;
        case "agent-activity":
          await updateSettings({
            features: {
              multiAgentSystem: settings.features?.multiAgentSystem ?? false,
              memoryIndexing: settings.features?.memoryIndexing ?? false,
              agentActivity: false,
              contextSharing: settings.features?.contextSharing ?? true
            }
          });
          console.log(chalk.yellow("✓ Agent Activity Display has been disabled"));
          break;
        case "context-sharing":
          await updateSettings({
            features: {
              multiAgentSystem: settings.features?.multiAgentSystem ?? false,
              memoryIndexing: settings.features?.memoryIndexing ?? false,
              agentActivity: settings.features?.agentActivity ?? true,
              contextSharing: false
            }
          });
          console.log(chalk.yellow("✓ Context Sharing has been disabled"));
          break;
        default:
          console.error(chalk.red(`Unknown feature: ${featureId}`));
          console.log(chalk.gray("Use 'clara feature list' to see available features"));
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
    }
  });

program.parse(process.argv);

// If no arguments, show help
if (process.argv.length <= 2) {
  program.help();
}
