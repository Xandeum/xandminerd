#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Check if running as root
sudoCheck() {
    if [ "$(id -u)" != "0" ]; then
        echo "This script must be run as root" 1>&2
        exit 1
    fi
}

sudoCheck

# Resolve the sibling xandminer directory dynamically (Fix from Issue #4)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PARENT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
XANDMINER_DIR="$PARENT_DIR/xandminer"

# Update xandminer
echo "Updating xandminer at $XANDMINER_DIR..."
if [ -d "$XANDMINER_DIR" ]; then
    cd "$XANDMINER_DIR"
    
    # Git operations
    git stash --include-untracked || true
    git fetch origin
    git checkout main
    git reset --hard origin/main
    
    # SECURITY FIX: Use 'npm ci' for deterministic, clean installation
    npm ci
    
    # Build the project
    npm run build
else
    echo "Error: xandminer directory not found at $XANDMINER_DIR. Please ensure it is installed as a sibling directory."
    exit 1
fi

echo "xandminer upgrade completed successfully!"