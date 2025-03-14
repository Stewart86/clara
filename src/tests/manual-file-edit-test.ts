/**
 * Manual test for file editing with approval mechanism
 */
import { editFile, replaceFile } from "../tools/fileWriter.js";
import fs from "fs/promises";
import path from "path";
import readline from "node:readline";
import { getSessionState } from "../utils/index.js";

// Set up readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Store in session state
const sessionState = getSessionState();
sessionState.setSharedReadline(rl);

console.log("Note: User input is now required for approving file changes");
console.log("You will be prompted to approve each change");

async function manualTestFileEdit() {
  try {
    console.log("\n===== Manual File Edit Test with Approval Mechanism =====\n");
    
    // Create a temporary test file
    const tempFilePath = path.join(process.cwd(), "test-approval.txt");
    const initialContent = `// This is a test file for the file edit approval mechanism
const testFunction = () => {
  console.log("Hello world");
  return {
    status: "ok",
    message: "This is the original message"
  };
};

module.exports = { testFunction };`;
    
    await fs.writeFile(tempFilePath, initialContent, "utf8");
    console.log(`Created test file: ${tempFilePath}\n`);
    
    console.log("1. Testing editFile with approval mechanism...");
    console.log("You will be prompted to approve the change.\n");
    
    const editResult = await editFile(
      tempFilePath,
      '  console.log("Hello world");',
      '  console.log("Hello updated world");'
    );
    
    console.log(`\nEdit result: ${editResult}\n`);
    
    console.log("2. Testing replaceFile with approval mechanism...");
    console.log("You will be prompted to approve the change.\n");
    
    const newContent = `// This file has been completely replaced
const newFunction = () => {
  console.log("This is the new content");
  return {
    status: "updated",
    message: "File replaced successfully"
  };
};

module.exports = { newFunction };`;
    
    const replaceResult = await replaceFile(tempFilePath, newContent);
    
    console.log(`\nReplace result: ${replaceResult}\n`);
    
    console.log("3. Testing creating a new file with editFile...");
    console.log("You will be prompted to approve the creation.\n");
    
    const newFilePath = path.join(process.cwd(), "new-approval-test.txt");
    
    // Make sure the test file doesn't exist
    try {
      await fs.unlink(newFilePath);
    } catch (error) {
      // File probably doesn't exist, which is fine
    }
    
    const createResult = await editFile(
      newFilePath,
      "",
      "This is a brand new file\nCreated with approval"
    );
    
    console.log(`\nCreate result: ${createResult}\n`);
    
    // Clean up test files
    console.log("Cleaning up test files...");
    try {
      await fs.unlink(tempFilePath);
      await fs.unlink(newFilePath);
      console.log("Test files removed");
    } catch (error) {
      console.log("Error removing test files:", error);
    }
    
    console.log("\nAll tests completed! Closing readline interface...");
    rl.close();
  } catch (error) {
    console.error("Error during file edit test:", error);
    rl.close();
  }
}

// Run the test
manualTestFileEdit();