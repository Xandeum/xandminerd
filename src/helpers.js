const os = require('os');
const fs = require('fs').promises;
const https = require('https');
const path = require('path');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const util = require('util');

const { SYMLINKPATH, XANDMINERD_VERSION } = require('./CONSTS');
const execPromise = util.promisify(exec);

const getDiskSpaceInfo = async () => {
    let drives = [];
    const platform = os.platform(); //win32, darwin

    try {
        if (platform === 'darwin') {

            const command = 'diskutil apfs list';

            try {
                const { stdout, stderr } = await execPromise(command);

                if (stderr) {
                    console.error(`Command error: ${stderr}`);
                    return drives;
                }

                // Parse the output
                const lines = stdout.split('\n');
                let totalSize = null;
                let usedSpace = null;
                let availableSpace = null;

                lines.forEach((line) => {
                    if (line.includes('Size (Capacity Ceiling)')) {
                        totalSize = parseSize(line.split(':')[1].trim());
                    } else if (line.includes('Capacity In Use By Volumes')) {
                        usedSpace = parseSize(line.split(':')[1].trim());
                    } else if (line.includes('Capacity Not Allocated')) {
                        availableSpace = parseSize(line.split(':')[1].trim());
                    }
                });

                let drive = {
                    used: 0,
                    available: 0,
                    capacity: 0
                };

                if (totalSize && usedSpace && availableSpace) {
                    drive.used = usedSpace;
                    drive.available = availableSpace;
                    drive.capacity = totalSize;
                } else {
                    console.log('Unable to retrieve main hard drive information.');
                }
                drives.push(drive);
            } catch (error) {
                console.error(`Error executing command: ${error.message}`);
            }
            return drives;
        } else if (platform === 'linux') {
            const command = 'lsblk -o NAME,SIZE,FSUSED,FSUSE%,RO,TYPE,MOUNTPOINTS --json';

            try {
                const { stdout } = await execPromise(command);
                const data = JSON.parse(stdout);

                // Filter devices to include disk, part, and lvm types
                const filteredDevices = data.blockdevices.filter(device => {
                    const sizeInBytes = parseSize(device.size || '0');
                    return (
                        (device.type === 'disk' || device.type === 'part' || device.type === 'lvm') &&
                        sizeInBytes > 10 * 1024 ** 3 &&
                        device.ro === false
                    );
                });

                // Recursive function to process devices and collect only leaf nodes
                async function processDevice(device, drives) {
                    // If the device has children, process them instead of adding the parent
                    if (device?.children?.length > 0) {
                        for (const child of device.children) {
                            await processDevice(child, drives); // Recursively process children
                        }
                    } else {
                        // This is a leaf node (no children), process it
                        const sizeInBytes = parseSize(device.size || '0');
                        const isMaxFilled = parseFloat(device['fsuse%'] || '0%') >= 94.0;

                        // Skip if size is too small and not an lvm type
                        if (sizeInBytes < 10 * 1024 ** 3 && device.type !== 'lvm') return;

                        // Check for 'xandeum-pages' file
                        let dedicated = 0;
                        if (device?.mountpoints?.length > 0 && device.mountpoints[0]) {
                            const mountPoint = device.mountpoints[0];
                            const filePath = path.join(mountPoint, 'xandeum-pages');
                            try {
                                const stats = await fs.stat(filePath);
                                if (stats.isFile()) {
                                    dedicated = stats.size;
                                }
                            } catch (error) {
                                // File doesn't exist or other error
                                dedicated = 0;
                            }
                        }

                        // Add the leaf node to drives
                        const drive = {
                            name: device?.name,
                            used: parseSize(device?.fsused || '0') || 0,
                            available: isMaxFilled ? 0 : (parseSize(device?.size || '0') - parseSize(device?.fsused || '0')) || 0,
                            capacity: parseSize(device?.size || '0') || 0,
                            type: device?.type,
                            mount: device?.mountpoints,
                            percentage: device?.fsuse,
                            dedicated: dedicated
                        };
                        drives.push(drive);
                    }
                }

                // Process all filtered devices
                if (filteredDevices.length > 0) {
                    for (const device of filteredDevices) {
                        await processDevice(device, drives);
                    }
                } else {
                    console.log('No disks, partitions, or LVM volumes found that meet the criteria.');
                }

                return drives;
            } catch (error) {
                console.error(`Error executing command: ${error.message}`);
                return [];
            }
        }

        // else if (platform === 'win32') {
        //     // Execute 'wmic' command to get disk information on Windows
        //     const stdout = execSync('wmic logicaldisk get caption,size,freespace').toString();
        //     const lines = stdout.split('\r\r\n').filter(line => line.trim() !== '');

        //     lines.forEach((line, index) => {
        //         if (index > 0) { // Skip the header
        //             const [caption, size, freespace] = line.trim().split(/\s+/);

        //             console.log(`\nDrive ${index}:`);
        //             console.log(`- Device: ${caption}`);
        //             console.log(`- Type: N/A`);
        //             console.log(`- Size: ${formatBytes(parseInt(size) * 1024)}`);
        //             console.log(`- Interface: N/A`);

        //             console.log(`\nDrive ${index} (File System):`);
        //             console.log(`- Size: ${formatBytes(parseInt(size) * 1024)}`);
        //             console.log(`- Used: ${formatBytes((parseInt(size) - parseInt(freespace)) * 1024)}`);
        //             console.log(`- Available: ${formatBytes(parseInt(freespace) * 1024)}`);
        //             console.log(`- Capacity: ${((parseInt(size) - parseInt(freespace)) / parseInt(size)).toFixed(2) * 100}%`);
        //         }
        //     });
        // } 
        else {
            console.error('Unsupported operating system.');
            return [];
        }
    } catch (error) {
        console.error('Error fetching disk information:', error);
    }

};


// Helper function to parse human-readable sizes into bytes
function parseSize(sizeStr) {
    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    let unit = match[2];
    // Normalize: use only the first letter of the unit
    unit = unit[0].toUpperCase();
    const units = {
        B: 1,
        K: 10 ** 3,    // 1,000 bytes
        M: 10 ** 6,    // 1,000,000 bytes
        G: 10 ** 9,    // 1,000,000,000 bytes
        T: 10 ** 12    // 1,000,000,000,000 bytes
    };
    return value * (units[unit] || 1);
}

const runCommand = (command, args) => {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args);
        let stdoutData = '';
        let stderrData = '';

        process.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command ${command} exited with code ${code}: ${stderrData}`));
            } else {
                resolve(stdoutData);
            }
        });

        process.on('error', (error) => {
            reject(new Error(`Failed to spawn ${command}: ${error.message}`));
        });
    });
};

const dedicateSpace = async (size, mount) => {
    try {
        const platform = os.platform(); // 'win32', 'darwin', 'linux'

        // For Linux-based OS
        if (platform === 'linux') {
            // Use fallocate to allocate actual disk space
            const sizeInGB = size;
            // const filePath = `${mount}/xandeum-pages`;
            const filePath = path.join(mount, 'xandeum-pages');
            const symlinkPath = SYMLINKPATH; // Path to the symlink

            // Check if the file already exists and store its original size
            let fileExisted = false;
            let originalSize = 0;
            try {
                const stats = await fs.stat(filePath); // Get file stats
                fileExisted = true;
                originalSize = stats.size; // Current size in bytes
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('Error checking file stats:', error.message);
                    throw error; // Rethrow if not "file not found"
                }
            }

            // Calculate the new total size
            const newSizeInBytes = originalSize + sizeInGB * 1e9;

            // Use fallocate to resize the file
            try {
                // SECURITY FIX: Replaced exec with runCommand (spawn) to prevent injection
                await runCommand('fallocate', ['-l', newSizeInBytes.toString(), filePath]);
                console.log(`File resized to ${newSizeInBytes / 1e9}GB`);
            } catch (fallocateError) {
                console.error('Error allocating space:', fallocateError.message);
                return { ok: false, error: `Failed to allocate space: ${fallocateError.message}` };
            }

            // Create a symlink to the file at /var/run/xandeum-pod
            try {
                // Ensure the directory for the symlink exists
                const symlinkDir = path.dirname(symlinkPath); // Get the directory path (/var/run)
                try {
                    await fs.mkdir(symlinkDir, { recursive: true }); // Create directory if it doesn't exist
                    console.log(`Symlink directory ensured at ${symlinkDir}`);
                } catch (mkdirError) {
                    console.error('Error creating symlink directory:', mkdirError.message);
                    // Revert the file size
                    await revertFileSize(filePath, fileExisted, originalSize);
                    return { ok: false, error: `Failed to create symlink directory: ${mkdirError.message}` };
                }

                // Check if the target file exists before creating the symlink
                try {
                    await fs.access(filePath); // Verify the target file exists
                } catch (accessError) {
                    console.error('Target file does not exist or is inaccessible:', accessError.message);
                    // Revert the file size
                    await revertFileSize(filePath, fileExisted, originalSize);
                    return { ok: false, error: `Target file inaccessible: ${accessError.message}` };
                }

                // Remove existing symlink if it exists
                try {
                    await fs.unlink(symlinkPath);
                    console.log(`Removed existing symlink at ${symlinkPath}`);
                } catch (unlinkError) {
                    if (unlinkError.code !== 'ENOENT') { // Ignore if symlink doesn't exist
                        console.error('Error removing existing symlink:', unlinkError.message);
                        // Revert the file size
                        await revertFileSize(filePath, fileExisted, originalSize);
                        return { ok: false, error: `Failed to remove existing symlink: ${unlinkError.message}` };
                    }
                }

                // Create the symlink
                try {
                    await fs.symlink(filePath, symlinkPath);
                    console.log(`Symlink created at ${symlinkPath} pointing to ${filePath}`);
                } catch (symlinkError) {
                    console.error('Error creating symlink:', symlinkError.message);
                    // Revert the file size before returning the error
                    await revertFileSize(filePath, fileExisted, originalSize);
                    // Handle specific symlink errors
                    if (symlinkError.code === 'EACCES') {
                        return { ok: false, error: 'Permission denied while creating symlink.' };
                    } else if (symlinkError.code === 'EPERM') {
                        return { ok: false, error: 'Operation not permitted while creating symlink.' };
                    } else {
                        return { ok: false, error: `Failed to create symlink: ${symlinkError.message}` };
                    }
                }

                return { ok: true, path: filePath, symlink: symlinkPath }; // Return success response
            } catch (symlinkError) {
                console.error('Unexpected error during symlink creation:', symlinkError.message);
                // Revert the file size
                await revertFileSize(filePath, fileExisted, originalSize);
                return { ok: false, error: `Unexpected error during symlink creation: ${symlinkError.message}` };
            }
        } else {
            console.error('Unsupported operating system.');
            return { ok: false, error: 'Unsupported operating system.' };
        }
    } catch (error) {
        console.error('Error dedicating space:', error.message);
        return { ok: false, error: error.message }; // Return error response
    }
};

// Helper function to revert the file size if symlink creation fails
const revertFileSize = async (filePath, fileExisted, originalSize) => {
    try {
        if (!fileExisted) {
            // If the file didn't exist before, remove it
            await fs.unlink(filePath);
            console.log(`Reverted: Removed file ${filePath} as it did not exist before.`);
        } else {
            // If the file existed, resize it back to its original size
            // SECURITY FIX: Replaced exec with runCommand (spawn)
            try {
                await runCommand('fallocate', ['-l', originalSize.toString(), filePath]);
                console.log(`Reverted: File ${filePath} resized back to ${originalSize / 1e9}GB.`);
            } catch (err) {
                 throw err;
            }
        }
    } catch (revertError) {
        console.error('Error reverting file size:', revertError.message);
        throw new Error(`Failed to revert file size: ${revertError.message}`);
    }
};

const getServerInfo = async () => {

    return new Promise((resolve, reject) => {
        const hostname = os.hostname();
        let ip = '127.0.0.1'; // Default to localhost

        https.get('https://api.ipify.org?format=json', (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received.
            resp.on('end', () => {
                try {
                    const ipData = JSON.parse(data);
                    ip = ipData.ip;
                    resolve({ ok: true, data: { hostname, ip } });
                } catch (error) {
                    console.error('Error parsing IP data:', error.message);
                    resolve({ ok: false });
                }
            });

        }).on('error', (error) => {
            console.error('Error fetching IP address:', error.message);
            resolve({ ok: false });
        });
    });
}

// function to get the versions of pod and xandminerD
const getVersions = async () => {

    try {
        // run pod --version command
        const podVersionCommand = 'pod --version';
        const podVersionResult = await execPromise(podVersionCommand);
        if (podVersionResult.stderr) {
            console.error(`Error getting pod version: ${podVersionResult?.stderr}`);
            return { ok: true, xandminerd: XANDMINERD_VERSION, pod: '-' };
        }
        let podVersion = podVersionResult?.stdout?.substring(4)?.trim();

        return {
            ok: true,
            xandminerd: XANDMINERD_VERSION,
            pod: 'v' + podVersion
        };
    } catch (error) {
        console.error('Error while retrieving versions:', error?.message);
        if (error?.message?.includes('pod')) {
            return { ok: true, xandminerd: XANDMINERD_VERSION, pod: '-' };
        }
        return { ok: false, error: error.message };
    }
};

module.exports = { getDiskSpaceInfo, dedicateSpace, getServerInfo, getVersions }