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

# Resolve the project root directory dynamically (Fix from Issue #4)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Update xandminerd
echo "Updating xandminerd at $PROJECT_ROOT..."
if [ -d "$PROJECT_ROOT" ]; then
    cd "$PROJECT_ROOT"
    
    # Git operations
    git stash --include-untracked || true
    git fetch origin
    git checkout main
    git reset --hard origin/main
    
    # SECURITY FIX: Use 'npm ci' for deterministic, clean installation
    # This ensures we match package-lock.json exactly and removes potentially compromised node_modules
    npm ci

    # Copy keypair if needed
    if [ -f "keypairs/pnode-keypair.json" ]; then
        echo "Found pnode-keypair.json. Copying to /local/keypairs/ if not already present..."
        mkdir -p /local/keypairs
        if [ ! -f "/local/keypairs/pnode-keypair.json" ]; then
            cp keypairs/pnode-keypair.json /local/keypairs/
            echo "Copied pnode-keypair.json to /local/keypairs/"
        else
            echo "pnode-keypair.json already exists in /local/keypairs/. Skipping copy."
        fi
    fi
else
    echo "Error: xandminerd directory not found at $PROJECT_ROOT."
    exit 1
fi

echo "xandminerd upgrade completed successfully!"