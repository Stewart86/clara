# Clara

An AI Assistant that provides clarity to your business codebase.

## Overview

Clara is an agentic AI assistant designed to simplify the complexity of codebases. Targeting both technical and business stakeholders, Clara leverages a suite of integrated tools to thoroughly investigate and understand code from start to finish.

Clara runs entirely using a command line interface. It can be used interactively or via the CLI with additional parameters for different configurations.

## Features

- **End-to-End Code Investigation**: Clara methodically reads, parses, and interprets code, piecing together the logic and purpose behind every module or function.
- **Layman-Friendly Explanations**: Clara transforms technical jargon into accessible language, bridging the gap between complex code logic and business strategy.
- **Business-Savvy Insights**: With a strong business focus, Clara highlights how specific code components impact overall business functions and operational efficiency.
- **Engaging and Casual Interaction**: Clara maintains a professional yet approachable demeanor, occasionally using humor to make technical discussions more engaging.

## Installation

```bash
# Install dependencies
bun install

# Make the CLI executable
chmod +x src/cli/index.ts

# Create symlink to use 'clara' command globally
bun link
```

## Usage

### Interactive Mode

```bash
clara interactive
```

### Code Analysis

```bash
clara analyze --directory ./my-project
```

### Explain Specific Files

```bash
clara explain path/to/file.js
```

## Development

```bash
# Run in development mode with auto-reload
bun dev

# Run tests
bun test

# Build for production
bun build
```

## Memory System

Clara uses a plaintext-based memory system stored in the user's home directory:

- Base location: `~/.config/clara/`
- Project-specific memories organized by current working directory paths
- Markdown format for all stored information
- Topic-based organization with folders for codebase info, user preferences, insights, technical concepts, and business insights

## Architecture

Clara is built with a multi-agent architecture:

- **Core Clara**: Main interface and orchestration
- **Thinker Agent**: Deep reasoning and complex problem solving
- **Parser Agent**: Specialized in code understanding
- **Meme Agent**: Generates programming-related memes
- **Pun Agent**: Creates programming puns and jokes

## License

MIT