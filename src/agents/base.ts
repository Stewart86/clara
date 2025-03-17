import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  generateText,
  streamText,
  NoObjectGeneratedError,
  generateObject,
  type CoreMessage,
  type CoreUserMessage,
  type CoreSystemMessage,
} from "ai";
import { z } from "zod";
import { log } from "../utils/logger.js";
import { TokenTracker } from "../utils/tokenTracker.js";
import { ContextManager } from "../utils/agentContext.js";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import type { ToolSet } from "ai";

// Define a simple type for Anthropic model IDs as it's not exported
type AnthropicChatModelId = string;

// Type for agent configuration
export interface AgentConfig {
  name: string;
  description: string;
  provider: "openai" | "anthropic";
  model: OpenAIChatModelId | AnthropicChatModelId;
  systemPrompt: string;
  tools?: ToolSet;
  maxSteps?: number;
  streaming?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  enhancedVision?: boolean;
}

/**
 * Base agent class that provides context-aware execution for all agent types
 */
export class BaseAgent {
  protected config: AgentConfig;
  protected contextManager: ContextManager;
  protected tokenTracker: TokenTracker;

  constructor(config: AgentConfig) {
    this.config = config;
    this.contextManager = ContextManager.getInstance();
    this.tokenTracker = TokenTracker.getInstance();
  }

  /**
   * Create context-aware tools by wrapping the original tools with context tracking
   */
  protected getContextAwareTools(): ToolSet {
    if (!this.config.tools) return {};

    const contextAwareTools: ToolSet = {};

    for (const [toolName, originalTool] of Object.entries(this.config.tools)) {
      // Create a copy of the tool to be safe
      const toolCopy = { ...originalTool };

      // Skip any tools without an execute function
      if (!toolCopy || !toolCopy.execute) {
        continue;
      }

      // Store the execute function safely
      const executeFunc = toolCopy.execute;

      contextAwareTools[toolName] = {
        ...toolCopy,
        execute: async (params: any, executionContext: any) => {
          // Extract context from messages if available
          const context = this.contextManager.extractContextFromMessages(
            executionContext.messages || [],
          );

          if (context) {
            // Restore context
            this.contextManager.contextFromJson(JSON.stringify(context));
          }

          // Execute the original tool
          try {
            const result = await executeFunc(params, executionContext);

            // Track tool execution in context based on tool type
            this.trackToolExecution(toolName, params, result);

            // Update context in messages with appropriate level of detail
            if (executionContext.messages) {
              if (this.config.name === "orchestrator") {
                // Orchestrator gets the full context
                this.contextManager.embedContextInMessages(executionContext.messages);
              } else {
                // Worker agents get summarized context
                const currentContext = this.contextManager.getContext();
                if (currentContext) {
                  // Create a summarized context with only essential information
                  const summarizedContext = {
                    requestId: currentContext.requestId,
                    userId: currentContext.userId,
                    timestamp: currentContext.timestamp,
                    currentStep: currentContext.currentStep,
                    totalSteps: currentContext.totalSteps,
                    // Include only relevant plan information
                    plan: currentContext.plan ? {
                      taskCategory: currentContext.plan.taskCategory,
                      steps: currentContext.plan.steps.filter(step => 
                        step.id === currentContext.currentStep || 
                        (currentContext.plan?.steps.find(s => s.id === currentContext.currentStep)?.dependencies || []).includes(step.id)
                      )
                    } : null,
                    // Include essential results and latest action records
                    intermediateResults: {},
                    // Initialize all tracking fields to avoid undefined errors
                    filesSearched: currentContext.filesSearched || [],
                    filesRead: currentContext.filesRead ? 
                      Object.keys(currentContext.filesRead)
                        .slice(-3)
                        .reduce((obj, key) => {
                          obj[key] = currentContext.filesRead[key];
                          return obj;
                        }, {} as typeof currentContext.filesRead) : {},
                    commandsExecuted: currentContext.commandsExecuted ? currentContext.commandsExecuted.slice(-3) : [],
                    webSearches: currentContext.webSearches ? currentContext.webSearches.slice(-3) : [],
                    memoryCreated: currentContext.memoryCreated || [],
                    memoryRead: currentContext.memoryRead || [],
                    errors: currentContext.errors || [],
                    tokenUsage: currentContext.tokenUsage || {},
                  };
                  
                  // Only include dependency results in the context
                  if (currentContext.plan) {
                    const currentStepObj = currentContext.plan.steps.find(s => s.id === currentContext.currentStep);
                    if (currentStepObj && currentStepObj.dependencies) {
                      for (const depId of currentStepObj.dependencies) {
                        const depStep = currentContext.plan.steps.find(s => s.id === depId);
                        if (depStep && depStep.result) {
                          summarizedContext.intermediateResults[`step_${depId}`] = depStep.result;
                        }
                      }
                    }
                  }
                  
                  // Replace the full context with summarized version for worker agents
                  const contextJson = JSON.stringify(summarizedContext);
                  const contextMessage = `__CONTEXT_START__${contextJson}__CONTEXT_END__`;
                  
                  // Find and replace or add context message
                  const contextIndex = executionContext.messages.findIndex(msg => {
                    const content = msg.content;
                    if (typeof content === "string") {
                      return (
                        content.includes("__CONTEXT_START__") &&
                        content.includes("__CONTEXT_END__")
                      );
                    }
                    return false;
                  });
                  
                  if (contextIndex >= 0) {
                    // Update existing context message
                    executionContext.messages[contextIndex] = {
                      ...executionContext.messages[contextIndex],
                      content: contextMessage,
                    };
                  } else {
                    // Add new context message
                    executionContext.messages.push({
                      role: "system",
                      content: contextMessage,
                    });
                  }
                }
              }
            }

            return result;
          } catch (error) {
            // Record error in context
            this.contextManager.recordError(
              this.contextManager.getContext()?.currentStep || 0,
              error instanceof Error ? error.message : String(error),
            );

            // Re-throw the error
            throw error;
          }
        },
      };
    }

    return contextAwareTools;
  }

  /**
   * Track tool execution based on tool type
   */
  private trackToolExecution(toolName: string, params: any, result: any): void {
    const context = this.contextManager.getContext();
    if (!context) return;

    switch (toolName) {
      case "readFileTool":
        this.contextManager.recordFileRead(
          params.filePath,
          params.lineRange
            ? [params.lineRange.start, params.lineRange.end]
            : null,
        );
        break;
      case "fileAndContentSearchAgent":
      case "searchTool":
        this.contextManager.recordFileSearch(params.prompt);
        break;
      case "commandTool":
        const exitCode =
          typeof result === "string" && result.includes("exit=")
            ? parseInt(result.split("exit=")[1])
            : 0;
        this.contextManager.recordCommand(params.command, result, exitCode);
        break;
      case "webSearchAgent":
        this.contextManager.recordWebSearch(params.query, result);
        break;
      case "writeMemoryTool":
        this.contextManager.recordMemoryCreation(params.filePath);
        break;
      case "readMemoryTool":
        this.contextManager.recordMemoryRead(params.memoryPath);
        break;
    }
  }

  /**
   * Execute agent with context awareness
   */
  public async execute(
    userPrompt: string,
    additionalContext?: string,
  ): Promise<string> {
    // Initialize or retrieve context
    let context = this.contextManager.getContext();
    if (!context) {
      context = this.contextManager.createContext();
    }

    // Prepare messages with context
    const messages: CoreMessage[] = [
      {
        role: "system",
        content: this.config.systemPrompt,
      } as CoreSystemMessage,
      {
        role: "user",
        content: `${userPrompt}${additionalContext ? `\nAdditional context: ${additionalContext}` : ""}`,
      } as CoreUserMessage,
    ];

    // Embed context in messages - but only include a summarized version for non-orchestrator agents
    if (this.config.name !== "orchestrator") {
      // Create a summarized context with only essential information
      const currentContext = this.contextManager.getContext();
      if (currentContext) {
        const summarizedContext = {
          requestId: currentContext.requestId,
          userId: currentContext.userId,
          timestamp: currentContext.timestamp,
          currentStep: currentContext.currentStep,
          totalSteps: currentContext.totalSteps,
          // Include only the current step's dependencies from the plan if applicable
          plan: currentContext.plan ? {
            taskCategory: currentContext.plan.taskCategory,
            steps: currentContext.plan.steps.filter(step => 
              step.id === currentContext.currentStep || 
              (currentContext.plan?.steps.find(s => s.id === currentContext.currentStep)?.dependencies || []).includes(step.id)
            )
          } : null,
          // Include only relevant results needed for this step
          intermediateResults: {},
          // Initialize all required fields to avoid undefined errors
          filesSearched: currentContext.filesSearched || [],
          filesRead: currentContext.filesRead || {},
          commandsExecuted: currentContext.commandsExecuted || [],
          webSearches: currentContext.webSearches || [],
          memoryCreated: currentContext.memoryCreated || [],
          memoryRead: currentContext.memoryRead || [],
          errors: currentContext.errors || [],
          tokenUsage: currentContext.tokenUsage || {},
        };
        
        // Only include dependencies' results in the context
        if (currentContext.plan) {
          const currentStepObj = currentContext.plan.steps.find(s => s.id === currentContext.currentStep);
          if (currentStepObj && currentStepObj.dependencies) {
            for (const depId of currentStepObj.dependencies) {
              const depStep = currentContext.plan.steps.find(s => s.id === depId);
              if (depStep && depStep.result) {
                summarizedContext.intermediateResults[`step_${depId}`] = depStep.result;
              }
            }
          }
        }
        
        // Replace the full context with summarized version for worker agents
        const contextJson = JSON.stringify(summarizedContext);
        const contextMessage = `__CONTEXT_START__${contextJson}__CONTEXT_END__`;
        
        // Add summarized context to messages
        messages.push({
          role: "system",
          content: contextMessage,
        } as CoreMessage);
      }
    } else {
      // For orchestrator, keep full context for comprehensive planning
      this.contextManager.embedContextInMessages(messages);
    }

    try {
      // Execute with appropriate provider
      if (this.config.streaming) {
        return await this.executeStreaming(messages);
      } else {
        return await this.executeStandard(messages);
      }
    } catch (error) {
      // Handle errors
      log(
        `[${this.config.name} Error] ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      this.contextManager.recordError(
        context.currentStep,
        error instanceof Error ? error.message : String(error),
      );
      return `Error in ${this.config.name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Execute agent with standard (non-streaming) output
   */
  private async executeStandard(messages: CoreMessage[]): Promise<string> {
    const model = this.getModelForProvider();
    log(
      `[${this.config.name}] Generating response with ${this.config.model}`,
      "system",
    );

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    // Retry logic with exponential backoff
    while (retryCount < maxRetries) {
      try {
        const response = await generateText({
          model,
          providerOptions: this.getProviderOptions(),
          tools: this.getContextAwareTools(),
          maxSteps: this.config.maxSteps || 10,
          messages,
        });

        const { text } = response;

        // Track token usage
        this.trackTokenUsage(response);

        log(
          `[${this.config.name}] Response generated successfully (${text.length} chars)`,
          "system",
        );
        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a rate limit error
        const errorMessage = lastError.message;
        if (errorMessage.includes("Rate limit") || errorMessage.includes("rate_limit")) {
          retryCount++;
          
          // Extract wait time from error message if available, otherwise use exponential backoff
          let waitTime = 0;
          const waitTimeMatch = errorMessage.match(/try again in (\d+)ms/i);
          if (waitTimeMatch && waitTimeMatch[1]) {
            waitTime = parseInt(waitTimeMatch[1], 10);
            // Add a small buffer to the suggested wait time
            waitTime += 100;
          } else {
            // Exponential backoff with jitter: 2^retryCount * 1000 + random(0-1000)ms
            waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          }
          
          log(
            `[${this.config.name}] Rate limit hit, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`,
            "system"
          );
          
          // Wait for the specified time
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // If it's not a rate limit error, throw immediately
        throw error;
      }
    }
    
    // If we've exhausted retries, throw the last error
    if (lastError) {
      log(
        `[${this.config.name} Error] Failed after ${maxRetries} attempts. Last error: ${lastError.message}`,
        "error"
      );
      throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
    }
    
    // This should never happen but TypeScript needs it
    throw new Error("Unexpected execution path in executeStandard");
  }

  /**
   * Execute agent with streaming output
   */
  private async executeStreaming(messages: CoreMessage[]): Promise<string> {
    const model = this.getModelForProvider();
    log(
      `[${this.config.name}] Streaming response with ${this.config.model}`,
      "system",
    );

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    // Retry logic with exponential backoff
    while (retryCount < maxRetries) {
      try {
        const stream = streamText({
          model,
          providerOptions: this.getProviderOptions(),
          tools: this.getContextAwareTools(),
          maxSteps: this.config.maxSteps || 10,
          messages,
        });

        let fullText = "";
        // Handle the stream - since streamText is properly typed by Vercel AI SDK
        // we need to work with it carefully
        const streamResult = stream;
        for await (const chunk of streamResult.textStream) {
          fullText += chunk;
          // Could implement UI updates here
        }

        // Token usage is not available with streaming, so estimate
        const promptTokenEstimate = Math.ceil(
          messages.reduce((acc, msg) => {
            const content = msg.content;
            // Handle content that might be a string or an array of parts
            return acc + (typeof content === "string" ? content.length : 200);
          }, 0) / 4,
        );
        const completionTokenEstimate = Math.ceil(fullText.length / 4);
        this.tokenTracker.recordTokenUsage(
          this.config.name,
          promptTokenEstimate,
          completionTokenEstimate,
          this.config.model,
        );

        // Update context with estimated token usage
        this.contextManager.updateTokenUsage(
          this.config.name,
          promptTokenEstimate,
          completionTokenEstimate,
          this.config.model,
        );

        log(
          `[${this.config.name}] Stream completed successfully (${fullText.length} chars)`,
          "system",
        );
        return fullText;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a rate limit error
        const errorMessage = lastError.message;
        if (errorMessage.includes("Rate limit") || errorMessage.includes("rate_limit")) {
          retryCount++;
          
          // Extract wait time from error message if available, otherwise use exponential backoff
          let waitTime = 0;
          const waitTimeMatch = errorMessage.match(/try again in (\d+)ms/i);
          if (waitTimeMatch && waitTimeMatch[1]) {
            waitTime = parseInt(waitTimeMatch[1], 10);
            // Add a small buffer to the suggested wait time
            waitTime += 100;
          } else {
            // Exponential backoff with jitter: 2^retryCount * 1000 + random(0-1000)ms
            waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          }
          
          log(
            `[${this.config.name}] Rate limit hit, retrying streaming in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`,
            "system"
          );
          
          // Wait for the specified time
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // If it's not a rate limit error, log and rethrow
        log(`[${this.config.name}] Stream error: ${lastError.message}`, "error");
        throw lastError;
      }
    }
    
    // If we've exhausted retries, throw the last error
    if (lastError) {
      log(
        `[${this.config.name} Error] Failed streaming after ${maxRetries} attempts. Last error: ${lastError.message}`,
        "error"
      );
      throw new Error(`Failed streaming after ${maxRetries} attempts. Last error: ${lastError.message}`);
    }
    
    // This should never happen but TypeScript needs it
    throw new Error("Unexpected execution path in executeStreaming");
  }

  /**
   * Execute agent with structured output using Zod schema
   */
  public async executeWithSchema<T>(
    userPrompt: string,
    schema: z.ZodType<T>,
    additionalContext?: string,
  ): Promise<T> {
    log(
      `[${this.config.name}] Processing with schema: ${userPrompt}`,
      "system",
    );

    // Initialize or retrieve context
    let context = this.contextManager.getContext();
    if (!context) {
      context = this.contextManager.createContext();
    }

    // Prepare messages with context
    const messages: CoreMessage[] = [
      {
        role: "system",
        content: this.config.systemPrompt,
      } as CoreSystemMessage,
      {
        role: "user",
        content: `${userPrompt}${additionalContext ? `\nAdditional context: ${additionalContext}` : ""}`,
      } as CoreUserMessage,
    ];

    // Embed context in messages
    this.contextManager.embedContextInMessages(messages);

    try {
      const model = this.getModelForProvider();
      log(
        `[${this.config.name}] Generating structured response with ${this.config.model}`,
        "system",
      );

      // Cast to any to satisfy TypeScript - in reality, the Vercel AI SDK does support the schema parameter
      const params: any = {
        model,
        schema,
        providerOptions: this.getProviderOptions(),
        tools: this.getContextAwareTools(),
        maxSteps: this.config.maxSteps || 10,
        messages,
      };

      const maxRetries = 3;
      let retryCount = 0;
      let lastError: Error | null = null;
      
      // Retry logic with exponential backoff
      while (retryCount < maxRetries) {
        try {
          const response = await generateObject(params);
          
          // Track token usage
          if (response.usage) {
            this.tokenTracker.recordTokenUsage(
              this.config.name,
              response.usage.promptTokens || 0,
              response.usage.completionTokens || 0,
              this.config.model,
            );
    
            // Update context with token usage
            this.contextManager.updateTokenUsage(
              this.config.name,
              response.usage.promptTokens || 0,
              response.usage.completionTokens || 0,
              this.config.model,
            );
          }
    
          log(
            `[${this.config.name}] Structured response generated successfully`,
            "system",
          );
          // We need to cast here because TypeScript doesn't know that the schema will validate to T
          return response.object as T;
        } catch (error) {
          // Special handling for NoObjectGeneratedError - this is not a rate limit issue
          // but a schema validation issue, so we should not retry
          if (error instanceof NoObjectGeneratedError) {
            log(
              `[${this.config.name}] Failed to generate valid object. Partial output: ${error.text}`,
              "error",
            );
            this.contextManager.recordError(
              context.currentStep,
              `Schema validation failed: ${error.message}`,
              error.text,
            );
            throw error;
          }
          
          // For other errors, check if it's rate limit related
          lastError = error instanceof Error ? error : new Error(String(error));
          const errorMessage = lastError.message;
          
          if (errorMessage.includes("Rate limit") || errorMessage.includes("rate_limit")) {
            retryCount++;
            
            // Extract wait time from error message if available, otherwise use exponential backoff
            let waitTime = 0;
            const waitTimeMatch = errorMessage.match(/try again in (\d+)ms/i);
            if (waitTimeMatch && waitTimeMatch[1]) {
              waitTime = parseInt(waitTimeMatch[1], 10);
              // Add a small buffer to the suggested wait time
              waitTime += 100;
            } else {
              // Exponential backoff with jitter: 2^retryCount * 1000 + random(0-1000)ms
              waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            }
            
            log(
              `[${this.config.name}] Rate limit hit, retrying schema generation in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`,
              "system"
            );
            
            // Wait for the specified time
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // If it's not a rate limit error, log and rethrow
          log(
            `[${this.config.name} Error] ${lastError.message}`,
            "error",
          );
          this.contextManager.recordError(
            context.currentStep,
            lastError.message,
          );
          throw lastError;
        }
      }
      
      // If we've exhausted retries, throw the last error
      if (lastError) {
        log(
          `[${this.config.name} Error] Failed schema generation after ${maxRetries} attempts. Last error: ${lastError.message}`,
          "error"
        );
        throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
      }
      
      // This should never happen but TypeScript needs it
      throw new Error("Unexpected execution path in executeWithSchema");
    } catch (error) {
      // Handle NoObjectGeneratedError with recovery - this is already handled above, but catch other errors here
      if (error instanceof NoObjectGeneratedError) {
        log(
          `[${this.config.name}] Failed to generate valid object. Partial output: ${error.text}`,
          "error",
        );
        this.contextManager.recordError(
          context.currentStep,
          `Schema validation failed: ${error.message}`,
          error.text,
        );
      } else {
        log(
          `[${this.config.name} Error] ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
        this.contextManager.recordError(
          context.currentStep,
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  }

  /**
   * Get the appropriate model provider
   */
  private getModelForProvider() {
    if (this.config.provider === "anthropic") {
      return anthropic(this.config.model as AnthropicChatModelId);
    } else {
      return openai(this.config.model as OpenAIChatModelId);
    }
  }

  /**
   * Get provider-specific options
   */
  private getProviderOptions(): Record<string, Record<string, any>> {
    if (this.config.provider === "anthropic") {
      return {
        anthropic: {
          maximumDesignTokens:
            this.config.reasoningEffort === "high"
              ? 30000
              : this.config.reasoningEffort === "medium"
                ? 20000
                : 10000,
        },
        // Add empty openai to satisfy type requirement
        openai: {},
      };
    } else {
      // OpenAI provider options
      const openaiOptions: Record<string, any> = {
        enhancedVision: this.config.enhancedVision || false,
      };

      // Only add reasoningEffort for o-series models (o1, o3-mini)
      // gpt-4o-mini does not support reasoningEffort
      if (
        this.config.reasoningEffort &&
        (this.config.model === "o1" ||
          this.config.model === "o3-mini" ||
          this.config.model.startsWith("o1-") ||
          this.config.model.startsWith("o3-"))
      ) {
        openaiOptions.reasoningEffort = this.config.reasoningEffort;
      }

      return {
        openai: openaiOptions,
        // Add empty anthropic to satisfy type requirement
        anthropic: {},
      };
    }
  }

  /**
   * Track token usage from response
   */
  private trackTokenUsage(response: {
    usage?: { promptTokens?: number; completionTokens?: number };
  }) {
    if (response.usage) {
      // Record in token tracker
      this.tokenTracker.recordTokenUsage(
        this.config.name,
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
        this.config.model,
      );

      // Update context with token usage
      this.contextManager.updateTokenUsage(
        this.config.name,
        response.usage.promptTokens || 0,
        response.usage.completionTokens || 0,
        this.config.model,
      );
    }
  }
}
