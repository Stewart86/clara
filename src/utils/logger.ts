import chalk from "chalk";
import path from "path";

type LogType = "system" | "info" | "warning" | "error" | "success";

/**
 * Determine if we should show debug logs
 * - In development: Always show system logs
 * - In production: Only show if DEBUG=true
 */
function shouldShowDebugLogs(): boolean {
  // Check if DEBUG environment variable is explicitly set to true
  if (process.env.DEBUG === "true") {
    return true;
  }

  // Detect production mode
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    return false;
  }

  // For built/compiled Clara binary check - the binary won't have .ts extension
  const isCompiledBinary = !process.argv[0].includes("bun") && 
                         !process.argv[1]?.endsWith(".ts");
  
  // If it looks like we're running a compiled binary and DEBUG is not set
  if (isCompiledBinary && process.env.DEBUG !== "true") {
    return false;
  }
  
  // Otherwise, assume we're in development mode
  return true;
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
  // For system logs, only show them if debug is enabled
  if (type === "system") {
    // Skip system logs unless in debug mode
    if (!shouldShowDebugLogs()) {
      return;
    }
    
    // Format and show system log
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
