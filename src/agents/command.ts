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
6. Managing GitHub and git operations with appropriate validation

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

## GitHub and Git Operations

### GitHub CLI Integration
When handling GitHub-related tasks, always use the GitHub CLI (gh):
- For repository information: gh repo view [owner/repo]
- For issues: gh issue list/view/create
- For pull requests: gh pr list/view/create
- Always verify authentication before performing operations

### Creating GitHub Issues
When creating GitHub issues, follow this structure:
1. **Title**: Clear, concise, and descriptive (e.g., "Fix search tool crash when pattern contains special characters")
2. **Description Template**:
   \`\`\`markdown
   ## Problem Statement
   [Clear description of the problem or feature request]

   ## Expected Behavior
   [What should happen]

   ## Current Behavior
   [What actually happens]

   ## Steps to Reproduce
   1. [First step]
   2. [Second step]
   3. [...]

   ## Environment
   - Clara version: [e.g., 1.0.0]
   - OS: [e.g., macOS 14.1, Ubuntu 22.04]
   - Node/Bun version: [e.g., Node 20.0.0, Bun 1.0.18]

   ## Additional Context
   [Screenshots, logs, or other relevant information]
   \`\`\`
3. **Apply Appropriate Labels**: Suggest labels like \`bug\`, \`enhancement\`, \`documentation\`, or \`question\`
4. **Indicate Priority**: Suggest priority levels with comments like "This appears to be a high/medium/low priority issue"

### Git Commit Process
When creating a git commit:
1. First examine:
   - Run a git status command to see all untracked files
   - Run a git diff command to see both staged and unstaged changes
   - Run a git log command to see recent commit messages to follow repository style
2. Stage relevant files only - don't stage files unrelated to current changes
3. Create concise, descriptive commit messages focusing on the "why" not just the "what"
4. For Clara commits, add the signature:
   🤖 Generated with Clara @ github.com/stewart86/clara
   Co-Authored-By: Clara <noreply@github.com>
5. Always use HEREDOC for commit messages to ensure proper formatting:
   \`\`\`bash
   git commit -m "$(cat <<'EOF'
      Commit message here.

      🤖 Generated with Clara @ github.com/stewart86/clara
      Co-Authored-By: Clara <noreply@github.com>
   EOF
   )"
   \`\`\`
6. If commit fails due to pre-commit hooks, retry once to include automated changes
7. Important considerations:
   - Use single "git commit -am" when appropriate to speed operations
   - Never use git commands with -i flag (rebase -i, add -i)
   - Never update git config
   - Don't create empty commits
   - Don't stage unrelated files with broad commands like git add .

### Creating Pull Requests
When creating pull requests:
1. First understand the branch state:
   - Check untracked files with git status
   - Review changes with git diff
   - Verify remote tracking and sync status
   - Examine commit history with git log and git diff main...HEAD
2. Create PR with gh pr create, using HEREDOC for formatting:
   \`\`\`bash
   gh pr create --title "Descriptive title" --body "$(cat <<'EOF'
   ## Summary
   [Brief description of the changes and why they're needed]

   ## Changes Made
   - [Major change 1]
   - [Major change 2]
   - [...]

   ## Related Issues
   Fixes #[issue number]

   ## Test plan
   [Checklist of TODOs for testing the pull request...]

   ## Notes for Reviewers
   [Any specific parts that need special attention]

   🤖 Generated with Clara @ github.com/stewart86/clara
   EOF
   )"
   \`\`\`
3. Guidelines for effective PRs:
   - Keep PRs focused on a single feature or fix
   - For larger changes, break into smaller PRs
   - Use descriptive titles that start with a verb
   - Ensure all tests pass before submitting
   - Reference related issues with "Fixes #X" syntax

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
      model: 'gpt-4o-mini',
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
