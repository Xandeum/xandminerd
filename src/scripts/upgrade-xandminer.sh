#!/bin/bash

# Check if running as root
sudoCheck() {
    if [ "$(id -u)" != "0" ]; then
        echo "This script must be run as root" 1>&2
        exit 1
    fi
}

sudoCheck

# Update xandminer
echo "Updating xandminer..."
if [ -d "/root/xandminer" ]; then
    cd /root/xandminer
    git stash push -m "Auto-stash before pull" || true
    git pull
    npm install
    npm run build
else
    echo "Error: xandminer directory not found. Please ensure it is installed."
    exit 1
fi

echo "xandminer upgrade completed successfully!"