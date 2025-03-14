import { webSearchAgent } from "../agents/websearch";
import { log } from "../utils/logger";

// Validate that the web search agent can retrieve information from the web
async function testWebSearch() {
  log("Running web search test...", "system");
  
  // Create a test query
  const query = "What are the latest features in TypeScript 5.4?";
  
  try {
    // Call the web search agent
    const result = await webSearchAgent(query);
    
    // Log the result
    log("Web search result:", "system");
    log(result, "data");
    
    log("Web search test completed successfully", "success");
    return true;
  } catch (error) {
    log(`Web search test failed: ${error}`, "error");
    return false;
  }
}

// Run the test
testWebSearch();