#!/bin/bash
set -e

# Clara Installation Script
# This script builds and installs Clara as a single executable on your system

echo "📦 Clara Installation Script"
echo "============================="

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is required but not installed."
    echo "Please install Bun first: https://bun.sh/"
    exit 1
fi

# Clone repo if running remotely, otherwise use current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo "✅ Using existing Clara repository"
    cd "$SCRIPT_DIR"
else
    echo "🔄 Cloning Clara repository..."
    git clone https://github.com/yourusername/clara.git
    cd clara
fi

# Install dependencies
echo "📚 Installing dependencies..."
bun install

# Build the project with CLI entrypoint
echo "🔨 Building Clara..."
bun build ./src/cli/index.ts --outfile ./dist/clara.js --target bun

# Determine install location
INSTALL_DIR="$HOME/.local/bin"
if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    echo "📁 Created directory: $INSTALL_DIR"
fi

# Check if $INSTALL_DIR is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "⚠️ $INSTALL_DIR is not in your PATH"
    echo "Add the following to your ~/.bashrc or ~/.zshrc:"
    echo "export PATH=\"\$PATH:$INSTALL_DIR\""
fi

# Package as executable using Bun's binary compilation
echo "📦 Packaging Clara as executable..."
bun build --compile ./src/cli/index.ts --outfile "$INSTALL_DIR/clara" --target bun
chmod +x "$INSTALL_DIR/clara"

# Create config directory if it doesn't exist
CONFIG_DIR="$HOME/.config/clara"
if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    echo "📁 Created config directory: $CONFIG_DIR"
fi

echo "✨ Clara has been installed successfully!"
echo "Run 'clara --help' to get started"