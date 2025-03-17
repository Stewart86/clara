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

Clara runs entirely via a command line interface. It can be used interactively or with CLI parameters for different analysis configurations.

## Features

- **End-to-End Code Investigation**: Clara methodically reads, parses, and interprets code, piecing together the logic and purpose behind every module or function.
- **Layman-Friendly Explanations**: Clara transforms technical jargon into accessible language, bridging the gap between complex code logic and business strategy.
- **Business-Savvy Insights**: With a strong business focus, Clara highlights how specific code components impact overall business functions and operational efficiency.
- **Engaging and Casual Interaction**: Clara maintains a professional yet approachable demeanor, occasionally using humor to make technical discussions more engaging.

## Agents

Clara is built using an adaptive orchestration architecture with specialized agents that work together to analyze and explain code:

1. **Orchestrator Agent**: Coordinates the entire workflow, creating detailed execution plans with dependencies between steps. Uses OpenAI's o3-mini model for efficient planning.

2. **Search Agent**: Efficiently locates code patterns and files with incremental search strategies and result caching. Optimized for finding precisely what you need in large codebases.

3. **Memory Agent**: Manages Clara's knowledge system with automatic categorization, metadata tagging, and relationship tracking between information.

4. **Command Agent**: Safely executes shell commands with enhanced security validation, result parsing, and error recovery strategies.

5. **Verification Agent**: Validates outputs for accuracy, performs fact-checking against the codebase, and suggests corrections when issues are found.

6. **User Intent Agent**: Deeply analyzes requests to identify user's true objectives, implicit needs, and priority information.

7. **Meme Agent**: Injects light-hearted humor through relatable programming memes.

8. **Pun Agent**: Crafts programming-related puns to add a fun twist to explanations.

The agent system includes a comprehensive context management system that maintains workflow state, tracks resources, and prevents redundant operations.

## Prerequisites

- [Bun](https://bun.sh) (>= 1.0.0)
- Node.js (>= 18.0.0)
- API keys for supported AI models (OpenAI, Anthropic, etc.)

### Optional Dependencies

#### Recommended Modern CLI Tools

- **File Operations**:

  - [fd](https://github.com/sharkdp/fd) - Modern alternative to `find` for improved search
  - [ripgrep](https://github.com/BurntSushi/ripgrep) - Fast code search tool
  - [bat](https://github.com/sharkdp/bat) - A `cat` clone with syntax highlighting
  - [exa/eza](https://github.com/eza-community/eza) - Modern replacement for `ls`

- **Data Processing**:

  - [jq](https://stedolan.github.io/jq/) - Command-line JSON processor
  - [yq](https://github.com/mikefarah/yq) - YAML processor

- **JavaScript Development**:
  - [Bun](https://bun.sh) - All-in-one JavaScript runtime and toolkit
  - [Deno](https://deno.land) - Secure JavaScript/TypeScript runtime

Clara's command security system has built-in support for all these tools.

## Installation

### Using the Install Script

The easiest way to install Clara is using the provided installation script:

```bash
# Clone the repository
git clone https://github.com/Stewart86/clara.git
cd clara

# Run the installation script
./install.sh
```

The script will:

1. Install dependencies
2. Build the application
3. Install Clara to ~/.local/bin
4. Create the necessary config directory

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/Stewart86/clara.git
cd clara

# Install dependencies
bun install

# Build the application
bun build

# Make the CLI executable and run it directly
chmod +x src/cli/index.ts
./src/cli/index.ts --help

# Or create a symlink to use 'clara' command globally
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

### Development Commands

```bash
# Run in development mode with auto-reload
bun dev

# Build for production (outputs to dist directory)
bun build

# Run Clara directly during development
bun clara
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test src/tests/basic.test.ts

# Run security-specific tests
bun test:security

# Test command security with manual interaction
bun test:manual

# Run security penetration tests
bun test:pentest
```

## Memory System

Clara uses an enhanced plaintext-based memory system with structured metadata and relationship tracking:

- Base location: `~/.config/clara/`
- Project-specific memories organized by current working directory paths
- Markdown format with YAML frontmatter for metadata
- Advanced indexing layer for efficient search and retrieval
- Relationship mapping between related memory files
- Topic-based organization with folders for:
  - **Codebase**: Structure, patterns, conventions
  - **Users**: Preferences, common questions
  - **Insights**: Business and technical connections
  - **Technical**: Implementation details, architecture
  - **Business**: Value propositions, stakeholder impacts

Each memory file includes structured metadata:
```
---
title: Authentication Flow
created: 2023-04-20T14:53:00Z
updated: 2023-05-15T09:30:00Z
tags: [auth, security, jwt, oauth]
related: [technical/jwt.md, technical/oauth.md]
summary: Overview of the authentication process using JWT tokens and OAuth 2.0
importance: high
---

# Authentication Flow

The authentication system uses JWT tokens with OAuth 2.0...
```

The memory system enables Clara to maintain context across sessions, recognize relationships between topics, and provide more personalized assistance.

## Architecture

Clara is built with an adaptive orchestration architecture featuring context management:

### Core Components

- **Context Management System**: Maintains complete workflow state and history
- **Orchestrator Agent**: Creates and executes plans with step dependencies
- **Specialized Worker Agents**: Task-specific agents optimized for particular functions
- **CLI Layer**: Parses commands and options, manages user interactions

### Agents

- **Orchestrator Agent**: Coordinates workflow, creates execution plans with dependency management (using OpenAI o3-mini)
- **Search Agent**: Finds files and code with incremental search strategies (using OpenAI gpt-4o-mini)
- **Memory Agent**: Manages knowledge with metadata tagging and relationship tracking (using OpenAI o3-mini)
- **Command Agent**: Executes shell commands with security validation and result parsing (using OpenAI o3-mini)
- **Verification Agent**: Validates outputs for accuracy against the codebase (using OpenAI o3-mini)
- **User Intent Agent**: Analyzes requests to identify true objectives and priorities (using OpenAI o3-mini)
- **Meme Agent**: Generates programming-related memes
- **Pun Agent**: Creates programming puns and jokes

### Tools

Clara leverages context-aware tools that maintain state across operations:

- **Search Tool**: Find files and code patterns with regex support, progressive search strategies, and result caching
- **File Reader**: Read and parse code files with line range control
- **Command Tool**: Execute shell commands with security checks and result interpretation
- **Memory Tools**: Enhanced read/write to persistent storage with metadata and indexing
- **Analysis Tools**: Parse code structure and relationships
- **Context Tools**: Maintain and share execution state between agents

#### Command Security

Clara's command execution system implements a multi-tiered security approach:

- **Command Classification**: Commands are categorized as safe, cautious, or dangerous
- **Pattern Recognition**: Detects potentially harmful patterns like root-level operations
- **User Approval**: Requires interactive confirmation for cautious/dangerous commands
- **Session Memory**: Option to remember approvals for the duration of a session
- **Hard Rejections**: Immediately blocks commands that could cause system damage

The system uses standard input for interactive confirmation dialogs.

##### Modern CLI Tool Support

Clara's security system supports both traditional Unix commands and modern alternatives:

**Safe Tools** (run without confirmation):

- **File Listing**: `ls`, `exa`, `lsd`
- **File Search**: `find`, `fd`
- **Content Search**: `grep`, `rg` (ripgrep)
- **File Viewing**: `cat`, `bat`
- **JSON/YAML Processing**: `jq`, `yq`
- **Disk Usage**: `du`, `df`, `dust`, `duf`

**Caution Tools** (require confirmation):

- **JavaScript Runtimes**: `node`, `deno`, `bun` (non-install commands)
- **Package Managers**: `npm`, `yarn`, `pnpm` (non-install commands)
- **Build Tools**: `cargo`, `go` (non-install commands)

**Dangerous Tools** (high scrutiny, may be rejected):

- **System Modification**: `sudo`, `chmod`, `chown`
- **Package Installation**: `npm install`, `bun add`, `deno install`
- **Network Tools**: `curl`, `wget`
- **Container Tools**: `docker`, `podman`, `nerdctl`

##### Testing the Command Security System

Clara includes comprehensive tests for the command security system:

```bash
# Run automated unit tests
bun test:security

# Run a manual interaction test to verify confirmation dialogs
bun test:manual

# Run a penetration test to check for security bypasses
bun test:pentest
```

The penetration test script (`test:pentest`) attempts to bypass the security system by generating permutations of dangerous commands with various obfuscation techniques. It produces a detailed report showing which commands were blocked and any potential vulnerabilities discovered.

## Extending Clara

Clara is designed to be extensible with custom agents and tools:

1. Create a new agent in `src/agents/`
2. Implement the corresponding tool in `src/tools/`
3. Register the new tool in `src/tools/index.ts`

### Experimental Features

Clara includes several experimental features that can be enabled or disabled:

```bash
# List available experimental features
clara feature list

# Enable a feature
clara feature enable multi-agent-system

# Disable a feature
clara feature disable memory-indexing
```

Available experimental features:

- **multi-agent-system**: Enables the adaptive orchestration architecture (default: enabled)
- **memory-indexing**: Enables advanced memory indexing and relationship tracking
- **agent-activity**: Shows real-time agent activity in the terminal (default: enabled)
- **context-sharing**: Enables context sharing between different agents (default: enabled)

## Troubleshooting

### Common Issues

- **API Key Issues**: Ensure your API keys are correctly set in `.env`
- **Permission Errors**: Check CLI executable permissions with `chmod +x src/cli/index.ts`
- **Memory Access**: Verify the `~/.config/clara/` directory exists and is writable

Debug logs show detailed system information including search operations, file access, and tool execution.

## License

MIT
