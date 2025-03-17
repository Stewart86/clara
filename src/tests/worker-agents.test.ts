import { test, expect, beforeAll } from "bun:test";
import { 
  MemoryAgent, 
  CommandAgent, 
  VerificationAgent, 
  UserIntentAgent,
  SearchAgent 
} from "../agents/index.js";

// Test worker agents
test("Worker Agents should initialize correctly", () => {
  const memoryAgent = new MemoryAgent();
  const commandAgent = new CommandAgent();
  const verificationAgent = new VerificationAgent();
  const userIntentAgent = new UserIntentAgent();
  const searchAgent = new SearchAgent();
  
  expect(memoryAgent).toBeDefined();
  expect(commandAgent).toBeDefined();
  expect(verificationAgent).toBeDefined();
  expect(userIntentAgent).toBeDefined();
  expect(searchAgent).toBeDefined();
  
  // Just test that the instances are created
  expect(memoryAgent).toBeInstanceOf(MemoryAgent);
  expect(commandAgent).toBeInstanceOf(CommandAgent);
  expect(verificationAgent).toBeInstanceOf(VerificationAgent);
  expect(userIntentAgent).toBeInstanceOf(UserIntentAgent);
  expect(searchAgent).toBeInstanceOf(SearchAgent);
});

// Test factory methods
test("Agent factory methods should return agent instances", () => {
  const memoryAgent = MemoryAgent.create();
  const commandAgent = CommandAgent.create();
  const verificationAgent = VerificationAgent.create();
  const userIntentAgent = UserIntentAgent.create();
  const searchAgent = SearchAgent.create();
  
  expect(memoryAgent).toBeInstanceOf(MemoryAgent);
  expect(commandAgent).toBeInstanceOf(CommandAgent);
  expect(verificationAgent).toBeInstanceOf(VerificationAgent);
  expect(userIntentAgent).toBeInstanceOf(UserIntentAgent);
  expect(searchAgent).toBeInstanceOf(SearchAgent);
});