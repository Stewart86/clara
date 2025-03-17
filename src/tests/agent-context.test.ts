import { test, expect } from "bun:test";
import { ContextManager } from "../utils/agentContext.js";
import { OrchestratorAgent } from "../agents/orchestrator.js";
import { SearchAgent } from "../agents/search.js";
import type { CoreMessage } from "ai";

// Test the context manager
test("ContextManager should create and maintain context", () => {
  const manager = ContextManager.getInstance();
  
  // Create a new context
  const context = manager.createContext();
  
  // Verify initial state
  expect(context).toBeDefined();
  expect(context.requestId).toBeDefined();
  expect(context.filesSearched).toEqual([]);
  expect(context.plan).toBeNull();
  
  // Update context
  manager.recordFileSearch("test-pattern");
  manager.recordFileRead("test-file.ts", [1, 10]);
  
  // Verify updates
  const updatedContext = manager.getContext();
  expect(updatedContext?.filesSearched).toContain("test-pattern");
  expect(updatedContext?.filesRead["test-file.ts"]).toBeDefined();
  expect(updatedContext?.filesRead["test-file.ts"].lineRanges).toContainEqual([1, 10]);
});

// Test context serialization and extraction
test("Context should be serializable and extractable from messages", () => {
  const manager = ContextManager.getInstance();
  
  // Create a context with some data
  manager.createContext();
  manager.recordFileSearch("search-pattern");
  
  // Create messages
  const messages: Array<{role: string; content: string}> = [
    { role: "system", content: "Test prompt" },
    { role: "user", content: "Test input" }
  ];
  
  // Embed context in messages
  const messagesWithContext = manager.embedContextInMessages([...messages] as unknown as CoreMessage[]);
  
  // Extract context
  const extractedContext = manager.extractContextFromMessages(messagesWithContext as CoreMessage[]);
  
  // Verify extraction
  expect(extractedContext).toBeDefined();
  expect(extractedContext?.filesSearched).toContain("search-pattern");
});

// Test the orchestrator agent
test("OrchestratorAgent should create plans", async () => {
  // This is a simple test to ensure the agent instantiates
  // A full test would require mock responses for the AI calls
  const orchestrator = new OrchestratorAgent();
  expect(orchestrator).toBeDefined();
});

// Test the search agent
test("SearchAgent should handle search requests", async () => {
  // This is a simple test to ensure the agent instantiates
  // A full test would require mock responses for the AI calls
  const searchAgent = new SearchAgent();
  expect(searchAgent).toBeDefined();
});