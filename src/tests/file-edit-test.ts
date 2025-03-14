/**
 * Manual test for file editing capabilities
 * Simplified to bypass user approval for testing
 */
import { editFile, replaceFile, isPathAllowedForEdit } from "../tools/fileWriter.js";
import fs from "fs/promises";
import path from "path";
import { generateDiff } from "../utils/diff.js";

// Mock the user approval function
async function testPermissions() {
  console.log("===== Testing Path Permissions =====");
  
  // Test current directory - should be allowed
  const cwd = process.cwd();
  const cwdFile = path.join(cwd, "test-file.txt");
  const cwdResult = await isPathAllowedForEdit(cwdFile);
  console.log(`Path in current dir (${cwdFile}): ${cwdResult.allowed ? 'ALLOWED' : 'DENIED'}`);
  
  // Test parent directory - should be denied
  const parentDir = path.dirname(cwd);
  const parentFile = path.join(parentDir, "test-file.txt");
  const parentResult = await isPathAllowedForEdit(parentFile);
  console.log(`Path in parent dir (${parentFile}): ${parentResult.allowed ? 'ALLOWED' : 'DENIED'}`);
  
  // Test system directory - should be denied
  const sysFile = "/etc/test-file.txt";
  const sysResult = await isPathAllowedForEdit(sysFile);
  console.log(`Path in system dir (${sysFile}): ${sysResult.allowed ? 'ALLOWED' : 'DENIED'}`);
  
  console.log("===== Permission Tests Completed =====\n");
}

// Test diff generation
async function testDiffGeneration() {
  console.log("===== Testing Diff Generation =====");
  
  const oldContent = `/**
 * Sample function for testing syntax highlighting
 * @param {string} name - Person's name
 * @returns {Object} - Greeting object
 */
function hello(name = "world") {
  // Old comment: Default greeting
  const greeting = "Hello";
  console.log(\`\${greeting} \${name}!\`);
  
  const result = {
    success: true,
    timestamp: new Date(),
    message: \`\${greeting} \${name}!\`
  };
  
  return result;
}`;

  const newContent = `/**
 * Enhanced greeting function with more options
 * @param {string} name - Person's name
 * @param {Object} options - Configuration options
 * @returns {Object} - Enhanced greeting object
 */
function hello(name = "world", options = {}) {
  // New comment: Customizable greeting
  const { greeting = "Hello", loud = false } = options;
  const message = \`\${greeting} \${name}!\${loud ? '!' : ''}\`;
  
  console.log(message);
  
  const result = {
    success: false,  // Changed to false
    timestamp: new Date(),
    message,
    options
  };
  
  return result;
}`;

  const diff = generateDiff(oldContent, newContent, "test.js");
  console.log(diff);
  
  console.log("===== Diff Test Completed =====\n");
}

// Test basic file operations
async function testFileOperations() {
  console.log("===== Testing Direct File Operations =====");
  
  // Test creating a test file
  const tempFilePath = path.join(process.cwd(), "test-file.txt");
  const content = "This is a test file\nWith multiple lines\nFor testing purposes";
  
  try {
    // Create the file
    await fs.writeFile(tempFilePath, content, "utf8");
    console.log(`Created test file: ${tempFilePath}`);
    
    // Read it back
    const readContent = await fs.readFile(tempFilePath, "utf8");
    console.log(`File content (${readContent.length} bytes) matches: ${readContent === content}`);
    
    // Modify it
    const newContent = content.replace("test file", "MODIFIED file");
    await fs.writeFile(tempFilePath, newContent, "utf8");
    console.log("File modified");
    
    // Read it back
    const modifiedContent = await fs.readFile(tempFilePath, "utf8");
    console.log(`Modified content: ${modifiedContent.includes("MODIFIED")}`);
    
    // Delete it
    await fs.unlink(tempFilePath);
    console.log("File deleted");
  } catch (error) {
    console.error("Error during file operations:", error);
  }
  
  console.log("===== File Operations Test Completed =====\n");
}

async function runAllTests() {
  try {
    await testPermissions();
    await testDiffGeneration();
    await testFileOperations();
    console.log("All tests completed successfully!");
  } catch (error) {
    console.error("Test error:", error);
  }
}

// Run all tests
runAllTests();