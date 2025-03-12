# Clara

An AI Assistant that provides clarity to your business

## Overview

Clara is designed as an agentic AI assistant whose mission is to simplify the complexity of codebases. Targeting both technical and business stakeholders, Clara leverages a suite of integrated tools—from code scanners and parsers to dynamic analyzers—to thoroughly investigate and understand code from start to finish.

Clara runs entirely using command line interface. Clara can be used interactively or via the cli allowing additional parameters for different configuration.

Key features include:

- End-to-End Code Investigation:
  Clara methodically reads, parses, and interprets code, piecing together the logic and purpose behind every module or function.

- Layman-Friendly Explanations:
  By transforming technical jargon into accessible language, Clara bridges the gap between complex code logic and business strategy, ensuring non-technical users can follow along.

- Business-Savvy Insights:
  With a strong business focus, Clara highlights how specific code components impact overall business functions, decision-making, and operational efficiency.

- Engaging and Casual Interaction:
  Maintaining a professional yet approachable demeanor, Clara is not afraid to crack a light joke to ease the tension during deep technical dives—making her a delightful and efficient partner in code analysis.

Overall, Clara stands out as a comprehensive tool that not only deciphers code but does so in a manner that resonates with both developers and business professionals.

> Example Prompt for Clara:
>
> "You are Clara, an agentic AI assistant with a mission to decode and simplify complex codebases. Your task is to examine every piece of code, understand its logic from start to finish, and transform technical details into clear, layman-friendly language. Always keep a business-savvy perspective—explain how the code impacts overall operations and strategy. Maintain a logical, methodical approach in your explanations, and don't hesitate to lighten the mood with a clever quip or joke when appropriate. Your tone should be professional yet approachable, ensuring that every stakeholder, technical or not, can understand the underlying logic and value of the code."

## Technical Requirements

### Setup and Deployment

**runtime**: bun
**dependencies**:

- Vercel AI SDK
- chalk

### AI SDK Implementation

The Vercel AI SDK will be used to power Clara's capabilities, leveraging:

- Unified Provider API to support multiple AI models (OpenAI, Anthropic, Google Vertex AI, DeepSeek, etc.)
- Streaming responses for real-time interaction
- Tool calling with enhanced context and error handling
- Multi-modal support for handling various input types
- Node.js integration
- RAG (Retrieval-Augmented Generation) for context-aware interactions

## Necessary Tools for Clara

### Command line tools

- fd - not as useful, but when knowing the file name, this tool helps to get things done
- rg - often time, the faster way to find out something is a text search across the entire project directory
- gh - a GitHub CLI so that Clara can open issue or look up issues
- cat - this will be the only way Clara can read files
- ls - to know what directory, files or folders Clara can explore, this is an important tool

### Sub-AI to assist Clara

- thinker agent
  this is the super powerful agent that provide Insights to Clara when Clara needs to think hard on a problem. We can use DeepSeek or OpenAI's o1 model for this.
- parser agent
  AI that is good at reading code, but bad at reasoning. like OpenAI's 4o-mini.
- meme agent
  AI that is a natural meme generator, given a topic it will generate a meme for Clara. It is up to Clara if the meme is usable or not.
- pun agent
  Provide a few keywords, a few pun is received. Clara choose when to use them or not.

All sub-AIs will be implemented simultaneously to provide a comprehensive experience from the initial release.

### Memory System

Clara will use a plaintext-based memory system stored in the user's home directory:

- Base location: `~/.config/clara/`
- Project-specific memories organized by current working directory paths as subfolders
- Markdown format for all stored information
- Each project folder contains topic-based subfolders:
  - `codebase/` - Information about analyzed codebases
  - `users/` - User preferences and interaction history
  - `insights/` - Reusable explanations and patterns
  - `technical/` - Technical concepts and explanations
  - `business/` - Business-relevant insights

Note: Clara will only write to her own memory system (restricted to the ~/.config/clara/ directory) and never to project files directly.

This structure facilitates easy retrieval of project-specific information while maintaining separation between different projects Clara analyzes.

### Code Investigation Approaches

Clara will implement a comprehensive set of code investigation approaches:

1. Static Analysis - Parsing code structure without execution
2. Dependency Mapping - Understanding relationships between components
3. Business Logic Extraction - Identifying core business rules
4. Data Flow Analysis - Tracking how data moves through the application
5. API Surface Examination - Documenting interfaces and contracts
6. Documentation Generation - Creating human-readable explanations
