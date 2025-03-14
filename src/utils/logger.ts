import chalk from "chalk";

type LogType = "system" | "info" | "warning" | "error" | "success";

/**
 * Logs a message with appropriate color based on type
 * For system logs (those containing tags like [SEARCH], [READ]), logs will be gray
 * System logs are only shown in debug mode.
 *
 * @param message The message to log
 * @param type The type of log (system, info, warning, error, success)
 */
export function log(message: string, type: LogType = "info"): void {
  if (type === "system") {
    // Check if we're in a TTY environment with clearLine available
    if (process.stdout.isTTY && process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${chalk.gray(message)}`);
    } else {
      // Fallback for non-TTY environments
      console.log(chalk.gray(message));
    }
    return;
  }

  // Regular logs with appropriate colors
  switch (type) {
    case "info":
      console.log(chalk.blue(message));
      break;
    case "warning":
      console.log(chalk.yellow(message));
      break;
    case "error":
      console.log(chalk.red(message));
      break;
    case "success":
      console.log(chalk.green(message));
      break;
    default:
      console.log(message);
  }
}
