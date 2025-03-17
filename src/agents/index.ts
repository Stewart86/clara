// Legacy agent imports for backward compatibility
import { parserAgent } from "./parser.js";
import { memeAgent } from "./meme.js";
import { punAgent } from "./pun.js";
import { assistantAgent } from "./assistant.js";
import { webSearchAgent } from "./websearch.js";

// Core agent infrastructure
import { BaseAgent } from "./base.js";

// Orchestrator agent (evolved from planner)
import { plannerAgent, OrchestratorAgent, createOrchestratorAgent } from "./orchestrator.js";

// Specialized worker agents
import { searchAgent, SearchAgent, createSearchAgent } from "./search.js";
import { MemoryAgent, memoryAgent } from "./memory.js";
import { CommandAgent, commandAgent } from "./command.js";
import { VerificationAgent, verificationAgent } from "./verification.js";
import { UserIntentAgent, userIntentAgent } from "./userIntent.js";

// Agent Registry
import { AgentRegistry, getAgent, type AgentType } from "./registry.js";

// Export everything
export {
  // Legacy exports for backward compatibility
  plannerAgent,
  parserAgent,
  memeAgent,
  punAgent,
  assistantAgent,
  searchAgent,
  webSearchAgent,
  
  // Core agent infrastructure
  BaseAgent,
  
  // Orchestrator agent
  OrchestratorAgent,
  createOrchestratorAgent,
  
  // Specialized worker agents
  SearchAgent,
  createSearchAgent,
  MemoryAgent,
  memoryAgent,
  CommandAgent,
  commandAgent,
  VerificationAgent,
  verificationAgent,
  UserIntentAgent,
  userIntentAgent,
  
  // Agent Registry
  AgentRegistry,
  getAgent,
  type AgentType,
};
