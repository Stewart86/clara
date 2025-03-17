import { z } from "zod";
import { log } from "../utils/logger.js";
import { BaseAgent, type AgentConfig } from "./base.js";

const getUserIntentAgentSystemPrompt = (): string => `You are a specialized User Intent Agent for Clara, responsible for deeply understanding user requests, extracting their underlying needs, and identifying the true objectives behind their questions. Your goal is to help Clara respond more accurately to what users are really trying to accomplish.

## Core Responsibilities
1. Analyzing user queries to identify explicit and implicit needs
2. Detecting the true objectives behind ambiguous or unclear requests
3. Classifying queries into appropriate categories for routing
4. Identifying priority information the user needs
5. Recognizing when users might be asking the wrong question
6. Suggesting better approaches when appropriate

## Intent Analysis Process
When analyzing user requests, you should:
1. Identify the surface-level request (what they explicitly asked for)
2. Infer deeper objectives (what they're trying to accomplish)
3. Recognize contextual clues that might reshape the interpretation
4. Identify important constraints or preferences
5. Determine the appropriate level of detail and technicality needed
6. Classify the query for proper routing to specialized agents

## Query Classification
You should classify queries into these categories:
- **Technical Information**: Questions about how code works, syntax, APIs, etc.
- **Architectural Understanding**: Questions about system design, component relationships, etc.
- **Bug Investigation**: Requests to understand or fix issues
- **Feature Development**: Requests to add or modify functionality
- **Business Logic**: Questions about how code implements business processes
- **Documentation**: Requests for explanation or documentation
- **Process/Workflow**: Questions about development or deployment processes
- **Performance**: Questions about speed, memory usage, efficiency
- **Security**: Questions about security concerns or best practices
- **UI/UX**: Questions about user interfaces or experience
- **Data**: Questions about data structures, databases, storage
- **Other**: Any queries that don't fit the above categories

## Analysis Techniques
Use these techniques to understand user intent:
1. **Keyword Analysis**: Identify significant words indicating domain, concern, or goal
2. **Context Assessment**: Consider previous interactions or project context
3. **Goal Inference**: Determine what success would look like for the user
4. **Knowledge Gap Identification**: Recognize what information they're missing
5. **Motivation Analysis**: Understand why they're asking this specific question
6. **Constraint Recognition**: Identify time, resource, or scope limitations

## Response Guidelines
Your analysis should include:
1. A clear restatement of what the user explicitly asked
2. Identification of implicit needs not directly stated
3. Classification of the query type
4. Recognition of important constraints or preferences
5. Suggestions for clarification if the request is ambiguous
6. Recommended approach for answering the query

Remember: Your goal is to help Clara provide the most helpful response possible, which sometimes means answering a better version of the question than what was literally asked.`;

/**
 * Schema for query analysis results
 */
const UserIntentSchema = z.object({
  explicitRequest: z.string().describe("What the user explicitly asked for"),
  implicitNeeds: z.array(z.string()).describe("Underlying needs implied but not directly stated"),
  queryClassification: z.object({
    primaryCategory: z.string().describe("Main category of the query"),
    secondaryCategories: z.array(z.string()).describe("Additional relevant categories"),
    confidence: z.number().min(0).max(100).describe("Confidence in the classification (0-100)")
  }),
  contextualFactors: z.array(z.string()).describe("Relevant contextual information that affects interpretation"),
  keyParameters: z.array(z.object({
    name: z.string().describe("Parameter name"),
    value: z.string().describe("Parameter value or description"),
    importance: z.enum(["critical", "high", "medium", "low"]).describe("How important this parameter is")
  })).describe("Parameters extracted from the query"),
  reformulatedQuery: z.string().describe("The query reformulated for clarity and precision"),
  suggestedApproach: z.object({
    strategy: z.string().describe("How to approach answering this query"),
    recommendedAgents: z.array(z.string()).describe("Which specialized agents should handle this"),
    informationNeeded: z.array(z.string()).describe("What information is needed to properly answer")
  })
});

/**
 * Enhanced User Intent Agent that implements the context-aware agent framework
 * Specialized in deeply understanding user requests and expectations
 */
export class UserIntentAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'userIntent',
      description: 'User Intent Analysis Agent',
      provider: 'openai',
      model: 'o3-mini',
      systemPrompt: getUserIntentAgentSystemPrompt(),
      tools: {},  // No special tools needed for intent analysis
      maxSteps: 1, // Usually a single inference step is sufficient
      reasoningEffort: 'high',
    };

    super(config);
  }

  /**
   * Analyze a user query to understand the true intent
   */
  public async analyzeIntent(query: string, conversationHistory?: string): Promise<string | object> {
    // Initialize operation in context
    const context = this.contextManager.getContext() || this.contextManager.createContext();
    
    log(`[UserIntentAgent] Analyzing query: ${query}`, "system");
    
    let prompt = `Please analyze this user query to understand the true intent:

USER QUERY: "${query}"

${conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}

I need a detailed analysis of:
1. What the user is explicitly asking for
2. What they might actually need (implicit needs)
3. How to classify this query
4. Any key parameters or constraints
5. How the query should be reformulated for clarity
6. The best approach to answering this query

Please return your analysis in the specified JSON format.`;

    try {
      // Generate structured intent analysis
      const intentAnalysis = await this.executeWithSchema(
        prompt,
        UserIntentSchema
      );
      
      // Store the analysis in context
      this.contextManager.storeResult('userIntent', intentAnalysis);
      
      return intentAnalysis;
    } catch (error) {
      log(
        `[UserIntentAgent Error] ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
      
      // Fall back to unstructured analysis
      try {
        const fallbackAnalysis = await this.execute(prompt);
        return fallbackAnalysis;
      } catch (fallbackError) {
        return `Error analyzing user intent: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  }

  /**
   * Format the intent analysis into a readable string
   */
  public formatIntentAnalysis(analysis: any): string {
    let output = `# User Intent Analysis\n\n`;
    
    // Explicit and implicit needs
    output += `## Request Understanding\n`;
    output += `**Explicit Request:** ${analysis.explicitRequest}\n\n`;
    
    output += `**Implicit Needs:**\n`;
    analysis.implicitNeeds.forEach((need: string, i: number) => {
      output += `${i + 1}. ${need}\n`;
    });
    output += '\n';
    
    // Query classification
    output += `## Query Classification\n`;
    output += `**Primary Category:** ${analysis.queryClassification.primaryCategory} (${analysis.queryClassification.confidence}% confidence)\n`;
    
    if (analysis.queryClassification.secondaryCategories && analysis.queryClassification.secondaryCategories.length > 0) {
      output += `**Secondary Categories:** ${analysis.queryClassification.secondaryCategories.join(', ')}\n`;
    }
    output += '\n';
    
    // Contextual factors if present
    if (analysis.contextualFactors && analysis.contextualFactors.length > 0) {
      output += `## Contextual Factors\n`;
      analysis.contextualFactors.forEach((factor: string, i: number) => {
        output += `- ${factor}\n`;
      });
      output += '\n';
    }
    
    // Key parameters if present
    if (analysis.keyParameters && analysis.keyParameters.length > 0) {
      output += `## Key Parameters\n`;
      analysis.keyParameters.forEach((param: any) => {
        output += `**${param.name}** (${param.importance}): ${param.value}\n`;
      });
      output += '\n';
    }
    
    // Reformulated query
    output += `## Reformulated Query\n`;
    output += `"${analysis.reformulatedQuery}"\n\n`;
    
    // Suggested approach
    output += `## Suggested Approach\n`;
    output += `**Strategy:** ${analysis.suggestedApproach.strategy}\n`;
    output += `**Recommended Agents:** ${analysis.suggestedApproach.recommendedAgents.join(', ')}\n`;
    
    output += `**Information Needed:**\n`;
    analysis.suggestedApproach.informationNeeded.forEach((info: string, i: number) => {
      output += `${i + 1}. ${info}\n`;
    });
    
    return output;
  }
  
  /**
   * Factory function for creating user intent agent
   */
  public static create(): UserIntentAgent {
    return new UserIntentAgent();
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function userIntentAgent(prompt: string): Promise<string> {
  const agent = new UserIntentAgent();
  try {
    return await agent.execute(prompt);
  } catch (error) {
    log(`[userIntentAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error while analyzing user intent: ${error}`;
  }
}