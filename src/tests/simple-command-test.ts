#!/usr/bin/env bun
/**
 * Simple test for command approval
 * Run with: bun src/tests/simple-command-test.ts
 */

import { secureCommand } from "../tools/command.js";

async function runTest() {
  console.log("Testing new command approval system");
  
  // Test a command that requires approval
  const result = await secureCommand("rm -rf ./testdir");
  console.log(`Result: ${result}`);
}

runTest().catch(console.error);