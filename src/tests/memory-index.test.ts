import { expect, test, beforeEach, afterEach } from "bun:test";
import { getMemoryIndexer, MemoryIndexer } from "../tools/memoryIndex.js";
import { resolveMemoryPaths } from "../tools/memoryUtils.js";
import path from "path";
import fs from "fs/promises";
import { write } from "bun";

// Use a test project path
const TEST_PROJECT = "test-memory-index";

// Create a temporary test directory
async function createTestDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating test directory: ${error}`);
    throw error;
  }
}

// Create a test memory file
async function createTestMemoryFile(
  filePath: string, 
  metadata: any, 
  content: string
): Promise<void> {
  try {
    // Create frontmatter
    let frontmatter = "---\n";
    for (const [key, value] of Object.entries(metadata)) {
      if (Array.isArray(value)) {
        frontmatter += `${key}: [${value.join(", ")}]\n`;
      } else {
        frontmatter += `${key}: ${value}\n`;
      }
    }
    frontmatter += "---\n\n";
    
    // Write the file
    const fullContent = `${frontmatter}${content}`;
    await write(filePath, fullContent);
  } catch (error) {
    console.error(`Error creating test memory file: ${error}`);
    throw error;
  }
}

// Clean up test directory
async function cleanupTestDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up test directory: ${error}`);
  }
}

beforeEach(async () => {
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(TEST_PROJECT);
  
  // Create the test directory
  await createTestDirectory(projectMemoryDir);
  
  // Create some test category directories
  await createTestDirectory(path.join(projectMemoryDir, "codebase"));
  await createTestDirectory(path.join(projectMemoryDir, "technical"));
  await createTestDirectory(path.join(projectMemoryDir, "business"));
});

afterEach(async () => {
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(TEST_PROJECT);
  
  // Clean up the test directory
  await cleanupTestDirectory(projectMemoryDir);
});

test("MemoryIndexer creates and loads index", async () => {
  const indexer = getMemoryIndexer();
  const index = await indexer.getIndex(TEST_PROJECT);
  
  expect(index).toBeDefined();
  expect(index.projectPath).toBe(TEST_PROJECT);
  expect(index.version).toBe("1.0");
  expect(Object.keys(index.entries).length).toBe(0);
});

test("MemoryIndexer indexes a file and stores metadata", async () => {
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(TEST_PROJECT);
  
  // Create a test memory file
  const filePath = path.join(projectMemoryDir, "codebase/test-file.md");
  const metadata = {
    title: "Test File",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    tags: ["test", "indexing", "memory"],
    summary: "A test file for the memory indexing system",
    importance: "high"
  };
  const content = "# Test File\n\nThis is a test file for the memory indexing system. It contains some keywords like Clara, memory, indexing, and relationships.";
  
  await createTestMemoryFile(filePath, metadata, content);
  
  // Get the indexer and index the file
  const indexer = getMemoryIndexer();
  await indexer.indexMemoryFile("codebase/test-file.md", metadata, content, TEST_PROJECT);
  
  // Get the index and verify
  const index = await indexer.getIndex(TEST_PROJECT);
  
  expect(index.entries["codebase/test-file.md"]).toBeDefined();
  expect(index.entries["codebase/test-file.md"].title).toBe("Test File");
  expect(index.entries["codebase/test-file.md"].tags).toEqual(["test", "indexing", "memory"]);
  expect(index.entries["codebase/test-file.md"].summary).toBe("A test file for the memory indexing system");
  expect(index.entries["codebase/test-file.md"].importance).toBe("high");
  
  // Verify tag indexing
  expect(index.tagIndex["test"]).toContain("codebase/test-file.md");
  expect(index.tagIndex["indexing"]).toContain("codebase/test-file.md");
  expect(index.tagIndex["memory"]).toContain("codebase/test-file.md");
  
  // Verify keyword extraction (some expected keywords)
  expect(index.entries["codebase/test-file.md"].keywords).toBeDefined();
  expect(index.entries["codebase/test-file.md"].keywords.length).toBeGreaterThan(0);
});

test("MemoryIndexer maintains relationships between files", async () => {
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(TEST_PROJECT);
  
  // Create first test file
  const filePath1 = path.join(projectMemoryDir, "codebase/file1.md");
  const metadata1 = {
    title: "File One",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    tags: ["test", "relationships"],
    related: ["codebase/file2.md"],
    summary: "First test file with a relationship"
  };
  const content1 = "# File One\n\nThis file has a relationship to File Two.";
  
  // Create second test file
  const filePath2 = path.join(projectMemoryDir, "codebase/file2.md");
  const metadata2 = {
    title: "File Two",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    tags: ["test", "relationships"],
    related: [],
    summary: "Second test file"
  };
  const content2 = "# File Two\n\nThis is the second test file.";
  
  await createTestMemoryFile(filePath1, metadata1, content1);
  await createTestMemoryFile(filePath2, metadata2, content2);
  
  // Get the indexer and index both files
  const indexer = getMemoryIndexer();
  await indexer.indexMemoryFile("codebase/file1.md", metadata1, content1, TEST_PROJECT);
  await indexer.indexMemoryFile("codebase/file2.md", metadata2, content2, TEST_PROJECT);
  
  // Get the index and verify relationships
  const index = await indexer.getIndex(TEST_PROJECT);
  
  // Verify relationship from file1 to file2
  expect(index.relationshipGraph["codebase/file1.md"]).toContain("codebase/file2.md");
  
  // Verify bidirectional relationship was created in the relationship graph
  expect(index.relationshipGraph["codebase/file2.md"]).toContain("codebase/file1.md");
  
  // Check that the related array exists but might not yet contain the bidirectional reference
  // This is because file2.md's metadata doesn't include file1.md in its related array
  expect(index.entries["codebase/file2.md"].related).toBeDefined();
});

test("MemoryIndexer search returns relevant results", async () => {
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(TEST_PROJECT);
  
  // Create several test files with different content and tags
  const testFiles = [
    {
      path: "codebase/authentication.md",
      metadata: {
        title: "Authentication System",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["auth", "security", "jwt"],
        summary: "Overview of the authentication system",
        importance: "high"
      },
      content: "# Authentication System\n\nThis file describes how the authentication system works. It uses JWT tokens for authentication."
    },
    {
      path: "technical/database.md",
      metadata: {
        title: "Database Schema",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["database", "schema", "postgres"],
        summary: "Database schema documentation",
        importance: "medium"
      },
      content: "# Database Schema\n\nThis file contains information about the database schema. We use PostgreSQL for our database."
    },
    {
      path: "business/workflows.md",
      metadata: {
        title: "Business Workflows",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["workflow", "process", "business"],
        summary: "Description of business workflows",
        importance: "medium"
      },
      content: "# Business Workflows\n\nThis document describes the business workflows in the system. Users must be authenticated to access these workflows."
    }
  ];
  
  // Create the files and index them
  const indexer = getMemoryIndexer();
  
  for (const file of testFiles) {
    const filePath = path.join(projectMemoryDir, file.path);
    await createTestDirectory(path.dirname(filePath));
    await createTestMemoryFile(filePath, file.metadata, file.content);
    await indexer.indexMemoryFile(file.path, file.metadata, file.content, TEST_PROJECT);
  }
  
  // Perform searches and verify results
  
  // Search for authentication
  const authResults = await indexer.search("authentication", TEST_PROJECT);
  expect(authResults.length).toBeGreaterThan(0);
  expect(authResults[0].entry.path).toBe("codebase/authentication.md");
  
  // Search for database
  const dbResults = await indexer.search("database schema", TEST_PROJECT);
  expect(dbResults.length).toBeGreaterThan(0);
  expect(dbResults[0].entry.path).toBe("technical/database.md");
  
  // Search for "auth" should return both authentication and workflows (which mentions authentication)
  const authRelatedResults = await indexer.search("auth", TEST_PROJECT);
  expect(authRelatedResults.length).toBeGreaterThan(1);
  
  // Get the paths from results
  const resultPaths = authRelatedResults.map(r => r.entry.path);
  expect(resultPaths).toContain("codebase/authentication.md");
  
  // Business workflows might be included because it mentions authentication
  if (resultPaths.includes("business/workflows.md")) {
    // If included, it should have a lower score than authentication.md
    const authScore = authRelatedResults.find(r => r.entry.path === "codebase/authentication.md")?.score || 0;
    const workflowScore = authRelatedResults.find(r => r.entry.path === "business/workflows.md")?.score || 0;
    expect(authScore).toBeGreaterThan(workflowScore);
  }
});

test("MemoryIndexer getRelated returns related files", async () => {
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(TEST_PROJECT);
  
  // Create files with relationships
  const testFiles = [
    {
      path: "codebase/auth.md",
      metadata: {
        title: "Authentication",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["auth", "security"],
        related: ["technical/jwt.md", "codebase/users.md"],
        summary: "Authentication overview"
      },
      content: "# Authentication\n\nThis file describes authentication."
    },
    {
      path: "technical/jwt.md",
      metadata: {
        title: "JWT Tokens",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["jwt", "auth", "token"],
        related: [],
        summary: "Information about JWT tokens"
      },
      content: "# JWT Tokens\n\nThis file describes JWT tokens."
    },
    {
      path: "codebase/users.md",
      metadata: {
        title: "User Management",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["users", "auth"],
        related: [],
        summary: "User management system"
      },
      content: "# User Management\n\nThis file describes user management."
    },
    {
      path: "technical/security.md",
      metadata: {
        title: "Security Overview",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["security", "guidelines"],
        related: [],
        summary: "Security guidelines and best practices"
      },
      content: "# Security Overview\n\nThis file describes security guidelines."
    }
  ];
  
  // Create the files and index them
  const indexer = getMemoryIndexer();
  
  for (const file of testFiles) {
    const filePath = path.join(projectMemoryDir, file.path);
    await createTestDirectory(path.dirname(filePath));
    await createTestMemoryFile(filePath, file.metadata, file.content);
    await indexer.indexMemoryFile(file.path, file.metadata, file.content, TEST_PROJECT);
  }
  
  // Get related files for auth.md
  const relatedToAuth = await indexer.getRelated("codebase/auth.md", TEST_PROJECT);
  
  // Should have at least the directly related files
  expect(relatedToAuth.length).toBeGreaterThanOrEqual(2);
  
  // Check for directly related files
  const relatedPaths = relatedToAuth.map(r => r.entry.path);
  expect(relatedPaths).toContain("technical/jwt.md");
  expect(relatedPaths).toContain("codebase/users.md");
  
  // Direct relations should have higher relevance
  const jwtRelevance = relatedToAuth.find(r => r.entry.path === "technical/jwt.md")?.relevance || 0;
  expect(jwtRelevance).toBeGreaterThanOrEqual(5);
  
  // May also include security.md because of shared tags
  if (relatedPaths.includes("technical/security.md")) {
    // But with lower relevance than direct relationships
    const securityRelevance = relatedToAuth.find(r => r.entry.path === "technical/security.md")?.relevance || 0;
    const usersRelevance = relatedToAuth.find(r => r.entry.path === "codebase/users.md")?.relevance || 0;
    expect(usersRelevance).toBeGreaterThan(securityRelevance);
  }
});

test("MemoryIndexer reindexAll rebuilds the index", async () => {
  // Create a separate test project to avoid conflicts
  const REINDEX_TEST_PROJECT = "test-memory-reindex";
  
  // Get the project memory directory
  const { projectMemoryDir } = resolveMemoryPaths(REINDEX_TEST_PROJECT);
  
  try {
    // Clean up any existing test directory
    await cleanupTestDirectory(projectMemoryDir);
    
    // Create test directory structure
    await createTestDirectory(projectMemoryDir);
    await createTestDirectory(path.join(projectMemoryDir, "codebase"));
    
    // Create several test files
    const testFiles = [
      {
        path: "codebase/file1.md",
        metadata: {
          title: "File One",
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          tags: ["test"],
          summary: "Test file one"
        },
        content: "# File One\n\nTest content."
      },
      {
        path: "codebase/file2.md",
        metadata: {
          title: "File Two",
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          tags: ["test"],
          summary: "Test file two"
        },
        content: "# File Two\n\nTest content."
      }
    ];
    
    // Create the files directly without indexing
    for (const file of testFiles) {
      const filePath = path.join(projectMemoryDir, file.path);
      await createTestDirectory(path.dirname(filePath));
      await createTestMemoryFile(filePath, file.metadata, file.content);
    }
    
    // Rebuild the index
    const indexer = getMemoryIndexer();
    await indexer.reindexAll(REINDEX_TEST_PROJECT);
    
    // Verify index now has entries
    const index = await indexer.getIndex(REINDEX_TEST_PROJECT);
    expect(Object.keys(index.entries).length).toBe(2);
    expect(index.entries["codebase/file1.md"]).toBeDefined();
    expect(index.entries["codebase/file2.md"]).toBeDefined();
  } finally {
    // Clean up
    await cleanupTestDirectory(projectMemoryDir);
  }
});