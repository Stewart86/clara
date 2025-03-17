import type { CoreMessage } from "ai";

/**
 * Represents the full execution context shared between agents
 */
export interface AgentContext {
  // Request tracking
  requestId: string;
  userId: string;
  timestamp: string;

  // Workflow state
  currentStep: number;
  totalSteps: number;
  plan: AgentPlan | null;

  // Resource tracking
  filesSearched: string[];
  filesRead: Record<
    string,
    { path: string; lineRanges: Array<[number, number]> }
  >;
  commandsExecuted: Array<{
    command: string;
    result: string;
    exitCode: number;
  }>;
  webSearches: Array<{ query: string; result: string }>;

  // Memory interaction
  memoryCreated: string[];
  memoryRead: string[];

  // Results and state
  intermediateResults: Record<string, any>;
  errors: Array<{ step: number; error: string; recovery?: string }>;

  // Token usage tracking
  tokenUsage: Record<
    string,
    { prompt: number; completion: number; model: string }
  >;
}

/**
 * Represents a structured action plan created by the orchestrator
 */
export interface AgentPlan {
  taskCategory: string;
  severity?: "critical" | "major" | "minor" | "none";
  steps: Array<{
    id: number;
    description: string;
    agent: string;
    dependencies: number[];
    completed: boolean;
    result?: any;
  }>;
  searchKeywords: string[];
  memoryUpdatePoints: Array<{
    afterStep: number;
    filePath: string;
    description: string;
  }>;
}

/**
 * Context management system for Clara agents
 */
export class ContextManager {
  private static instance: ContextManager;
  private currentContext: AgentContext | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  /**
   * Create a new context for a request
   */
  public createContext(): AgentContext {
    this.currentContext = {
      requestId: this.generateRequestId(),
      userId: process.env.USER || "unknown",
      timestamp: new Date().toISOString(),
      currentStep: 0,
      totalSteps: 0,
      plan: null,
      filesSearched: [],
      filesRead: {},
      commandsExecuted: [],
      webSearches: [],
      memoryCreated: [],
      memoryRead: [],
      intermediateResults: {},
      errors: [],
      tokenUsage: {},
    };

    return this.currentContext;
  }

  /**
   * Get the current context
   */
  public getContext(): AgentContext | null {
    return this.currentContext;
  }

  /**
   * Update context with token usage
   */
  public updateTokenUsage(
    agentName: string,
    promptTokens: number,
    completionTokens: number,
    model: string,
  ): void {
    if (!this.currentContext) return;

    if (!this.currentContext.tokenUsage[agentName]) {
      this.currentContext.tokenUsage[agentName] = {
        prompt: 0,
        completion: 0,
        model,
      };
    }

    this.currentContext.tokenUsage[agentName].prompt += promptTokens;
    this.currentContext.tokenUsage[agentName].completion += completionTokens;
  }

  /**
   * Update context with file read information
   */
  public recordFileRead(
    filePath: string,
    lineRange: [number, number] | null,
  ): void {
    if (!this.currentContext) {
      this.currentContext = this.createContext();
    }

    // Initialize filesRead if it doesn't exist
    if (!this.currentContext.filesRead) {
      this.currentContext.filesRead = {};
    }

    if (!this.currentContext.filesRead[filePath]) {
      this.currentContext.filesRead[filePath] = {
        path: filePath,
        lineRanges: [],
      };
    }

    if (lineRange) {
      this.currentContext.filesRead[filePath].lineRanges.push(lineRange);
    }
  }

  /**
   * Record file search operation
   */
  public recordFileSearch(searchQuery: string): void {
    if (!this.currentContext) return;
    this.currentContext.filesSearched.push(searchQuery);
  }

  /**
   * Record command execution
   */
  public recordCommand(
    command: string,
    result: string,
    exitCode: number,
  ): void {
    if (!this.currentContext) return;
    this.currentContext.commandsExecuted.push({ command, result, exitCode });
  }

  /**
   * Record web search operation
   */
  public recordWebSearch(query: string, result: string): void {
    if (!this.currentContext) return;
    this.currentContext.webSearches.push({ query, result });
  }

  /**
   * Record memory file creation
   */
  public recordMemoryCreation(filePath: string): void {
    if (!this.currentContext) return;
    this.currentContext.memoryCreated.push(filePath);
  }

  /**
   * Record memory file read
   */
  public recordMemoryRead(filePath: string): void {
    if (!this.currentContext) return;
    this.currentContext.memoryRead.push(filePath);
  }

  /**
   * Store intermediate result
   */
  public storeResult(key: string, value: any): void {
    if (!this.currentContext) return;
    this.currentContext.intermediateResults[key] = value;
  }

  /**
   * Get intermediate result
   */
  public getResult(key: string): any {
    if (!this.currentContext) return null;
    return this.currentContext.intermediateResults[key];
  }

  /**
   * Record error occurrence
   */
  public recordError(step: number, error: string, recovery?: string): void {
    if (!this.currentContext) {
      this.currentContext = this.createContext();
    }
    
    // Ensure the errors array exists
    if (!this.currentContext.errors) {
      this.currentContext.errors = [];
    }
    
    this.currentContext.errors.push({ step, error, recovery });
    
    // Log the error for debugging
    console.error(`[Context] Recorded error in step ${step}: ${error}`);
  }

  /**
   * Update plan in context
   */
  public setPlan(plan: AgentPlan): void {
    if (!this.currentContext) return;
    this.currentContext.plan = plan;
    this.currentContext.totalSteps = plan.steps.length;
  }

  /**
   * Update current step
   */
  public setCurrentStep(step: number): void {
    if (!this.currentContext) return;
    this.currentContext.currentStep = step;
  }

  /**
   * Mark step as completed
   */
  public completeStep(stepId: number, result?: any): void {
    if (!this.currentContext || !this.currentContext.plan) return;

    const step = this.currentContext.plan.steps.find((s) => s.id === stepId);
    if (step) {
      step.completed = true;
      if (result !== undefined) {
        step.result = result;
      }
    }
  }

  /**
   * Get next step to execute
   */
  public getNextStep(): {
    id: number;
    description: string;
    agent: string;
  } | null {
    if (!this.currentContext || !this.currentContext.plan) return null;

    const pendingSteps = this.currentContext.plan.steps.filter(
      (step) => !step.completed,
    );
    if (pendingSteps.length === 0) return null;

    // Find steps whose dependencies are all completed
    const availableSteps = pendingSteps.filter((step) => {
      return step.dependencies.every((depId) => {
        const depStep = this.currentContext?.plan?.steps.find(
          (s) => s.id === depId,
        );
        return depStep?.completed === true;
      });
    });

    if (availableSteps.length === 0) return null;

    // Return the first available step
    const nextStep = availableSteps[0];
    return {
      id: nextStep.id,
      description: nextStep.description,
      agent: nextStep.agent,
    };
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Convert context to JSON for storage in message history
   */
  public contextToJson(): string {
    return JSON.stringify(this.currentContext);
  }

  /**
   * Create context from JSON stored in message history
   */
  public contextFromJson(json: string): AgentContext | null {
    try {
      this.currentContext = JSON.parse(json) as AgentContext;
      return this.currentContext;
    } catch (error) {
      console.error("Failed to parse context JSON:", error);
      return null;
    }
  }

  /**
   * Extract context from message history
   */
  public extractContextFromMessages(
    messages: CoreMessage[],
  ): AgentContext | null {
    // Look for context in a hidden message
    const contextMessage = messages.find((msg) => {
      const content = msg.content;
      if (typeof content === "string") {
        return (
          content.includes("__CONTEXT_START__") &&
          content.includes("__CONTEXT_END__")
        );
      }
      return false;
    });

    if (contextMessage && typeof contextMessage.content === "string") {
      const parts = contextMessage.content.split("__CONTEXT_START__");
      if (parts.length > 1) {
        const contextPart = parts[1].split("__CONTEXT_END__")[0];
        return this.contextFromJson(contextPart);
      }
    }

    return null;
  }

  /**
   * Embed context in message history
   */
  public embedContextInMessages(messages: CoreMessage[]): CoreMessage[] {
    if (!this.currentContext) return messages;

    const contextJson = this.contextToJson();
    const contextMessage = `__CONTEXT_START__${contextJson}__CONTEXT_END__`;

    // Check if a context message already exists
    const contextIndex = messages.findIndex((msg) => {
      const content = msg.content;
      if (typeof content === "string") {
        return (
          content.includes("__CONTEXT_START__") &&
          content.includes("__CONTEXT_END__")
        );
      }
      return false;
    });

    if (
      contextIndex >= 0 &&
      typeof messages[contextIndex].content === "string"
    ) {
      // Update existing context message with type safety
      const updatedMsg = { ...messages[contextIndex] };
      updatedMsg.content = contextMessage;
      messages[contextIndex] = updatedMsg;
    } else {
      // Add a new context message (as system message to avoid displaying to user)
      messages.push({
        role: "system",
        content: contextMessage,
      } as CoreMessage);
    }

    return messages;
  }
}
