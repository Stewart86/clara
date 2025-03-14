import { generateDiff } from '../utils/diff';

/**
 * This is a comprehensive test for the diff rendering functionality
 * It includes different test cases to verify:
 * - Line number alignment (single and double digits)
 * - Handling of various line lengths
 * - Terminal width adaptation
 * - Syntax highlighting
 * - Code truncation behavior
 */

// Test case 1: Basic diff with single and double digit line numbers
function testDigitAlignment() {
  const oldContent = `function singleDigitTest() {
  // Line 2
  // Line 3
  // Line 4
  // Line 5
  // Line 6
  // Line 7
  // Line 8
  // Line 9
  // This is line 10 - double digits start here
  // Line 11
}`;

  const newContent = `function singleDigitTest() {
  // Line 2 - modified
  // Line 3
  // New line inserted
  // Line 4
  // Line 5 - modified
  // Line 6
  // Line 7
  // Line 8
  // Line 9 - modified
  // This is line 10 - double digits start here
  // Line 11 - modified
}`;

  console.log("Test 1: Line Number Alignment");
  console.log(generateDiff(oldContent, newContent, 'alignment-test.ts'));
}

// Test case 2: Long line handling and terminal width adaptation
function testTerminalScaling() {
  const oldContent = `
function testFunction() {
  // Short line
  console.log("This is a test");
  
  // Medium length line
  const mediumLine = "This line is a bit longer than the short line above";
  
  // Really long line that should test our truncation logic when terminal size is small
  const longLine = "This is an extremely long line that should test the truncation logic when displayed in a terminal with limited width. It contains a lot of text to ensure it exceeds most reasonable terminal widths.";
  
  // Some code
  const result = [1, 2, 3, 4].map(num => {
    return num * 2;
  });
  
  return result;
}`;

  const newContent = `
function testFunction() {
  // Short line
  console.log("This is a test");
  
  // Medium length line - modified
  const mediumLine = "This line is a bit longer than the short line above and has been modified";
  
  // Really long line that should test our truncation logic when terminal size is small
  const longLine = "This is an extremely long line that should test the truncation logic when displayed in a terminal with limited width. It has been slightly modified to show in the diff.";
  
  // Some code - new lines added
  const result = [1, 2, 3, 4, 5, 6].map(num => {
    // Added comment
    const doubled = num * 2;
    return doubled;
  });
  
  return result;
}`;

  console.log("\nTest 2: Terminal Width Scaling and Truncation");
  console.log(generateDiff(oldContent, newContent, 'scaling-test.ts'));
}

// Run all the tests
console.log("=== Diff Rendering Tests ===\n");
testDigitAlignment();
testTerminalScaling();
console.log("\n=== Tests Complete ===");