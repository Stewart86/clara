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

Clara is built using a suite of specialized agents that work together to analyze and explain code:

1. **Thinker Agent**: Organizes complex thoughts and outlines potential solutions.
2. **Parser Agent**: Analyzes code snippets to understand structure and functionality.
3. **Meme Agent**: Injects light-hearted humor through relatable programming memes.
4. **Pun Agent**: Crafts programming-related puns to add a fun twist to explanations.
5. **Search Agent**: Efficiently locates code patterns and files within the project.
6. **Assistant Agent**: Provides comprehensive assistance by managing and coordinating the other agents.

- **End-to-End Code Investigation**: Clara methodically reads, parses, and interprets code, piecing together the logic and purpose behind every module or function.
- **Layman-Friendly Explanations**: Clara transforms technical jargon into accessible language, bridging the gap between complex code logic and business strategy.
- **Business-Savvy Insights**: With a strong business focus, Clara highlights how specific code components impact overall business functions and operational efficiency.
- **Engaging and Casual Interaction**: Clara maintains a professional yet approachable demeanor, occasionally using humor to make technical discussions more engaging.

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
- **Command Tool**: Execute shell commands with security checks
- **Memory Tools**: Read/write to persistent storage
- **Analysis Tools**: Parse code structure and relationships

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

## Troubleshooting

### Common Issues

- **API Key Issues**: Ensure your API keys are correctly set in `.env`
- **Permission Errors**: Check CLI executable permissions with `chmod +x src/cli/index.ts`
- **Memory Access**: Verify the `~/.config/clara/` directory exists and is writable

Debug logs show detailed system information including search operations, file access, and tool execution.

## License

MIT
