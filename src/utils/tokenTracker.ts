/**
 * Tracks token usage across different agent types
 */
interface AgentTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface TokenUsageByAgent {
  [agentName: string]: AgentTokenUsage;
}

export class TokenTracker {
  private static instance: TokenTracker;
  private tokenUsage: TokenUsageByAgent = {};

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  /**
   * Record token usage for a specific agent
   */
  public recordTokenUsage(agentName: string, promptTokens: number, completionTokens: number): void {
    if (!this.tokenUsage[agentName]) {
      this.tokenUsage[agentName] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    }

    this.tokenUsage[agentName].promptTokens += promptTokens;
    this.tokenUsage[agentName].completionTokens += completionTokens;
    this.tokenUsage[agentName].totalTokens += (promptTokens + completionTokens);
  }

  /**
   * Get total token usage across all agents
   */
  public getTotalTokenUsage(): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    Object.values(this.tokenUsage).forEach(usage => {
      promptTokens += usage.promptTokens;
      completionTokens += usage.completionTokens;
      totalTokens += usage.totalTokens;
    });

    return {
      promptTokens,
      completionTokens,
      totalTokens
    };
  }

  /**
   * Get token usage by agent
   */
  public getTokenUsageByAgent(): TokenUsageByAgent {
    return { ...this.tokenUsage };
  }

  /**
   * Reset token counters
   */
  public reset(): void {
    this.tokenUsage = {};
  }
}