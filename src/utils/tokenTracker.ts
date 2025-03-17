/**
 * Model cost information per 1M tokens
 */
export interface ModelCostInfo {
  model: string;
  promptCostPer1M: number;
  completionCostPer1M: number;
  totalCostPer1M: number;
}

/**
 * Pricing information for different models
 */
export const MODEL_COSTS: { [modelId: string]: ModelCostInfo } = {
  // OpenAI models
  'gpt-4o': { model: 'gpt-4o', promptCostPer1M: 2.50, completionCostPer1M: 1.25, totalCostPer1M: 10.00 },
  'gpt-4o-2024-08-06': { model: 'gpt-4o-2024-08-06', promptCostPer1M: 2.50, completionCostPer1M: 1.25, totalCostPer1M: 10.00 },
  'gpt-4o-audio-preview': { model: 'gpt-4o-audio-preview', promptCostPer1M: 2.50, completionCostPer1M: 0, totalCostPer1M: 10.00 },
  'gpt-4o-audio-preview-2024-12-17': { model: 'gpt-4o-audio-preview-2024-12-17', promptCostPer1M: 2.50, completionCostPer1M: 0, totalCostPer1M: 10.00 },
  'gpt-4o-realtime-preview': { model: 'gpt-4o-realtime-preview', promptCostPer1M: 5.00, completionCostPer1M: 2.50, totalCostPer1M: 20.00 },
  'gpt-4o-realtime-preview-2024-12-17': { model: 'gpt-4o-realtime-preview-2024-12-17', promptCostPer1M: 5.00, completionCostPer1M: 2.50, totalCostPer1M: 20.00 },
  'gpt-4o-mini': { model: 'gpt-4o-mini', promptCostPer1M: 0.15, completionCostPer1M: 0.075, totalCostPer1M: 0.60 },
  'gpt-4o-mini-2024-07-18': { model: 'gpt-4o-mini-2024-07-18', promptCostPer1M: 0.15, completionCostPer1M: 0.075, totalCostPer1M: 0.60 },
  'gpt-4o-mini-audio-preview': { model: 'gpt-4o-mini-audio-preview', promptCostPer1M: 0.15, completionCostPer1M: 0, totalCostPer1M: 0.60 },
  'gpt-4o-mini-audio-preview-2024-12-17': { model: 'gpt-4o-mini-audio-preview-2024-12-17', promptCostPer1M: 0.15, completionCostPer1M: 0, totalCostPer1M: 0.60 },
  'gpt-4o-mini-realtime-preview': { model: 'gpt-4o-mini-realtime-preview', promptCostPer1M: 0.60, completionCostPer1M: 0.30, totalCostPer1M: 2.40 },
  'gpt-4o-mini-realtime-preview-2024-12-17': { model: 'gpt-4o-mini-realtime-preview-2024-12-17', promptCostPer1M: 0.60, completionCostPer1M: 0.30, totalCostPer1M: 2.40 },
  'o1': { model: 'o1', promptCostPer1M: 15.00, completionCostPer1M: 7.50, totalCostPer1M: 60.00 },
  'o1-2024-12-17': { model: 'o1-2024-12-17', promptCostPer1M: 15.00, completionCostPer1M: 7.50, totalCostPer1M: 60.00 },
  'o3-mini': { model: 'o3-mini', promptCostPer1M: 1.10, completionCostPer1M: 0.55, totalCostPer1M: 4.40 },
  'o3-mini-2025-01-31': { model: 'o3-mini-2025-01-31', promptCostPer1M: 1.10, completionCostPer1M: 0.55, totalCostPer1M: 4.40 },
  'o1-mini': { model: 'o1-mini', promptCostPer1M: 1.10, completionCostPer1M: 0.55, totalCostPer1M: 4.40 },
  'o1-mini-2024-09-12': { model: 'o1-mini-2024-09-12', promptCostPer1M: 1.10, completionCostPer1M: 0.55, totalCostPer1M: 4.40 },
  'gpt-4o-mini-search-preview': { model: 'gpt-4o-mini-search-preview', promptCostPer1M: 0.15, completionCostPer1M: 0, totalCostPer1M: 0.60 },
  'gpt-4o-mini-search-preview-2025-03-11': { model: 'gpt-4o-mini-search-preview-2025-03-11', promptCostPer1M: 0.15, completionCostPer1M: 0, totalCostPer1M: 0.60 },
  'gpt-4o-search-preview': { model: 'gpt-4o-search-preview', promptCostPer1M: 2.50, completionCostPer1M: 0, totalCostPer1M: 10.00 },
  'gpt-4o-search-preview-2025-03-11': { model: 'gpt-4o-search-preview-2025-03-11', promptCostPer1M: 2.50, completionCostPer1M: 0, totalCostPer1M: 10.00 },

  // Default fallback for unknown models
  'default': { model: 'default', promptCostPer1M: 0, completionCostPer1M: 0, totalCostPer1M: 0 }
};

/**
 * Tracks token usage across different agent types
 */
interface AgentTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
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
   * Get model cost info
   */
  public getModelCostInfo(model: string): ModelCostInfo {
    return MODEL_COSTS[model] || MODEL_COSTS['default'];
  }

  /**
   * Calculate cost for token usage
   */
  public calculateCost(model: string, promptTokens: number, completionTokens: number): {
    promptCost: number;
    completionCost: number;
    totalCost: number;
  } {
    const costInfo = this.getModelCostInfo(model);
    const promptCost = (promptTokens / 1000000) * costInfo.promptCostPer1M;
    const completionCost = (completionTokens / 1000000) * costInfo.completionCostPer1M;
    return {
      promptCost,
      completionCost,
      totalCost: promptCost + completionCost
    };
  }

  /**
   * Record token usage for a specific agent
   */
  public recordTokenUsage(agentName: string, promptTokens: number, completionTokens: number, model: string = 'default'): void {
    if (!this.tokenUsage[agentName]) {
      this.tokenUsage[agentName] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model
      };
    } else if (!this.tokenUsage[agentName].model) {
      // Handle older records without model information
      this.tokenUsage[agentName].model = model;
    }

    // Update with the latest model if it has changed
    if (model !== 'default') {
      this.tokenUsage[agentName].model = model;
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
    totalCost: number;
  } {
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;

    Object.entries(this.tokenUsage).forEach(([agentName, usage]) => {
      promptTokens += usage.promptTokens;
      completionTokens += usage.completionTokens;
      totalTokens += usage.totalTokens;
      
      const costs = this.calculateCost(usage.model, usage.promptTokens, usage.completionTokens);
      totalCost += costs.totalCost;
    });

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      totalCost
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