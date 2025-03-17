import path from "path";
import fs from "fs/promises";
import { log } from "../utils/logger.js";
import { resolveMemoryPaths, ensureMemoryDirectoryExists } from "./memoryUtils.js";
import { write } from "bun";

/**
 * Represents a single memory file entry in the index
 */
export interface MemoryIndexEntry {
  // Core identifiers
  path: string;           // Memory file path relative to project memory
  title: string;          // Title from metadata
  
  // Content information
  summary?: string;       // Brief summary of the content
  tags: string[];         // Tags for categorization
  importance?: string;    // Low, medium, high
  
  // Metadata
  created: string;        // ISO date string
  updated: string;        // ISO date string
  source?: string;        // Source of the information
  
  // Relationships
  related: string[];      // Related memory file paths
  
  // Search optimization
  keywords: string[];     // Additional keywords for searching
  
  // Statistics
  wordCount: number;      // Approximate word count
  accessCount: number;    // Number of times this memory has been accessed
  lastAccessed?: string;  // Last access timestamp
}

/**
 * The main index structure for memory files
 */
export interface MemoryIndex {
  // Index metadata
  projectPath: string;    // Project identifier
  lastUpdated: string;    // Last update timestamp
  version: string;        // Index version
  
  // Indexed items
  entries: Record<string, MemoryIndexEntry>; // Path -> Index entry
  
  // Inverted index for search
  tagIndex: Record<string, string[]>;        // Tag -> List of paths
  keywordIndex: Record<string, string[]>;    // Keyword -> List of paths
  
  // Relationships graph
  relationshipGraph: Record<string, string[]>; // Path -> List of related paths
}

/**
 * MemoryIndexer provides indexing, searching, and relationship management
 * for Clara's memory system
 */
export class MemoryIndexer {
  private static instance: MemoryIndexer;
  private indexes: Map<string, MemoryIndex> = new Map();
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): MemoryIndexer {
    if (!MemoryIndexer.instance) {
      MemoryIndexer.instance = new MemoryIndexer();
    }
    return MemoryIndexer.instance;
  }
  
  /**
   * Get the index for a specific project
   * @param projectPath Optional project path
   * @returns The memory index for the project
   */
  public async getIndex(projectPath: string = ""): Promise<MemoryIndex> {
    const { resolvedProjectPath, projectMemoryDir } = resolveMemoryPaths(projectPath);
    
    // Check if we already have this index loaded
    if (this.indexes.has(resolvedProjectPath)) {
      return this.indexes.get(resolvedProjectPath)!;
    }
    
    // Try to load the index from disk
    try {
      await ensureMemoryDirectoryExists(projectMemoryDir);
      const indexPath = path.join(projectMemoryDir, '.index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent) as MemoryIndex;
      
      // Store the loaded index
      this.indexes.set(resolvedProjectPath, index);
      log(`[MemoryIndex] Loaded index for ${resolvedProjectPath} with ${Object.keys(index.entries).length} entries`, "system");
      
      return index;
    } catch (error) {
      // Create a new index if it doesn't exist
      log(`[MemoryIndex] Creating new index for ${resolvedProjectPath}`, "system");
      
      const newIndex: MemoryIndex = {
        projectPath: resolvedProjectPath,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
        entries: {},
        tagIndex: {},
        keywordIndex: {},
        relationshipGraph: {}
      };
      
      // Store the new index
      this.indexes.set(resolvedProjectPath, newIndex);
      
      // Save to disk
      await this.saveIndex(newIndex, projectMemoryDir);
      
      return newIndex;
    }
  }
  
  /**
   * Save the index to disk
   * @param index The index to save
   * @param projectMemoryDir The project memory directory
   */
  private async saveIndex(index: MemoryIndex, projectMemoryDir: string): Promise<void> {
    try {
      const indexPath = path.join(projectMemoryDir, '.index.json');
      await write(indexPath, JSON.stringify(index, null, 2));
      log(`[MemoryIndex] Saved index to ${indexPath}`, "system");
    } catch (error) {
      log(`[MemoryIndex] Error saving index: ${error}`, "error");
    }
  }
  
  /**
   * Add or update a memory file in the index
   * @param filePath Memory file path
   * @param metadata File metadata
   * @param content File content (for keyword extraction)
   * @param projectPath Optional project path
   */
  public async indexMemoryFile(
    filePath: string,
    metadata: any,
    content: string,
    projectPath: string = ""
  ): Promise<void> {
    const { resolvedProjectPath, projectMemoryDir } = resolveMemoryPaths(projectPath);
    const index = await this.getIndex(projectPath);
    
    // Create a normalized relative path
    const normalizedPath = filePath.startsWith('/') 
      ? filePath.substring(1) 
      : filePath;
    
    // Extract keywords from content
    const keywords = this.extractKeywords(content, metadata.tags || []);
    
    // Create or update entry
    const entry: MemoryIndexEntry = {
      path: normalizedPath,
      title: metadata.title || path.basename(filePath, '.md'),
      summary: metadata.summary,
      tags: metadata.tags || [],
      importance: metadata.importance,
      created: metadata.created || new Date().toISOString(),
      updated: metadata.updated || new Date().toISOString(),
      source: metadata.source,
      related: metadata.related || [],
      keywords,
      wordCount: this.countWords(content),
      accessCount: index.entries[normalizedPath]?.accessCount || 0,
      lastAccessed: index.entries[normalizedPath]?.lastAccessed
    };
    
    // Update the entries
    index.entries[normalizedPath] = entry;
    
    // Update the tag index
    for (const tag of entry.tags) {
      if (!index.tagIndex[tag]) {
        index.tagIndex[tag] = [];
      }
      if (!index.tagIndex[tag].includes(normalizedPath)) {
        index.tagIndex[tag].push(normalizedPath);
      }
    }
    
    // Update the keyword index
    for (const keyword of entry.keywords) {
      if (!index.keywordIndex[keyword]) {
        index.keywordIndex[keyword] = [];
      }
      if (!index.keywordIndex[keyword].includes(normalizedPath)) {
        index.keywordIndex[keyword].push(normalizedPath);
      }
    }
    
    // Update relationships
    this.updateRelationships(index, normalizedPath, entry.related);
    
    // Update index metadata
    index.lastUpdated = new Date().toISOString();
    
    // Save the updated index
    await this.saveIndex(index, projectMemoryDir);
    
    log(`[MemoryIndex] Indexed file ${normalizedPath}`, "system");
  }
  
  /**
   * Update the relationship graph
   * @param index The memory index
   * @param path The current file path
   * @param related The related file paths
   */
  private updateRelationships(
    index: MemoryIndex, 
    path: string, 
    related: string[]
  ): void {
    // Initialize relationship entry if needed
    if (!index.relationshipGraph[path]) {
      index.relationshipGraph[path] = [];
    }
    
    // Add new relationships
    for (const relPath of related) {
      // Skip self-references
      if (relPath === path) continue;
      
      // Add to current file's relationships
      if (!index.relationshipGraph[path].includes(relPath)) {
        index.relationshipGraph[path].push(relPath);
      }
      
      // Create bi-directional link - even if file doesn't exist yet
      // This handles the case where we index files in a specific order
      if (!index.relationshipGraph[relPath]) {
        index.relationshipGraph[relPath] = [];
      }
      
      // Add the current file as related to the related file
      if (!index.relationshipGraph[relPath].includes(path)) {
        index.relationshipGraph[relPath].push(path);
        
        // Also update the related file's entry if it exists
        if (index.entries[relPath] && !index.entries[relPath].related.includes(path)) {
          index.entries[relPath].related.push(path);
        }
      }
    }
  }
  
  /**
   * Extract keywords from content
   * @param content The content to extract keywords from
   * @param existingTags Existing tags to exclude from keywords
   * @returns Array of keywords
   */
  private extractKeywords(content: string, existingTags: string[]): string[] {
    // Simple keyword extraction based on frequency
    // Remove common words and punctuation
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !this.isStopWord(word) && 
        !existingTags.includes(word)
      );
    
    // Count word frequency
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    
    // Get top keywords
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  /**
   * Check if a word is a common stop word
   * @param word The word to check
   * @returns True if the word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'has', 'been', 
      'will', 'would', 'should', 'could', 'was', 'were', 'are', 'what', 'when', 
      'where', 'who', 'how', 'which', 'there', 'their', 'they', 'them', 'then'
    ];
    return stopWords.includes(word);
  }
  
  /**
   * Count words in content
   * @param content The content to count words in
   * @returns Word count
   */
  private countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  /**
   * Record a memory file access
   * @param filePath The memory file path
   * @param projectPath Optional project path
   */
  public async recordAccess(filePath: string, projectPath: string = ""): Promise<void> {
    const { projectMemoryDir } = resolveMemoryPaths(projectPath);
    const index = await this.getIndex(projectPath);
    
    // Create a normalized relative path
    const normalizedPath = filePath.startsWith('/') 
      ? filePath.substring(1) 
      : filePath;
    
    // Skip if file isn't in the index
    if (!index.entries[normalizedPath]) {
      return;
    }
    
    // Update access information
    index.entries[normalizedPath].accessCount += 1;
    index.entries[normalizedPath].lastAccessed = new Date().toISOString();
    
    // Save the updated index
    await this.saveIndex(index, projectMemoryDir);
  }
  
  /**
   * Search the memory index
   * @param query The search query
   * @param projectPath Optional project path
   * @returns List of matching entries with scores
   */
  public async search(
    query: string,
    projectPath: string = ""
  ): Promise<Array<{ entry: MemoryIndexEntry, score: number }>> {
    const index = await this.getIndex(projectPath);
    const results: Array<{ entry: MemoryIndexEntry, score: number }> = [];
    
    // Normalize and split the query
    const queryParts = query.toLowerCase().split(/\s+/).filter(p => p.length > 0);
    
    // Score each entry in the index
    for (const [path, entry] of Object.entries(index.entries)) {
      let score = 0;
      
      // Check title match (highest weight)
      const titleLower = entry.title.toLowerCase();
      for (const part of queryParts) {
        if (titleLower.includes(part)) {
          score += 10;
        }
      }
      
      // Check summary match
      if (entry.summary) {
        const summaryLower = entry.summary.toLowerCase();
        for (const part of queryParts) {
          if (summaryLower.includes(part)) {
            score += 5;
          }
        }
      }
      
      // Check tag match
      for (const tag of entry.tags) {
        for (const part of queryParts) {
          if (tag.toLowerCase().includes(part)) {
            score += 8;
          }
        }
      }
      
      // Check keyword match
      for (const keyword of entry.keywords) {
        for (const part of queryParts) {
          if (keyword.toLowerCase().includes(part)) {
            score += 3;
          }
        }
      }
      
      // Check path match
      const pathLower = path.toLowerCase();
      for (const part of queryParts) {
        if (pathLower.includes(part)) {
          score += 2;
        }
      }
      
      // Include recent and frequently accessed entries with a small boost
      if (entry.lastAccessed) {
        const lastAccess = new Date(entry.lastAccessed);
        const now = new Date();
        const daysSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceAccess < 7) {
          score += 1;
        }
      }
      
      if (entry.accessCount > 0) {
        // Small boost for frequently accessed files (max +2)
        score += Math.min(entry.accessCount / 5, 2);
      }
      
      // Add high importance entries with a boost
      if (entry.importance === 'high') {
        score += 2;
      }
      
      // If the entry has any score, add it to results
      if (score > 0) {
        results.push({ entry, score });
      }
    }
    
    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Get related files based on the relationship graph
   * @param filePath The memory file path
   * @param projectPath Optional project path
   * @returns List of related entries with relevance scores
   */
  public async getRelated(
    filePath: string,
    projectPath: string = ""
  ): Promise<Array<{ entry: MemoryIndexEntry, relevance: number }>> {
    const index = await this.getIndex(projectPath);
    const results: Array<{ entry: MemoryIndexEntry, relevance: number }> = [];
    
    // Create a normalized relative path
    const normalizedPath = filePath.startsWith('/') 
      ? filePath.substring(1) 
      : filePath;
    
    // Skip if file isn't in the index
    if (!index.entries[normalizedPath]) {
      return [];
    }
    
    // Get directly related files
    const directlyRelated = index.relationshipGraph[normalizedPath] || [];
    
    // For each directly related file
    for (const relPath of directlyRelated) {
      const entry = index.entries[relPath];
      if (entry) {
        // Direct relationship has highest relevance
        results.push({ entry, relevance: 10 });
      }
    }
    
    // Find files with similar tags (2nd degree relationship)
    const currentEntry = index.entries[normalizedPath];
    for (const tag of currentEntry.tags) {
      const tagMatches = index.tagIndex[tag] || [];
      for (const matchPath of tagMatches) {
        // Skip the current file and already included direct relationships
        if (matchPath === normalizedPath || directlyRelated.includes(matchPath)) {
          continue;
        }
        
        const entry = index.entries[matchPath];
        if (entry) {
          // Check if already in results
          const existing = results.find(r => r.entry.path === matchPath);
          if (existing) {
            // Increase relevance for each shared tag
            existing.relevance += 2;
          } else {
            // Add new entry with tag-based relevance
            results.push({ entry, relevance: 2 });
          }
        }
      }
    }
    
    // Find files with similar keywords (3rd degree relationship)
    for (const keyword of currentEntry.keywords) {
      const keywordMatches = index.keywordIndex[keyword] || [];
      for (const matchPath of keywordMatches) {
        // Skip the current file and already included direct relationships
        if (matchPath === normalizedPath || directlyRelated.includes(matchPath)) {
          continue;
        }
        
        const entry = index.entries[matchPath];
        if (entry) {
          // Check if already in results
          const existing = results.find(r => r.entry.path === matchPath);
          if (existing) {
            // Increase relevance for each shared keyword
            existing.relevance += 1;
          } else {
            // Add new entry with keyword-based relevance
            results.push({ entry, relevance: 1 });
          }
        }
      }
    }
    
    // Sort by relevance (highest first)
    return results.sort((a, b) => b.relevance - a.relevance);
  }
  
  /**
   * Generate a visual graph of memory relationships
   * @param projectPath Optional project path
   * @returns ASCII graph of relationships
   */
  public async generateRelationshipGraph(projectPath: string = ""): Promise<string> {
    const index = await this.getIndex(projectPath);
    
    // Build a simple ASCII representation
    let graph = `# Memory Relationship Graph\n\n`;
    
    // Get all paths with relationships, sorted by category
    const categories: Record<string, string[]> = {
      "codebase": [],
      "technical": [],
      "business": [],
      "insights": [],
      "preferences": [],
      "other": []
    };
    
    for (const path of Object.keys(index.relationshipGraph)) {
      const relCount = index.relationshipGraph[path].length;
      if (relCount === 0) continue;
      
      // Categorize by first directory component
      const firstDir = path.split('/')[0];
      if (categories[firstDir]) {
        categories[firstDir].push(path);
      } else {
        categories.other.push(path);
      }
    }
    
    // Generate graph by category
    for (const [category, paths] of Object.entries(categories)) {
      if (paths.length === 0) continue;
      
      graph += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      
      for (const path of paths.sort()) {
        const entry = index.entries[path];
        if (!entry) continue;
        
        const relations = index.relationshipGraph[path] || [];
        if (relations.length === 0) continue;
        
        graph += `### ${entry.title} (${path})\n`;
        for (const relPath of relations) {
          const relEntry = index.entries[relPath];
          if (relEntry) {
            graph += `- → ${relEntry.title} (${relPath})\n`;
          } else {
            graph += `- → ${relPath} (missing)\n`;
          }
        }
        graph += "\n";
      }
    }
    
    return graph;
  }
  
  /**
   * Reindex all memory files to rebuild the index from scratch
   * @param projectPath Optional project path
   */
  public async reindexAll(projectPath: string = ""): Promise<string> {
    const { projectMemoryDir } = resolveMemoryPaths(projectPath);
    
    try {
      // Create a new index
      const newIndex: MemoryIndex = {
        projectPath: projectPath,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
        entries: {},
        tagIndex: {},
        keywordIndex: {},
        relationshipGraph: {}
      };
      
      // Store the new index
      this.indexes.set(projectPath, newIndex);
      
      // Get all markdown files
      const files = await this.getAllMarkdownFiles(projectMemoryDir);
      log(`[MemoryIndex] Found ${files.length} memory files to index`, "system");
      
      // Process each file
      let indexed = 0;
      for (const file of files) {
        try {
          // Get relative path
          const relPath = path.relative(projectMemoryDir, file);
          
          // Read file content
          const content = await fs.readFile(file, 'utf-8');
          
          // Extract frontmatter and content
          const { metadata, body } = this.extractFrontmatter(content);
          
          // Index the file
          await this.indexMemoryFile(relPath, metadata, body, projectPath);
          indexed++;
        } catch (error) {
          log(`[MemoryIndex] Error indexing file ${file}: ${error}`, "error");
        }
      }
      
      return `Reindexed ${indexed} of ${files.length} memory files.`;
    } catch (error) {
      log(`[MemoryIndex] Error reindexing: ${error}`, "error");
      return `Error reindexing memory files: ${error}`;
    }
  }
  
  /**
   * Get all markdown files in a directory recursively
   * @param dir Directory to search
   * @returns List of markdown file paths
   */
  private async getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDir(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          // Skip hidden files and dirs, including .index.json
          if (entry.name.startsWith('.')) {
            continue;
          }
          
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        log(`[MemoryIndex] Error scanning directory ${currentDir}: ${error}`, "error");
      }
    }
    
    await scanDir(dir);
    return files;
  }
  
  /**
   * Extract frontmatter and body from content
   * @param content File content
   * @returns Object with metadata and body
   */
  private extractFrontmatter(content: string): { metadata: any; body: string } {
    // Default empty metadata
    const defaultMetadata = {
      title: "Untitled",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tags: []
    };
    
    // Check if content has frontmatter (starts with ---)
    if (!content.startsWith('---')) {
      return { 
        metadata: defaultMetadata, 
        body: content 
      };
    }
    
    try {
      // Find the second --- that closes the frontmatter
      const endIndex = content.indexOf('---', 3);
      if (endIndex === -1) {
        return { 
          metadata: defaultMetadata, 
          body: content 
        };
      }
      
      // Extract the frontmatter section
      const frontmatter = content.substring(3, endIndex).trim();
      const body = content.substring(endIndex + 3).trim();
      
      // Parse the frontmatter as key-value pairs
      const metadata: Record<string, any> = { ...defaultMetadata };
      
      for (const line of frontmatter.split('\n')) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Parse key-value pairs
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmedLine.substring(0, colonIndex).trim();
          let value = trimmedLine.substring(colonIndex + 1).trim();
          
          // Parse arrays (tags, related, etc.)
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.substring(1, value.length - 1);
            metadata[key] = value.split(',').map(v => v.trim()).filter(v => v);
          } else {
            metadata[key] = value;
          }
        }
      }
      
      return { metadata, body };
    } catch (error) {
      log(`[MemoryIndex] Error parsing frontmatter: ${error}`, "error");
      return { 
        metadata: defaultMetadata, 
        body: content 
      };
    }
  }
}

/**
 * Get the singleton instance of the memory indexer
 */
export function getMemoryIndexer(): MemoryIndexer {
  return MemoryIndexer.getInstance();
}