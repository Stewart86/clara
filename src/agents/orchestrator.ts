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
  severity: z.enum(["critical", "major", "minor"]).optional(),
  steps: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
      agent: z.string(),
      dependencies: z.array(z.number()),
      completed: z.boolean().transform(() => true), // Force to true to ensure it's always defined
      result: z.any().optional(),
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

    // Get the first step to execute
    let nextStep = this.contextManager.getNextStep();
    if (!nextStep) {
      return "Plan has no executable steps.";
    }

    // Execute steps until none are available
    const results: string[] = [];
    while (nextStep) {
      log(
        `[Orchestrator] Executing step ${nextStep.id}: ${nextStep.description}`,
        "system",
      );

      // Update current step in context
      this.contextManager.setCurrentStep(nextStep.id);

      // Execute step with appropriate agent
      // In a real implementation, this would dispatch to different agent types
      // For now, we'll use a placeholder
      const stepResult = await this.executeStep(nextStep);

      // Mark step as completed
      this.contextManager.completeStep(nextStep.id, stepResult);

      // Store result
      results.push(`Step ${nextStep.id}: ${stepResult}`);

      // Get next step
      nextStep = this.contextManager.getNextStep();
    }

    const summary = `Plan execution completed with ${results.length} steps.\n\n${results.join("\n\n")}`;
    log(`[Orchestrator] Plan execution completed`, "system");

    return summary;
  }

  /**
   * Execute a single step using the appropriate agent
   * This is a placeholder - in the full implementation, this would dispatch to appropriate agent types
   */
  private async executeStep(step: {
    id: number;
    description: string;
    agent: string;
  }): Promise<string> {
    // This is a placeholder method that will be replaced with actual agent dispatching
    // In the full implementation, this would match the agent type and dispatch accordingly

    log(
      `[Orchestrator] Dispatching to ${step.agent} agent: "${step.description}"`,
      "system",
    );

    // Mock execution with a 1-second delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return `Executed "${step.description}" with ${step.agent} agent`;
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
