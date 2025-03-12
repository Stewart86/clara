#!/usr/bin/env bun
import chalk from "chalk";
import { version } from "../package.json";

// Import CLI command
import "./cli/index.js";

// Print welcome message
console.log(
  chalk.bold.blue(`
╔═══════════════════════════════════════════╗
║                                           ║
║         ${chalk.bold("Clara")} - Code Clarity Assistant      ║
║                                           ║
║           Version: ${version}                  ║
║                                           ║
╚═══════════════════════════════════════════╝
`),
);

// Main entry point used when package is imported
export * from "./tools/index.js";
export * from "./agents/index.js";
