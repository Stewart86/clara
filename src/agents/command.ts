import { z } from "zod";
import { tool as aiTool } from "ai";
import { log } from "../utils/logger.js";
import { BaseAgent, type AgentConfig } from "./base.js";
import { secureCommand } from "../tools/command.js";

const getCommandAgentSystemPrompt = (): string => `You are a specialized Command Execution Agent for Clara, responsible for safely running and interpreting shell commands. Your primary goal is to help users interact with their system while maintaining security and providing clear explanations of command outputs.

## Core Responsibilities
1. Running shell commands safely with robust security validation
2. Interpreting command results intelligently
3. Handling errors and suggesting recovery options
4. Composing complex command sequences based on user goals
5. Parsing and summarizing command output when appropriate

## Security Guidelines
When executing commands, you MUST:
- Avoid dangerous operations like rm -rf / or any destructive command without clear scoping
- Never run commands that download and directly execute code from the internet
- Be cautious with commands that modify system files or configuration
- Reject commands attempting privilege escalation without clear justification
- Avoid command injection patterns
- Provide clear warnings when commands appear risky

## Command Composition Guidelines
1. Use clear, readable command structures
2. Add appropriate error handling (e.g., set -e for bash scripts)
3. Validate inputs and anticipate edge cases
4. Prefer single-purpose commands over complex chains unless necessary
5. Use explicit options rather than shorthand flags for readability
6. Provide meaningful feedback and progress indicators

## Output Interpretation
When interpreting command results:
1. Explain non-zero exit codes and error messages
2. Highlight important information in large outputs
3. Format complex outputs for better readability
4. Parse JSON/XML outputs into more readable formats when relevant
5. Suggest next steps based on the command results

## Common Commands and Their Uses
- File operations: ls, cd, cp, mv, mkdir, rm, find, grep
- System information: df, du, free, top, ps, htop
- Network tools: ping, curl, wget, ssh, nc, nslookup, dig
- Text processing: cat, head, tail, grep, sed, awk, jq
- Version control: git, svn
- Package management: apt, yum, dnf, brew, npm, pip

## Error Recovery Strategies
When commands fail, suggest strategies like:
1. Checking permissions and ownership
2. Verifying path existence
3. Troubleshooting network connectivity
4. Checking disk space
5. Reviewing syntax and parameter values
6. Looking at relevant logs
7. Using dry-run modes when available

Remember: security is your highest priority. Always err on the side of caution when executing commands, and provide clear explanations of what commands do before running them.`;

/**
 * Schema for command execution result parsing
 */
const CommandResultSchema = z.object({
  command: z.string().describe("The command that was executed"),
  exitCode: z.number().describe("The exit code returned by the command"),
  success: z.boolean().describe("Whether the command executed successfully"),
  summary: z.string().describe("A summary of what the command did or attempted to do"),
  interpretation: z.string().describe("Explanation of the command output"),
  keyFindings: z.array(z.string()).describe("Key information extracted from the output"),
  errors: z.array(z.string()).describe("Any errors encountered during execution"),
  warnings: z.array(z.string()).describe("Any warnings or potential issues"),
  nextSteps: z.array(z.string()).describe("Suggested next steps based on the command result")
});

/**
 * Enhanced Command Execution Agent that implements the context-aware agent framework
 * Specialized in running and interpreting shell commands safely
 */
export class CommandAgent extends BaseAgent {
  private securityLevel: 'standard' | 'strict' | 'relaxed';

  constructor(securityLevel: 'standard' | 'strict' | 'relaxed' = 'standard') {
    const commandTool = aiTool({
      description: "Executes shell commands securely with validation",
      parameters: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
      execute: async ({ command }) => {
        return await secureCommand(command);
      },
    });

    const config: AgentConfig = {
      name: 'command',
      description: 'Command Execution and Interpretation Agent',
      provider: 'openai',
      model: 'o3-mini',
      systemPrompt: getCommandAgentSystemPrompt(),
      tools: {
        commandTool,
      },
      maxSteps: 15,
      reasoningEffort: 'medium',
    };

    super(config);
    this.securityLevel = securityLevel;
  }

  /**
   * Execute a command with enhanced security and result interpretation
   */
  public async executeCommand(command: string, parseResults: boolean = true): Promise<string> {
    // Initialize operation in context
    const context = this.contextManager.getContext() || this.contextManager.createContext();
    
    log(`[CommandAgent] Executing command: ${command}`, "system");
    
    // Check if this command has already been executed in this context
    const previousExecution = context.commandsExecuted.find(cmd => cmd.command === command);
    if (previousExecution) {
      log(`[CommandAgent] Command was previously executed with exit code ${previousExecution.exitCode}`, "system");
      
      // If we don't need to parse results, just return the previous result
      if (!parseResults) {
        return previousExecution.result;
      }
    }
    
    // Prepare prompt based on whether we need to execute or just interpret
    let prompt: string;
    
    if (previousExecution) {
      // Just interpret previous result
      prompt = `I need you to interpret the results of this command that was already executed:

Command: ${command}
Result: 
\`\`\`
${previousExecution.result}
\`\`\`
Exit code: ${previousExecution.exitCode}

Please analyze the output and provide a detailed interpretation according to the schema.`;
    } else {
      // Execute new command
      prompt = `I need to run the following command and interpret its results:

Command: ${command}

Please:
1. Check if this command is safe to execute
2. Run the command if it's safe (or suggest alternatives if not)
3. Analyze the output and provide a detailed interpretation
4. Extract any key information from the results

Return your analysis in the specified JSON format.`;
    }

    try {
      if (previousExecution) {
        // Parse previous command results
        const parsedResult = await this.executeWithSchema(
          prompt,
          CommandResultSchema
        );
        
        return this.formatCommandResult(parsedResult);
      } else {
        // Execute new command and parse results
        const result = await this.execute(prompt);
        
        // For simple execution without parsing, return just the result
        if (!parseResults) {
          return result;
        }
        
        // Otherwise parse the results
        const parsePrompt = `I've executed the following command:

Command: ${command}
Result: 
\`\`\`
${result}
\`\`\`

Please analyze the output and provide a detailed interpretation according to the schema.`;

        const parsedResult = await this.executeWithSchema(
          parsePrompt,
          CommandResultSchema
        );
        
        return this.formatCommandResult(parsedResult);
      }
    } catch (error) {
      log(
        `[CommandAgent Error] ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
      return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Format the command result object into a readable string
   */
  private formatCommandResult(result: any): string {
    let output = `# Command Execution: ${result.command}\n\n`;
    
    // Add success/failure status
    if (result.success) {
      output += `**Status:** ✅ Success (Exit Code: ${result.exitCode})\n\n`;
    } else {
      output += `**Status:** ❌ Failed (Exit Code: ${result.exitCode})\n\n`;
    }
    
    // Add summary and interpretation
    output += `## Summary\n${result.summary}\n\n`;
    output += `## Interpretation\n${result.interpretation}\n\n`;
    
    // Add key findings
    if (result.keyFindings && result.keyFindings.length > 0) {
      output += "## Key Findings\n";
      result.keyFindings.forEach((finding: string, i: number) => {
        output += `${i + 1}. ${finding}\n`;
      });
      output += "\n";
    }
    
    // Add errors if present
    if (result.errors && result.errors.length > 0) {
      output += "## Errors\n";
      result.errors.forEach((error: string, i: number) => {
        output += `- ${error}\n`;
      });
      output += "\n";
    }
    
    // Add warnings if present
    if (result.warnings && result.warnings.length > 0) {
      output += "## Warnings\n";
      result.warnings.forEach((warning: string, i: number) => {
        output += `- ${warning}\n`;
      });
      output += "\n";
    }
    
    // Add next steps if present
    if (result.nextSteps && result.nextSteps.length > 0) {
      output += "## Suggested Next Steps\n";
      result.nextSteps.forEach((step: string, i: number) => {
        output += `${i + 1}. ${step}\n`;
      });
    }
    
    return output;
  }
  
  /**
   * Factory function for creating command agent
   */
  public static create(securityLevel: 'standard' | 'strict' | 'relaxed' = 'standard'): CommandAgent {
    return new CommandAgent(securityLevel);
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function commandAgent(prompt: string): Promise<string> {
  const agent = new CommandAgent();
  try {
    return await agent.execute(prompt);
  } catch (error) {
    log(`[commandAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while executing the command: ${error}`;
  }
}