#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { interactive } from "./interactive.js";
import { version } from "../../package.json";
import path from "path";

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

program.parse(process.argv);

// If no arguments, show help
if (process.argv.length <= 2) {
  program.help();
}
