/**
 * Global session state for Clara CLI
 * Persists data across multiple command invocations within a single CLI session
 */
import { Interface as ReadlineInterface } from "node:readline";
import { FileEditApprovalState } from "../tools/fileWriter.js";

// Command approval state
export interface CommandApprovalState {
  // Map of command patterns to approval status
  patterns: Map<string, boolean>;
  
  // Add a command pattern approval
  approve(command: string, executable: string): void;
  
  // Check if a command is already approved
  isApproved(command: string, executable: string): boolean;
}

// Global session state container
export class SessionState {
  private static instance: SessionState;
  public commandApprovals: CommandApprovalState;
  public fileEditApprovals?: FileEditApprovalState;
  
  // Shared readline interface for user input
  private _sharedReadline: ReadlineInterface | null = null;

  private constructor() {
    // Initialize command approvals
    this.commandApprovals = {
      patterns: new Map<string, boolean>(),
      
      approve(command: string, executable: string): void {
        // Store both the specific command and the executable + pattern
        this.patterns.set(command, true);
        
        // For rm/mv/cp commands, also store a pattern-based approval to match similar commands
        if (['rm', 'mv', 'cp'].includes(executable)) {
          // Extract the path pattern from the command
          const parts = command.split(' ');
          if (parts.length > 1) {
            const pathPart = parts.slice(1).join(' ');
            // Create pattern that would match similar operations on the same path
            const pattern = `${executable}:${pathPart}`;
            this.patterns.set(pattern, true);
          }
        }
      },
      
      isApproved(command: string, executable: string): boolean {
        // Check for exact command match
        if (this.patterns.has(command)) {
          return true;
        }
        
        // For rm/mv/cp commands, check for pattern-based approval
        if (['rm', 'mv', 'cp'].includes(executable)) {
          const parts = command.split(' ');
          if (parts.length > 1) {
            const pathPart = parts.slice(1).join(' ');
            const pattern = `${executable}:${pathPart}`;
            return this.patterns.has(pattern);
          }
        }
        
        return false;
      }
    };
  }

  /**
   * Get the singleton instance of the session state
   * @returns Session state instance
   */
  public static getInstance(): SessionState {
    if (!SessionState.instance) {
      SessionState.instance = new SessionState();
    }
    return SessionState.instance;
  }

  /**
   * Reset the session state (typically not used during normal operation)
   */
  public reset(): void {
    this.commandApprovals.patterns.clear();
  }
  
  /**
   * Set a shared readline interface for the session
   * This helps prevent conflicts when multiple components need user input
   */
  public setSharedReadline(readline: ReadlineInterface): void {
    this._sharedReadline = readline;
  }
  
  /**
   * Get the shared readline interface if available
   */
  public getSharedReadline(): ReadlineInterface | null {
    return this._sharedReadline;
  }
  
  /**
   * Check if we have a shared readline interface
   */
  public hasSharedReadline(): boolean {
    return this._sharedReadline !== null;
  }
}

/**
 * Get the global session state
 * @returns Global session state singleton
 */
export function getSessionState(): SessionState {
  return SessionState.getInstance();
}