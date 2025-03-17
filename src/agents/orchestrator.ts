import { z } from "zod";
import { log } from "../utils/logger.js";
import {
  getMemoryFilesContext,
  getProjectContext,
  type AgentPlan,
} from "../utils/index.js";
import { getPlannerTools } from "../tools/index.js";
import { BaseAgent, type AgentConfig } from "./base.js";
import type { CoreMessage } from "ai";

// Schema for the structured output of the orchestrator
const PlanSchema = z.object({
  taskCategory: z.string(),
  severity: z.enum(["critical", "major", "minor", "none"]),
  steps: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
      agent: z.string(),
      dependencies: z.array(z.number()),
      completed: z.boolean(), // Boolean without transform - will default to false in the schema
      result: z.string().nullable(), // Simplified schema for result
    }),
  ),
  searchKeywords: z.array(z.string()),
  memoryUpdatePoints: z.array(
    z.object({
      afterStep: z.number(),
      filePath: z.string(),
      description: z.string(),
    }),
  ),
});

/**
 * The Orchestrator Agent - evolved from the planner agent
 * Responsible for analyzing user requests, creating detailed execution plans,
 * and coordinating the workflow between specialized agents
 */
export class OrchestratorAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "orchestrator",
      description: "Clara Task Orchestrator and Action Planner",
      provider: "openai",
      model: "o3-mini",
      systemPrompt: getOrchestratorSystemPrompt(),
      tools: getPlannerTools(),
      maxSteps: 50,
      reasoningEffort: "high",
    };
    super(config);
  }

  /**
   * Create a detailed execution plan for a user request
   */
  public async createPlan(
    description: string,
    additionalContext?: string,
  ): Promise<AgentPlan> {
    log(`[Orchestrator] Creating plan for: ${description}`, "system");

    try {
      // Construct messages with additional context
      const messages: CoreMessage[] = [
        { role: "system", content: this.config.systemPrompt },
        await getMemoryFilesContext(),
        await getProjectContext(),
        {
          role: "user",
          content: `${description}${additionalContext ? `\nAdditional context: ${additionalContext}` : ""}`,
        },
      ];

      // Initialize context if not already done
      let context = this.contextManager.getContext();
      if (!context) {
        context = this.contextManager.createContext();
      }

      // Embed context in messages
      this.contextManager.embedContextInMessages(messages);

      // Generate structured plan
      const plan = await this.executeWithSchema(
        description,
        PlanSchema,
        additionalContext,
      );

      // Ensure all steps are initially marked as not completed, regardless of what came from the model
      plan.steps.forEach((step) => {
        step.completed = false;
        step.result = null;
      });

      // Store plan in context
      this.contextManager.setPlan(plan);

      log(
        `[Orchestrator] Plan created with ${plan.steps.length} steps`,
        "system",
      );
      return plan;
    } catch (error) {
      log(
        `[Orchestrator Error] ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Start executing the created plan
   */
  public async executePlan(): Promise<string> {
    const context = this.contextManager.getContext();
    if (!context || !context.plan) {
      return "No plan available to execute. Please create a plan first.";
    }

    log(
      `[Orchestrator] Starting plan execution with ${context.plan.steps.length} steps`,
      "system",
    );

    // Debug log the plan details for troubleshooting
    log(
      `[Orchestrator Debug] Plan details: ${JSON.stringify(context.plan, null, 2)}`,
      "system",
    );

    // Validate the plan has valid agent assignments
    const invalidAgentSteps = context.plan.steps.filter(
      (step) =>
        !["search", "memory", "command", "verification", "userIntent"].includes(
          step.agent,
        ),
    );

    if (invalidAgentSteps.length > 0) {
      log(
        `[Orchestrator] Warning: Plan contains ${invalidAgentSteps.length} steps with invalid agent assignments`,
        "error",
      );

      // Fix invalid agent assignments with defaults
      for (const step of invalidAgentSteps) {
        const originalAgent = step.agent;

        // Assign a default agent based on the description
        if (
          step.description.toLowerCase().includes("search") ||
          step.description.toLowerCase().includes("find")
        ) {
          step.agent = "search";
        } else if (
          step.description.toLowerCase().includes("memory") ||
          step.description.toLowerCase().includes("document")
        ) {
          step.agent = "memory";
        } else if (
          step.description.toLowerCase().includes("run") ||
          step.description.toLowerCase().includes("execute")
        ) {
          step.agent = "command";
        } else if (
          step.description.toLowerCase().includes("verify") ||
          step.description.toLowerCase().includes("validate")
        ) {
          step.agent = "verification";
        } else {
          // Default to search if we can't determine
          step.agent = "search";
        }

        log(
          `[Orchestrator] Fixed step ${step.id} agent from "${originalAgent}" to "${step.agent}"`,
          "system",
        );
      }
    }

    // Get the first step to execute
    let nextStep = this.contextManager.getNextStep();
    if (!nextStep) {
      // Check if there are any steps at all
      if (context.plan.steps.length === 0) {
        log(`[Orchestrator] Plan has no steps at all`, "error");
        return "The plan was created with no steps. I'll need more specific information to help you.";
      }

      // If there are steps but none are executable, it might be due to circular dependencies
      log(
        `[Orchestrator] Plan has ${context.plan.steps.length} steps but none are executable`,
        "error",
      );

      // Try to fix by making the first step executable (no dependencies)
      if (context.plan.steps.length > 0) {
        const firstStep = context.plan.steps[0];
        if (firstStep.dependencies.length > 0) {
          log(
            `[Orchestrator] Fixing circular dependencies by clearing dependencies for step 1`,
            "system",
          );
          firstStep.dependencies = [];

          // Try again to get the next step
          nextStep = this.contextManager.getNextStep();

          if (!nextStep) {
            return "Plan has steps but they have circular dependencies that couldn't be fixed.";
          }
        } else {
          return "Plan has steps but none are executable due to dependency issues.";
        }
      } else {
        return "Plan has no executable steps.";
      }
    }

    // Execute steps until none are available
    const results: string[] = [];
    let executedStepCount = 0;
    const maxSteps = 20; // Safety limit to prevent infinite loops

    while (nextStep && executedStepCount < maxSteps) {
      log(
        `[Orchestrator] Executing step ${nextStep.id}: ${nextStep.description}`,
        "system",
      );

      // Update current step in context
      this.contextManager.setCurrentStep(nextStep.id);

      // Execute step with appropriate agent
      const stepResult = await this.executeStep(nextStep);

      // Mark step as completed
      this.contextManager.completeStep(nextStep.id, stepResult);

      // Store result
      results.push(
        `Step ${nextStep.id} (${nextStep.agent}): ${nextStep.description}\n\n${stepResult}`,
      );

      // Check for memory updates that should happen after this step
      await this.checkAndPerformMemoryUpdates(nextStep.id);

      // Get next step
      nextStep = this.contextManager.getNextStep();
      executedStepCount++;
    }

    // Check if we hit the safety limit
    if (executedStepCount >= maxSteps && nextStep) {
      log(
        `[Orchestrator] Warning: Hit maximum step limit (${maxSteps})`,
        "error",
      );
      results.push(
        `Note: Plan execution was limited to ${maxSteps} steps for safety.`,
      );
    }

    // Process results into a concise summary
    if (results.length === 0) {
      return "The plan didn't produce any results. Please try with a more specific request.";
    }

    // Get the verification agent to summarize if available
    try {
      const { getAgent } = await import("./registry.js");
      const verificationAgent = getAgent("verification");

      log(
        `[Orchestrator] Using verification agent to create concise summary`,
        "system",
      );
      const summarizationPrompt = `
I need a concise summary of the following multi-step results:

${results.join("\n\n")}

You should be concise, direct, and to the point. 
Focus only on the most important findings and conclusions. The summary should be informative but brief and use common laguage and layman's term. 

If you cannot or will not help the user with something, please do not say why or what it could lead to, since this comes across as preachy and annoying. Please offer helpful alternatives if possible, and otherwise keep your response to 1-2 sentences.
IMPORTANT: You should minimize output tokens as much as possible while maintaining helpfulness, quality, and accuracy. Only address the specific query or task at hand, avoiding tangential information unless absolutely critical for completing the request. If you can answer in 1-3 sentences or a short paragraph, please do.
IMPORTANT: You should NOT answer with unnecessary preamble or postamble (such as explaining your code or summarizing your action), unless the user asks you to.
IMPORTANT: Keep your responses short, since they will be displayed on a command line interface. You MUST answer concisely with fewer than 4 lines (not including tool use or code generation), unless user asks for detail. Answer the user's question directly, without elaboration, explanation, or details. One word answers are best. Avoid introductions, conclusions, and explanations. You MUST avoid text before/after your response, such as "The answer is <answer>.", "Here is the content of the file..." or "Based on the information provided, the answer is..." or "Here is what I will do next...". Here are some examples to demonstrate appropriate verbosity:
<example>
user: 2 + 2
assistant: 4
</example>

<example>
user: what is 2+2?
assistant: 4
</example>

<example>
user: is 11 a prime number?
assistant: true
</example>

<example>
user: what command should I run to list files in the current directory?
assistant: ls
</example>

<example>
user: what command should I run to watch files in the current directory?
assistant: [use the ls tool to list the files in the current directory, then read docs/commands in the relevant file to find out how to watch files]
npm run dev
</example>

<example>
user: How many golf balls fit inside a jetta?
assistant: 150000
</example>

<example>
user: what files are in the directory src/?
assistant: [runs ls and sees foo.c, bar.c, baz.c]
user: which file contains the implementation of foo?
assistant: src/foo.c
</example>

<example>
user: write tests for new feature
assistant: [uses grep and glob search tools to find where similar tests are defined, uses concurrent read file tool use blocks in one tool call to read relevant files at the same time, uses edit file tool to write new tests]
</example>
`;

      const summary = await verificationAgent.execute(summarizationPrompt);
      log(
        `[Orchestrator] Plan execution completed with ${results.length} steps - summarized`,
        "system",
      );
      return summary;
    } catch (error) {
      // If summarization fails, create a basic summary
      log(
        `[Orchestrator] Failed to summarize results: ${error}. Using basic summary.`,
        "error",
      );

      // Create a basic summary using just the first and last result
      let basicSummary = "Here's what I found:\n\n";

      // Add most relevant info (first and last step results)
      if (results.length === 1) {
        basicSummary += results[0];
      } else {
        // Add first and last steps which usually contain the most important info
        const firstResult = results[0].split("\n\n")[1] || results[0]; // Skip the step description part if possible
        const lastResult =
          results[results.length - 1].split("\n\n")[1] ||
          results[results.length - 1];

        basicSummary += firstResult + "\n\n";
        if (results.length > 1) {
          basicSummary += lastResult;
        }
      }

      log(
        `[Orchestrator] Plan execution completed with ${results.length} steps - basic summary`,
        "system",
      );
      return basicSummary;
    }
  }

  /**
   * Check for memory updates that need to be performed after a specific step
   */
  private async checkAndPerformMemoryUpdates(stepId: number): Promise<void> {
    const context = this.contextManager.getContext();
    if (!context || !context.plan) return;

    // Find any memory updates that should happen after this step
    const memoryUpdates = context.plan.memoryUpdatePoints.filter(
      (update) => update.afterStep === stepId,
    );

    if (memoryUpdates.length === 0) return;

    log(
      `[Orchestrator] Found ${memoryUpdates.length} memory updates to perform after step ${stepId}`,
      "system",
    );

    // Get memory agent to perform updates
    const { getAgent } = await import("./registry.js");
    const memoryAgent = getAgent("memory");

    // Collect all context for memory updates
    const relevantSteps = context.plan.steps.filter(
      (step) =>
        step.completed &&
        step.result &&
        (step.id === stepId ||
          context.plan?.steps
            .find((s) => s.id === stepId)
            ?.dependencies.includes(step.id)),
    );

    const stepResults = relevantSteps
      .map(
        (step) =>
          `Step ${step.id} (${step.agent}): ${step.description}\nResult: ${step.result || "No result"}`,
      )
      .join("\n\n");

    // Perform each memory update
    for (const update of memoryUpdates) {
      log(
        `[Orchestrator] Performing memory update: ${update.description} to ${update.filePath}`,
        "system",
      );

      try {
        // Execute memory agent with context from relevant steps
        await memoryAgent.execute(
          `Update memory at ${update.filePath}: ${update.description}`,
          `Context from previous steps:\n\n${stepResults}`,
        );

        log(
          `[Orchestrator] Memory update completed for ${update.filePath}`,
          "system",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log(
          `[Orchestrator] Error performing memory update: ${errorMessage}`,
          "error",
        );
        this.contextManager.recordError(
          stepId,
          `Memory update error: ${errorMessage}`,
        );
      }
    }
  }

  /**
   * Execute a single step using the appropriate agent
   */
  private async executeStep(step: {
    id: number;
    description: string;
    agent: string;
  }): Promise<string> {
    log(
      `[Orchestrator] Dispatching to ${step.agent} agent: "${step.description}"`,
      "system",
    );

    // Get the display activity function if available
    let displayActivity:
      | ((agentName: string, action: string) => void)
      | undefined;
    try {
      const sessionState = await import("../utils/sessionState.js").then(
        (module) => module.getSessionState(),
      );
      displayActivity = sessionState.get("displayAgentActivity");
    } catch (error) {
      // No display function available, that's fine
    }

    if (displayActivity) {
      displayActivity(
        step.agent,
        `step ${step.id}: ${step.description.substring(0, 40)}...`,
      );
    }

    try {
      // Get context for dependency results
      const context = this.contextManager.getContext();
      if (!context || !context.plan) {
        throw new Error("No context or plan available");
      }

      // Build context information from dependencies
      const dependenciesContext = this.buildDependencyContext(step.id);

      // Get the appropriate agent from registry
      const { getAgent } = await import("./registry.js");

      // Validate agent type
      const validAgentTypes = [
        "search",
        "memory",
        "command",
        "verification",
        "userIntent",
      ];
      if (!validAgentTypes.includes(step.agent)) {
        throw new Error(`Unknown agent type: ${step.agent}`);
      }

      // Execute using the appropriate agent
      const agent = getAgent(step.agent as any);
      const result = await agent.execute(step.description, dependenciesContext);

      log(
        `[Orchestrator] Step ${step.id} completed by ${step.agent} agent`,
        "system",
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log(
        `[Orchestrator] Error executing step ${step.id}: ${errorMessage}`,
        "error",
      );

      // Record the error in context
      this.contextManager.recordError(step.id, errorMessage);

      return `Error executing step ${step.id}: ${errorMessage}`;
    }
  }

  /**
   * Build context information from completed dependency steps
   */
  private buildDependencyContext(stepId: number): string {
    const context = this.contextManager.getContext();
    if (!context || !context.plan) return "";

    // Find the current step
    const currentStep = context.plan.steps.find((step) => step.id === stepId);
    if (!currentStep) return "";

    // Get all completed dependencies
    const dependencies = currentStep.dependencies
      .map((depId) => context.plan?.steps.find((step) => step.id === depId))
      .filter((step) => step && step.completed);

    // If no completed dependencies, return empty string
    if (dependencies.length === 0) return "";

    // Build context string with dependency results
    const contextParts = dependencies.map((dep) => {
      if (!dep) return "";
      return `Step ${dep.id} (${dep.agent}): ${dep.description}\nResult: ${dep.result || "No result"}\n\n`;
    });

    return `Previous steps results:\n\n${contextParts.join("")}`;
  }
}

/**
 * Factory function for creating orchestrator agent
 */
export function createOrchestratorAgent(): OrchestratorAgent {
  return new OrchestratorAgent();
}

/**
 * Legacy function for backward compatibility with the original planner agent
 */
export async function plannerAgent(
  description: string,
  additionalContext: string,
): Promise<string> {
  const orchestrator = new OrchestratorAgent();
  try {
    const plan = await orchestrator.createPlan(description, additionalContext);
    return JSON.stringify(plan, null, 2);
  } catch (error) {
    return `Error in Planner Agent: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Get the system prompt for the orchestrator agent
 */
function getOrchestratorSystemPrompt(): string {
  return `# Clara Task Orchestrator and Action Planner

You are Clara's Task Orchestrator and Action Planner. Your responsibility is to analyze user requests and transform them into structured action plans with precise search strategies and step assignments.

**IMPORTANT:**
- Actively use the tools available to you to gain initial context and provide accurate responses.
- Make full use of the memory reader, file reader, search, and web search tools to gather necessary information.
- When investigating codebase issues, always utilize appropriate search tools rather than making assumptions.
- For web search inquiries, leverage the web search tool to retrieve up-to-date information.

## CORE CAPABILITIES
- Request classification: Identify the type of task (bug report, feature request, documentation, investigation)
- Search strategy planning: Create targeted search paths using memory and codebase
- Knowledge management: Track information flow and ensure memory updates
- Workflow optimization: Suggest the most efficient approach to solve the problem
- Agent assignment: Match steps to specialized agents for optimal execution

## TASK CLASSIFICATION
- Bug Fix: Code not functioning as expected, requires correction
- Bug Report: Documenting an issue without immediate implementation of a fix
- Feature Implementation: Adding new functionality to the codebase  
- Documentation: Explaining codebase structure or behavior
- Investigation: Understanding how specific functionality works
- Business Process Inquiry: Understanding how code implements business workflows or requirements
- GitHub Issue Management: Viewing, creating, commenting on, or updating GitHub issues
- GitHub Issue Fix: Implementing a fix for an existing GitHub issue with PR workflow
- Web Search Inquiry: Requests requiring the latest information, documentation, or external data

## AGENT TYPES
Each step in your plan should be assigned to one of these agent types:
- search: Finding files and content in the codebase with incremental search strategies
- memory: Organizing and managing Clara's knowledge system with categorization and metadata
- command: Running and interpreting shell commands safely with enhanced validation
- verification: Validating outputs and results for accuracy and self-consistency
- userIntent: Deeply understanding user requests and expectations

## ACTION PLAN STRUCTURE
For each request, produce:
1. Task Category with severity for bugs (critical/major/minor)
2. Logical, sequential steps using imperative action verbs
3. Agent assignments for each step
4. Dependencies between steps (which steps must complete before others can start)
5. Comprehensive search keywords in priority order
6. Memory update checkpoints with specific file paths within the memory system (~/.config/clara/)

## SEARCH STRATEGY RULES
1. ALWAYS begin with memory search before codebase search
2. Target specific files/components based on functionality
3. Examine error messages for distinctive error codes or strings
4. Follow the execution path: search for function calls and imports
5. Inspect related files in the same module or component
6. Check configuration files that might affect behavior
7. Examine error handling and validation logic
8. Provide branch keywords for different investigation paths
9. Include synonyms and related terms for comprehensive search
10. For GitHub-related requests: Use \`gh\` CLI commands with appropriate filters and formatting
11. NEVER search codebase for GitHub issues - use \`gh issue list\` or \`gh issue view\` commands instead
12. For requests requiring up-to-date information: Include web search steps using websearch agent

## WEB SEARCH DETECTION RULES
IMPORTANT: Be vigilant in detecting when web search is appropriate. Include a web search step when user's request:
1. Explicitly asks for "latest," "newest," "current," "up-to-date," or "recent" information
2. References timeframes like "now," "today," "this year," or specific dates
3. Mentions technologies, libraries, frameworks, or APIs that may have evolving documentation
4. Inquires about industry standards, best practices, or trends
5. Asks about compatibility with new versions or platforms
6. Requests comparisons between different tools or technologies
7. Uses phrases like "what is the standard way to," "how do people typically," or "what's the consensus on"
8. Seeks information about recently released features or changes
9. Mentions specific version numbers of packages, libraries, or tools released after your knowledge cutoff
10. Refers to events, conferences, or releases that occurred after your knowledge cutoff
11. Requests information about package dependencies or version compatibility issues
12. Asks about deprecation notices, breaking changes, or migration guides for libraries/frameworks
13. Discusses any technology-related topic where the landscape might have changed significantly since your training data

## SEVERITY DEFINITIONS
- Critical: System crash, data loss, security vulnerability, blocking functionality
- Major: Core feature malfunction, significant performance issue, limited workarounds
- Minor: Non-core functionality issues, UI problems, cosmetic defects

## OUTPUT FORMAT
You must return a valid JSON object matching this schema:

\`\`\`typescript
{
  "taskCategory": string,
  "severity": "critical" | "major" | "minor" (optional, only for bugs),
  "steps": [
    {
      "id": number,
      "description": string,
      "agent": string, // One of: "search", "memory", "command", "verification", "userIntent"
      "dependencies": number[], // Array of step IDs that must complete before this step
      "completed": boolean // Always false initially
    }
  ],
  "searchKeywords": string[],
  "memoryUpdatePoints": [
    {
      "afterStep": number,
      "filePath": string, // Specific path within memory system
      "description": string
    }
  ]
}
\`\`\`

IMPORTANT:
- Step IDs must start at 1 and increment sequentially
- Steps must have logical dependencies (don't require steps that haven't happened yet)
- Memory file paths should be specific (e.g., "codebase/architecture.md", not just "codebase")
- Agent assignments must match one of the defined agent types exactly
`;
}
