// Legacy agent imports for backward compatibility
import { parserAgent } from "./parser.js";
import { memeAgent } from "./meme.js";
import { punAgent } from "./pun.js";
import { assistantAgent } from "./assistant.js";
import { webSearchAgent } from "./websearch.js";

// New agent implementations
import { plannerAgent, OrchestratorAgent, createOrchestratorAgent } from "./orchestrator.js";
import { searchAgent, SearchAgent, createSearchAgent } from "./search.js";
import { BaseAgent } from "./base.js";

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
  
  // New agent system exports
  BaseAgent,
  OrchestratorAgent,
  createOrchestratorAgent,
  SearchAgent,
  createSearchAgent,
};
