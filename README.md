# Clara

An AI Assistant that provides clarity to your business codebase.

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Bun-black?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI">
  <img src="https://img.shields.io/badge/CLI-100000?style=for-the-badge" alt="CLI">
</p>

## Overview

Clara is an agentic AI assistant designed to simplify the complexity of codebases. Targeting both technical and business stakeholders, Clara leverages a suite of integrated tools to thoroughly investigate and understand code from start to finish.

Clara runs entirely using a command line interface. It can be used interactively or via the CLI with additional parameters for different configurations.

## Features

- **End-to-End Code Investigation**: Clara methodically reads, parses, and interprets code, piecing together the logic and purpose behind every module or function.
- **Layman-Friendly Explanations**: Clara transforms technical jargon into accessible language, bridging the gap between complex code logic and business strategy.
- **Business-Savvy Insights**: With a strong business focus, Clara highlights how specific code components impact overall business functions and operational efficiency.
- **Engaging and Casual Interaction**: Clara maintains a professional yet approachable demeanor, occasionally using humor to make technical discussions more engaging.

## Prerequisites

- [Bun](https://bun.sh) (>= 1.0.0)
- Node.js (>= 18.0.0)
- API keys for supported AI models (OpenAI, Anthropic, etc.)

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/clara.git
cd clara

# Install dependencies
bun install

# Make the CLI executable
chmod +x src/cli/index.ts

# Create symlink to use 'clara' command globally
bun link
```

### Environment Setup

Create a `.env` file with your API keys:

```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
# Add other model provider keys as needed
```

## Usage

### Interactive Mode

Start an interactive conversation with Clara:

```bash
clara interactive
```

In this mode, you can ask questions about your codebase, request explanations, insights, and more.

### Code Analysis

Analyze an entire codebase to get comprehensive insights:

```bash
clara analyze --directory ./my-project
clara analyze --directory ./my-project --model gpt-4o --focus business
```

Options:
- `--directory, -d`: Path to the codebase directory (required)
- `--model, -m`: AI model to use (default: gpt-4o-mini)
- `--focus, -f`: Analysis focus (technical, business, all)
- `--output, -o`: Output format (terminal, markdown, json)

### Explain Specific Files

Get detailed explanations for specific files:

```bash
clara explain path/to/file.js
clara explain path/to/file.js --audience non-technical
```

Options:
- `--audience, -a`: Target audience (technical, non-technical, all)
- `--model, -m`: AI model to use (default: gpt-4o-mini)
- `--format, -f`: Output format (terminal, markdown, json)

### Available Commands

```
Commands:
  interactive         Start interactive conversation with Clara
  analyze             Analyze an entire codebase directory
  explain             Explain specific files or code snippets
  help [command]      Display help for command
```

## Development

```bash
# Run in development mode with auto-reload
bun dev

# Run tests
bun test

# Run specific test file
bun test src/tests/basic.test.ts

# Build for production
bun build
```

## Memory System

Clara uses a plaintext-based memory system stored in the user's home directory:

- Base location: `~/.config/clara/`
- Project-specific memories organized by current working directory paths
- Markdown format for all stored information
- Topic-based organization with folders for:
  - **Codebase**: Structure, patterns, conventions
  - **Users**: Preferences, common questions
  - **Insights**: Business and technical connections
  - **Technical**: Implementation details, architecture
  - **Business**: Value propositions, stakeholder impacts

The memory system enables Clara to provide more personalized and context-aware assistance across sessions.

## Architecture

Clara is built with a multi-agent architecture:

### Core Components

- **Main Interface**: Orchestrates agents and tools, maintains conversation context
- **CLI Layer**: Parses commands and options, manages user interactions

### Agents

- **Core Clara**: Main interface and orchestration
- **Thinker Agent**: Deep reasoning and complex problem solving (using OpenAI o1)
- **Parser Agent**: Specialized in code understanding (using OpenAI 4o-mini)
- **Meme Agent**: Generates programming-related memes
- **Pun Agent**: Creates programming puns and jokes
- **Search Agent**: Specialized in finding relevant information

### Tools

Clara leverages multiple tools to interact with codebases:

- **Search Tool**: Find files and code patterns with regex support
- **File Reader**: Read and parse code files
- **Command Tool**: Execute shell commands
- **Memory Tools**: Read/write to persistent storage
- **Analysis Tools**: Parse code structure and relationships

## Extending Clara

Clara is designed to be extensible with custom agents and tools:

1. Create a new agent in `src/agents/`
2. Implement the corresponding tool in `src/tools/`
3. Register the new tool in `src/tools/index.ts`

## Troubleshooting

### Common Issues

- **API Key Issues**: Ensure your API keys are correctly set in `.env`
- **Permission Errors**: Check CLI executable permissions with `chmod +x src/cli/index.ts`
- **Memory Access**: Verify the `~/.config/clara/` directory exists and is writable

### Debug Mode

Enable debug mode for verbose logging:

```bash
DEBUG=true clara interactive
```

## License

MIT