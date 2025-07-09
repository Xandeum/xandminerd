#!/bin/bash

# Check if running as root
sudoCheck() {
    if [ "$(id -u)" != "0" ]; then
        echo "This script must be run as root" 1>&2
        exit 1
    fi
}

sudoCheck

# Update xandminerd
echo "Updating xandminerd..."
if [ -d "/root/xandminerd" ]; then
    cd /root/xandminerd
    git stash push -m "Auto-stash before pull" || true
    git pull
    npm install

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
    echo "Error: xandminerd directory not found. Please ensure it is installed."
    exit 1
fi

echo "xandminerd upgrade completed successfully!"
#!/bin/bash

# Check if running as root
sudoCheck() {
    if [ "$(id -u)" != "0" ]; then
        echo "This script must be run as root" 1>&2
        exit 1
    fi
}

sudoCheck

# Update xandminerd
echo "Updating xandminerd..."
if [ -d "/root/xandminerd" ]; then
    cd /root/xandminerd
    git stash push -m "Auto-stash before pull" || true
    git pull
    npm install

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
    echo "Error: xandminerd directory not found. Please ensure it is installed."
    exit 1
fi

echo "xandminerd upgrade completed successfully!"