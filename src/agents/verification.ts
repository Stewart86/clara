import { z } from "zod";
import { tool as aiTool } from "ai";
import { log } from "../utils/logger.js";
import { BaseAgent, type AgentConfig } from "./base.js";
import { readFile } from "../tools/fileReader.js";
import { readMemory } from "../tools/memoryReader.js";

const getVerificationAgentSystemPrompt = (): string => `You are a specialized Verification Agent for Clara, responsible for validating information, checking code, and ensuring the accuracy of outputs provided by other agents. Your goal is to act as a quality control system, helping to maintain the reliability and trustworthiness of Clara's outputs.

## Core Responsibilities
1. Fact-checking information against codebase content
2. Validating code for correctness and compatibility
3. Checking for logical inconsistencies in explanations or analyses
4. Evaluating the quality and relevance of outputs
5. Detecting potential errors or misunderstandings
6. Providing correction suggestions when issues are found

## Verification Process
When verifying outputs, you should:
1. Identify claims or statements that need verification
2. Collect relevant evidence from the codebase or memory
3. Compare the claims against the evidence
4. Assess the accuracy and completeness of the information
5. Determine the level of confidence in each verification
6. Provide correction suggestions for any inaccuracies

## Types of Verification
You should perform different types of verification depending on the content:

### Technical Verification
- Check if code examples match the actual codebase implementation
- Verify that APIs are described correctly (parameters, return types, etc.)
- Ensure that architectural descriptions match the actual structure
- Validate that dependencies and versions are correctly identified

### Logical Verification
- Check for internal consistency in explanations
- Identify contradictions or conflicting statements
- Assess whether conclusions logically follow from premises
- Look for gaps or missing important information

### Contextual Verification
- Ensure that explanations are relevant to the user's question
- Verify that the level of detail is appropriate
- Check that the scope of information is neither too broad nor too narrow
- Ensure that priority information is emphasized appropriately

## Output Format
Your verification reports should include:
1. Overall assessment of accuracy
2. Specific verified claims with corresponding evidence
3. Any inaccuracies or inconsistencies found
4. Suggested corrections with supporting evidence
5. Confidence level for each verification

## Important Guidelines
1. Be thorough but practical in your verification process
2. Focus on material errors rather than minor stylistic issues
3. Always provide evidence for your assessments
4. Use direct quotes from the codebase when possible
5. Recognize the limits of your verification capabilities
6. Be constructive in your feedback and suggestions
7. Balance accuracy with usefulness to the user
`;

/**
 * Schema for verification results
 */
const VerificationResultSchema = z.object({
  overallAssessment: z.object({
    accuracy: z.number().min(0).max(100).describe("Overall accuracy percentage from 0-100"),
    confidence: z.number().min(0).max(100).describe("Confidence in the verification from 0-100"),
    summary: z.string().describe("Brief summary of the verification results")
  }),
  verifiedClaims: z.array(z.object({
    claim: z.string().describe("The specific claim or statement being verified"),
    evidence: z.string().describe("Evidence supporting or refuting the claim"),
    accurate: z.boolean().describe("Whether the claim is accurate based on evidence"),
    confidence: z.number().min(0).max(100).describe("Confidence level for this specific verification")
  })),
  inaccuracies: z.array(z.object({
    statement: z.string().describe("The inaccurate statement"),
    issue: z.string().describe("Description of what's incorrect"),
    correction: z.string().describe("Suggested correction"),
    evidence: z.string().describe("Evidence supporting the correction")
  })).optional(),
  suggestions: z.array(z.string()).optional().describe("Additional suggestions for improving accuracy or quality"),
  limitations: z.array(z.string()).optional().describe("Limitations or constraints of this verification")
});

/**
 * Enhanced Verification Agent that implements the context-aware agent framework
 * Specialized in validating outputs and results for accuracy
 */
export class VerificationAgent extends BaseAgent {
  constructor() {
    const readFileTool = aiTool({
      description: "Reads the contents of a specified file",
      parameters: z.object({
        filePath: z.string().describe("Name or path of the file to read"),
        directory: z.string().optional().describe("Directory to search in, defaults to current directory"),
        lineRange: z.object({
          start: z.number().describe("Start line number"),
          end: z.number().describe("End line number"),
        }).optional().describe('Optional range of lines to read'),
        readEntireFile: z.boolean().optional().describe("Force reading the entire file, even if it's large"),
      }),
      execute: async ({ filePath, directory, lineRange, readEntireFile }) => {
        return await readFile(filePath, directory || ".", lineRange || null, readEntireFile || false);
      },
    });

    const readMemoryTool = aiTool({
      description: "Lists all memory files available in a specified directory of Clara's memory system",
      parameters: z.object({
        memoryPath: z.string().describe("Simple relative path to memory directory. For example: 'codebase', 'insights', 'technical'"),
        projectPath: z.string().optional().describe("Optional project path if different from current project"),
      }),
      execute: async ({ memoryPath, projectPath }) => {
        return await readMemory(memoryPath || "", projectPath || "");
      },
    });

    const config: AgentConfig = {
      name: 'verification',
      description: 'Output Verification and Quality Control Agent',
      provider: 'openai',
      model: 'o3-mini',
      systemPrompt: getVerificationAgentSystemPrompt(),
      tools: {
        readFileTool,
        readMemoryTool,
      },
      maxSteps: 20,
      reasoningEffort: 'high',
    };

    super(config);
  }

  /**
   * Verify a piece of information against the codebase
   */
  public async verifyInformation(information: string, context?: string): Promise<string> {
    // Initialize operation in context
    const ctx = this.contextManager.getContext() || this.contextManager.createContext();
    
    log(`[VerificationAgent] Verifying information`, "system");
    
    let prompt = `I need to verify the accuracy of the following information:

===== INFORMATION TO VERIFY =====
${information}
===== END OF INFORMATION =====

${context ? `Context for verification:\n${context}\n` : ''}

Please:
1. Identify the key claims in this information that need verification
2. Use available tools to gather evidence from the codebase or memory
3. Compare the claims against the evidence
4. Assess the accuracy of each claim
5. Provide a detailed verification report

Return your verification in the specified JSON format.`;

    try {
      // Generate structured verification result
      const verificationResult = await this.executeWithSchema(
        prompt,
        VerificationResultSchema
      );
      
      return this.formatVerificationResult(verificationResult);
    } catch (error) {
      log(
        `[VerificationAgent Error] ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
      return `Error verifying information: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Format the verification result object into a readable string
   */
  private formatVerificationResult(result: any): string {
    let output = `# Verification Report\n\n`;
    
    // Overall assessment
    output += `## Overall Assessment\n`;
    output += `**Accuracy:** ${result.overallAssessment.accuracy}%\n`;
    output += `**Confidence:** ${result.overallAssessment.confidence}%\n`;
    output += `**Summary:** ${result.overallAssessment.summary}\n\n`;
    
    // Verified Claims
    output += `## Verified Claims\n`;
    result.verifiedClaims.forEach((claim: any, i: number) => {
      output += `### Claim ${i + 1}:\n`;
      output += `**Statement:** ${claim.claim}\n`;
      output += `**Evidence:** ${claim.evidence}\n`;
      output += `**Accuracy:** ${claim.accurate ? '✅ Accurate' : '❌ Inaccurate'}\n`;
      output += `**Confidence:** ${claim.confidence}%\n\n`;
    });
    
    // Inaccuracies if present
    if (result.inaccuracies && result.inaccuracies.length > 0) {
      output += `## Inaccuracies Found\n`;
      result.inaccuracies.forEach((inaccuracy: any, i: number) => {
        output += `### Inaccuracy ${i + 1}:\n`;
        output += `**Statement:** ${inaccuracy.statement}\n`;
        output += `**Issue:** ${inaccuracy.issue}\n`;
        output += `**Correction:** ${inaccuracy.correction}\n`;
        output += `**Evidence:** ${inaccuracy.evidence}\n\n`;
      });
    }
    
    // Suggestions if present
    if (result.suggestions && result.suggestions.length > 0) {
      output += `## Suggestions for Improvement\n`;
      result.suggestions.forEach((suggestion: string, i: number) => {
        output += `${i + 1}. ${suggestion}\n`;
      });
      output += '\n';
    }
    
    // Limitations if present
    if (result.limitations && result.limitations.length > 0) {
      output += `## Verification Limitations\n`;
      result.limitations.forEach((limitation: string, i: number) => {
        output += `- ${limitation}\n`;
      });
    }
    
    return output;
  }
  
  /**
   * Verify code against language standards and codebase conventions
   */
  public async verifyCode(code: string, language: string, filepath?: string): Promise<string> {
    log(`[VerificationAgent] Verifying ${language} code`, "system");
    
    let prompt = `I need to verify the correctness of the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

${filepath ? `This code is intended for: ${filepath}` : ''}

Please:
1. Check the code for syntax errors
2. Verify logic and potential bugs
3. Check compatibility with the existing codebase conventions
4. Assess performance and efficiency issues
5. Identify security concerns
6. Suggest improvements if needed

Return your verification in the specified JSON format.`;

    try {
      // Generate structured verification result
      const verificationResult = await this.executeWithSchema(
        prompt,
        VerificationResultSchema
      );
      
      return this.formatVerificationResult(verificationResult);
    } catch (error) {
      log(
        `[VerificationAgent Error] ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
      return `Error verifying code: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Factory function for creating verification agent
   */
  public static create(): VerificationAgent {
    return new VerificationAgent();
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function verificationAgent(prompt: string): Promise<string> {
  const agent = new VerificationAgent();
  try {
    return await agent.execute(prompt);
  } catch (error) {
    log(`[verificationAgent] Error: ${error}`, "error");
    return `Sorry, I encountered an error during verification: ${error}`;
  }
}