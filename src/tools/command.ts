import { log } from "../utils/logger.js";
import { spawn } from "bun";

/**
 * Run a shell command and return the output
 * @param command Command to run
 * @returns Command output
 */
export async function runCommand(command: string): Promise<string> {
  try {
    // List of allowed commands for security
    const allowedCommands = [
      "ls",
      "fd",
      "rg",
      "cat",
      "gh",
      "pwd",
      "find",
      "grep",
      "head",
      "tail",
      "wc",
      "echo",
    ];

    // Parse the command to get the executable part
    const commandParts = command.trim().split(/\s+/);
    const executable = commandParts[0];

    // Check if command starts with an allowed command
    const isAllowed = allowedCommands.includes(executable);

    if (!isAllowed) {
      return `Command not allowed for security reasons: ${command}`;
    }

    log(`[Command] Running: ${command}`, "system");

    // Use Bun.spawn to run the command
    const proc = spawn(commandParts, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd(),
    });

    // Read stdout and stderr
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    log(`[Command] Exit code: ${exitCode}`, "system");

    if (stderr && stderr.trim().length > 0) {
      return `Command output (with warnings):\n${stdout}\n\nWarnings:\n${stderr}`;
    }

    return stdout || "Command executed successfully with no output.";
  } catch (error) {
    if (error instanceof Error) {
      log(`[Command Error] ${error}`, "error");
      return `Error executing command: ${error.message}`;
    }
    return `Error executing command: ${error}`;
  }
}
