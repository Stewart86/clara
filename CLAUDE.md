# CLAUDE.md - Clara Project Guidelines

> IMPORTANT: This CLAUDE.md file is my memory file for the Clara project. I should always check this file for important project information and update it when learning new things about the project.

## Project Overview
Clara is an agentic AI assistant designed to simplify complex codebases for both technical and business stakeholders. It runs entirely via command line interface and can be used interactively or with CLI parameters.

### Key Features
- End-to-End Code Investigation: Reads, parses, and interprets code logic and purpose
- Layman-Friendly Explanations: Transforms technical jargon into accessible language
- Business-Savvy Insights: Highlights how code components impact business functions
- Engaging Interaction: Professional yet approachable with occasional light humor

### Technical Stack
- Runtime: Bun
- Dependencies: Vercel AI SDK, chalk
- AI Models: Support for multiple models (OpenAI, Anthropic, Google Vertex AI, DeepSeek)

## Build Commands
- `bun start` - Run the application
- `bun build` - Build for production to dist directory
- `bun dev` - Run with file watching for development 
- `bun test` - Run all tests
- `bun test src/tests/basic.test.ts` - Run a specific test file
- `bun clara` - Run the Clara CLI

## Code Style Guidelines
- **Imports**: ESM imports, dependencies first, then local imports
- **Types**: TypeScript with strict typing, explicit function parameter and return types
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Error Handling**: Use try/catch blocks for async operations with proper error logging
- **Function Design**: Break down complex functions into smaller, focused helper functions

## Project Structure
- `src/agents/` - AI agent implementations (meme, parser, pun, planner)
- `src/cli/` - Command-line interface components
- `src/tools/` - Tool implementations (search, file reading, memory management)
- `src/tests/` - Test files using Bun's test runner
- `poc/` - Proof of concept explorations

## Agent Types
- **Planner Agent**: Analyzes user requests and generates structured action plans with search strategies (OpenAI o3-mini)
- **Parser Agent**: Specialized for reading code (OpenAI 4o-mini)
- **Meme Agent**: Natural meme generator for given topics
- **Pun Agent**: Provides puns based on keywords
- **Search Agent**: Specialized for web search

## Processing Pipeline
1. User input is captured through CLI interface
2. Planner agent analyzes request and creates structured action plan
3. Main Clara agent follows plan using appropriate tools
4. Response is formatted and displayed to user

## Memory System
- Base location: `~/.config/clara/`
- Project-specific memories organized by working directory paths
- Format: Markdown
- Structure: Topic-based subfolders (codebase, users, insights, technical, business)

## Debug Commands
- Search debugging logs format: `[Search] Command result: exit=${exitCode}, output=${output}`