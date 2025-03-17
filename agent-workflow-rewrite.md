# Clara Agent Workflow Rewrite

This document outlines the comprehensive plan for rewriting the Clara agent workflow system to improve agent coordination, context awareness, and overall effectiveness.

## 1. Architecture Overview

### Core Architecture: Adaptive Orchestration with Context Awareness

We will implement an adaptive orchestration model that combines the best aspects of orchestrator-worker patterns with dynamic context routing. This architecture:

1. Maintains a central orchestrator that coordinates all activities
2. Passes rich context objects between specialized agents
3. Uses a shared execution context for full workflow awareness
4. Implements dynamic routing based on task requirements

### Key Components:

- **Central Orchestrator Agent**: High-level controller using o3-mini for efficient planning
- **Context Manager**: Core system component that maintains workflow state
- **Specialized Worker Agents**: Task-specific agents optimized for particular functions
- **Memory System**: Enhanced file-based storage with improved indexing
- **Evaluation Layer**: Quality control system for reviewing agent outputs

## 2. Context Management System

The new context awareness system will be implemented as a TypeScript class that:

```typescript
interface AgentContext {
  // Request tracking
  requestId: string;
  userId: string;
  timestamp: string;
  
  // Workflow state
  currentStep: number;
  totalSteps: number;
  plan: AgentPlan;
  
  // Resource tracking
  filesSearched: string[];
  filesRead: Record<string, { path: string, lineRanges: Array<[number, number]> }>;
  commandsExecuted: Array<{ command: string, result: string, exitCode: number }>;
  webSearches: Array<{ query: string, result: string }>;
  
  // Memory interaction
  memoryCreated: string[];
  memoryRead: string[];
  
  // Results and state
  intermediateResults: Record<string, any>;
  errors: Array<{ step: number, error: string, recovery?: string }>;
  
  // Token usage tracking
  tokenUsage: Record<string, { prompt: number, completion: number, model: string }>;
}
```

This context will be:
1. Created at the start of each request
2. Passed to each tool and agent call via Vercel AI SDK 4.1's context parameter
3. Updated after each operation
4. Used to inform agent decisions and prevent redundant operations

## 3. Agent Specialization & Coordination

### Orchestrator Agent (Enhanced Planner)

The orchestrator will be responsible for:
- Analyzing user requests using the existing planner's approach
- Creating detailed execution plans with step dependencies
- Selecting appropriate worker agents for each task
- Maintaining the overall workflow state
- Making decisions based on intermediate results

**Model**: OpenAI o3-mini

### Specialized Worker Agents

#### 1. Search Agent
- **Purpose**: Finding files and content in the codebase
- **Features**:
  - Incremental search strategies (breadth → depth)
  - Result caching with context
  - Prioritization based on file metadata
- **Model**: Parser-optimized mini model (o4-mini)

#### 2. Memory Management Agent
- **Purpose**: Organizing and managing Clara's knowledge system
- **Features**:
  - Automatic categorization of information
  - Metadata tagging for improved retrieval
  - File indexing for fast lookups
  - Cross-referencing between related memory files
- **Model**: OpenAI o3-mini

#### 3. Command Execution Agent
- **Purpose**: Running and interpreting shell commands safely
- **Features**:
  - Enhanced security validation
  - Result parsing and summarization
  - Command composition based on goals
  - Error recovery strategies
- **Model**: OpenAI o3-mini

#### 4. Verification Agent
- **Purpose**: Validating outputs and results for accuracy
- **Features**:
  - Fact-checking against codebase
  - Self-consistency evaluation
  - Error detection and correction suggestions
  - Quality metrics for responses
- **Model**: OpenAI o3-mini

#### 5. User Intent Agent
- **Purpose**: Deeply understanding user requests and expectations
- **Features**:
  - Query classification
  - Intent decomposition
  - Priority identification
  - Implicit need detection
- **Model**: OpenAI o3-mini or Claude-3 Haiku

## 4. Tool Enhancement Strategy

We'll refactor the existing tools to support context awareness:

```typescript
// Example of context-aware tool implementation
const searchTool: Tool = tool({
  description: "Enhanced search for files or content in the project",
  parameters: z.object({
    prompt: z.string(),
    // No context parameter here - it's injected by Vercel AI SDK
  }),
  execute: async ({ prompt }, { messages, abortSignal, toolCallId, conversationId }) => {
    // Extract full context from messages
    const context = extractContextFromMessages(messages);
    
    // Update context with this operation
    context.filesSearched.push(prompt);
    
    // Execute search with awareness of previously searched files
    const result = await enhancedSearch(prompt, context.filesSearched);
    
    // Update context with results before returning
    updateContextInMessages(messages, context);
    
    return result;
  },
});
```

This approach leverages Vercel AI SDK 4.1's ability to inject message history and context into tool executions.

## 5. Memory System Enhancements

While maintaining the file-based approach, we'll enhance the memory system with:

1. **Structured Metadata**:
   - Each memory file will include a YAML frontmatter section
   - Metadata will include creation date, last update, related topics, etc.

2. **Indexing Layer**:
   - Create a lightweight index of memory content for faster retrieval
   - Implement term frequency tracking for better search

3. **Relationship Mapping**:
   - Track connections between related memory files
   - Create visual relationship maps for complex topics

4. **Automated Organization**:
   - Agent-driven folder structure optimization
   - Periodic consolidation of related information

## 6. Implementation Roadmap

### Phase 1: Core Infrastructure
1. Create `AgentContext` management system
2. Implement context-passing in base agent framework
3. Refactor existing planner as orchestrator agent
4. Develop tool enhancement layer for context awareness

### Phase 2: Worker Agent Development
1. Enhance and refactor existing search agent
2. Create memory management agent
3. Implement command execution agent
4. Build verification agent framework
5. Add user intent agent

### Phase 3: Integration & Testing ✅
1. Connect orchestrator with worker agents through agent registry
2. Implement decision-making logic for task routing with dependency management
3. Create comprehensive testing framework with integration tests
4. Validate context maintenance across complex workflows
5. Implement memory update checkpoints

### Phase 4: Memory & Optimization
1. Enhance file-based memory system
2. Add metadata and indexing layer
3. Implement relationship tracking
4. Optimize token usage across agent interactions

## 7. Technical Implementation Details

### Vercel AI SDK Integration

We'll leverage the latest Vercel AI SDK 4.1 features:

1. **Context Injection**:
   ```typescript
   const response = await generateText({
     model: openai('o3-mini'),
     messages: [...], // Includes context
     tools: getContextAwareTools(),
     maxSteps: 10,
   });
   ```

2. **Error Recovery**:
   ```typescript
   try {
     const result = await generateObject({
       schema: responseSchema,
       // ...
     });
   } catch (error) {
     if (error instanceof NoObjectGeneratedError) {
       // Recovery logic with access to partial output
       const recovery = await recoverFromError(error.text);
       context.errors.push({
         step: context.currentStep,
         error: error.message,
         recovery: recovery
       });
     }
   }
   ```

3. **Streaming Implementation**:
   ```typescript
   const stream = streamText({
     model: openai('o3-mini'),
     messages: contextualizedMessages,
     // ...
   });
   
   // Handle streaming updates to UI
   for await (const chunk of stream) {
     // Process chunk
     updateUI(chunk);
   }
   ```

### Type System Improvements

We'll enhance the type system with:

1. Zod schemas for all agent inputs/outputs
2. TypeScript interfaces for context objects
3. Strong typing for memory structure
4. Runtime type validation for context updates

## 8. Evaluation Framework

To ensure the system works effectively, we'll implement:

1. **Task Completion Metrics**:
   - Success rate on different request types
   - Completion time measurements
   - Token efficiency tracking

2. **Agent Performance Evaluation**:
   - Accuracy of search results
   - Quality of memory organization
   - Command execution success rate

3. **User Experience Measures**:
   - Response quality scoring
   - Context retention effectiveness
   - Learning curve metrics

## Primary Goals

1. **Knowledge Management:** Enhanced system for adding and updating knowledge gained from reading codebases and GitHub Issues.
2. **Project Helpdesk Support:** Improved capability for answering feature inquiries and triaging bug/user reports.
3. **Project Management:** Optimized integration with `gh` CLI for issue management and other GitHub operations.

## Secondary Goals

1. Minor bug fixes and performance optimizations
2. Improved user experience through more coherent agent interactions
3. Better handling of complex, multi-part requests

---

**Notes:**
- This rewrite should be implemented on a new branch
- Each component should be fully tested before integration
- We should maintain backward compatibility where possible
- Documentation should be updated alongside implementation
