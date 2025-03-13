import chalk from "chalk";
import path from "path";

type LogType = "system" | "info" | "warning" | "error" | "success";

/**
 * Determine if we should show debug logs
 * - In development: Always show system logs
 * - In production: Only show if DEBUG=true
 */
function shouldShowDebugLogs(): boolean {
  // Check if we're running in development mode or debug is enabled
  const isDevelopment = process.env.NODE_ENV === "development" || 
                        // Also consider development if we're running with bun directly
                        process.argv[0].includes("bun") ||
                        // Check if we're running the source .ts files directly
                        process.argv[1]?.endsWith(".ts");
  
  // Check if DEBUG environment variable is set
  const isDebugEnabled = process.env.DEBUG === "true";
  
  return isDevelopment || isDebugEnabled;
}

/**
 * Logs a message with appropriate color based on type
 * For system logs (those containing tags like [SEARCH], [READ]), logs will be gray
 * System logs are only shown in debug mode.
 *
 * @param message The message to log
 * @param type The type of log (system, info, warning, error, success)
 */
export function log(message: string, type: LogType = "info"): void {
  // Skip system logs unless in debug mode
  if (type === "system" && !shouldShowDebugLogs()) {
    return;
  }

  // Check if this is a system log (contains tags like [SEARCH], [READ])
  const isSystemLog = /\[\w+\]/.test(message);

  if (isSystemLog && type === "system") {
    process.stdout.write(`\r${chalk.gray(message)}\n`);
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
