import { BaseAgent } from "./base.js";
import { SearchAgent, createSearchAgent } from "./search.js";
import { MemoryAgent, memoryAgent } from "./memory.js";
import { CommandAgent, commandAgent } from "./command.js";
import { VerificationAgent, verificationAgent } from "./verification.js";
import { UserIntentAgent, userIntentAgent } from "./userIntent.js";
import { log } from "../utils/logger.js";

/**
 * Agent types supported by the registry
 */
export type AgentType = "search" | "memory" | "command" | "verification" | "userIntent";

/**
 * AgentRegistry provides a centralized system for tracking, instantiating,
 * and retrieving specialized agent instances.
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentType, BaseAgent>;

  private constructor() {
    this.agents = new Map();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register an agent instance with the registry
   */
  public registerAgent(type: AgentType, agent: BaseAgent): void {
    this.agents.set(type, agent);
    log(`[AgentRegistry] Registered ${type} agent`, "system");
  }

  /**
   * Get an agent by type, creating it if it doesn't exist
   */
  public getAgent(type: AgentType): BaseAgent {
    // Check if agent already exists
    const existingAgent = this.agents.get(type);
    if (existingAgent) {
      return existingAgent;
    }

    // Create new agent instance based on type
    let agent: BaseAgent;
    switch (type) {
      case "search":
        agent = createSearchAgent();
        break;
      case "memory":
        agent = new MemoryAgent();
        break;
      case "command":
        agent = new CommandAgent();
        break;
      case "verification":
        agent = new VerificationAgent();
        break;
      case "userIntent":
        agent = new UserIntentAgent();
        break;
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }

    // Register and return the new agent
    this.registerAgent(type, agent);
    return agent;
  }

  /**
   * Clear all agent instances (useful for testing)
   */
  public clearAgents(): void {
    this.agents.clear();
    log("[AgentRegistry] Cleared all agent instances", "system");
  }

  /**
   * Get the count of registered agents (useful for testing)
   */
  public getRegisteredAgentCount(): number {
    return this.agents.size;
  }
}

/**
 * Get an agent instance by type
 * Convenience method for accessing the registry
 */
export function getAgent(type: AgentType): BaseAgent {
  return AgentRegistry.getInstance().getAgent(type);
}