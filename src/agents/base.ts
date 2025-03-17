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

            // Update context in messages
            if (executionContext.messages) {
              this.contextManager.embedContextInMessages(
                executionContext.messages,
              );
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
    log(`[${this.config.name}] Processing: ${userPrompt}`, "system");

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

    const stream = streamText({
      model,
      providerOptions: this.getProviderOptions(),
      tools: this.getContextAwareTools(),
      maxSteps: this.config.maxSteps || 10,
      messages,
    });

    let fullText = "";
    try {
      // Handle the stream - since streamText is properly typed by Vercel AI SDK
      // we need to work with it carefully
      const streamResult = await stream;
      for await (const chunk of streamResult.textStream) {
        fullText += chunk;
        // Could implement UI updates here
      }
    } catch (error) {
      log(`[${this.config.name}] Stream error: ${error}`, "error");
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
      // Handle NoObjectGeneratedError with recovery
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
      return {
        openai: {
          reasoningEffort: this.config.reasoningEffort || "medium",
          enhancedVision: this.config.enhancedVision || false,
        },
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
