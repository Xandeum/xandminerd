const si = require('systeminformation');
const os = require('os');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// const getDriveInfo = async () => {
// const platform = os.platform(); //win32, darwin

//     try {
//         // const drives = await si.diskLayout()
//         // console.log("diskLayout>>> ", drives)
//         // const drives = await si.blockDevices()
//         // console.log("blockDevices>>> ", drives)
//         const drives = await si.fsSize()
//         console.log("fsSize>>> ", drives)
//         return drives;
//     } catch (err) {
//         console.log("error while reading system info>>> ", err)
//     }
// }

const getDriveInfo = async () => {
    let drives = [];
    try {
        const blockDevices = await si.blockDevices();
        console.log("blockDevices >>> ", blockDevices);
        if (blockDevices && blockDevices.length > 0) {
            for (const device of blockDevices) {
                const fsSize = await si.fsSize(device?.identifier);
                console.log(`fsSize for device ${device?.identifier} >>> `, fsSize);

                let drive = {
                    id: device?.uuid,
                    identifier: device?.identifier,
                    capacity: device?.size,
                    mount: device?.mount,
                    type: device?.type,
                    device: device?.device,
                    name: device?.name,
                    fsUsed: 0,
                    fsAvailable: 0,
                    fsSize: 0
                };

                if (fsSize && fsSize.length > 0) {
                    const fsInfo = fsSize.find(fs => fs?.fs === drive?.name);
                    if (fsInfo) {
                        drive.fsUsed = fsInfo?.used;
                        drive.fsAvailable = fsInfo?.available;
                        drive.fsSize = fsInfo?.size;
                    }
                }

                drives.push(drive);
            }
        }

        console.log("drive list >>> ", drives);
        return drives;
    } catch (err) {
        console.log("error while reading system info >>> ", err);
    }
};

// Function to convert bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const getDiskSpaceInfo = async () => {
    let drives = [];
    const platform = os.platform(); //win32, darwin
    // try {
    //     const diskLayout = await si.diskLayout()
    //     console.log("diskLayout>>> ", diskLayout)
    //     const blockDevices = await si.blockDevices()
    //     console.log("blockDevices>>> ", blockDevices)
    //     const fsSize = await si.fsSize()
    //     console.log("fsSize>>> ", fsSize)

    //     const drives = [{ ...diskLayout[0], available: fsSize[fsSize.length - 1]?.available }]
    //     console.log("drives>>> ", drives)
    //     return drives;
    // } catch (err) {
    //     console.log("error while reading system info>>> ", err)
    // }
    console.log('Disk Information:');
    try {
        console.log('Disk Information:');

        if (platform === 'darwin') {
            // Execute 'df' command to get file system information on Unix-like systems
            // const stdout = execSync('df -P -l').toString();
            // const command = 'df -h | grep -E "^/dev/"';

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
                    fsUsed: 0,
                    available: 0,
                    capacity: 0
                };

                if (totalSize && usedSpace && availableSpace) {
                    drive.fsUsed = usedSpace;
                    drive.available = availableSpace;
                    drive.capacity = totalSize;
                } else {
                    console.log('Unable to retrieve main hard drive information.');
                }
                console.log("drive >>> ", drive);
                drives.push(drive);
            } catch (error) {
                console.error(`Error executing command: ${error.message}`);
            }
            return drives;
        } else if (platform === 'linux') {
            // Linux-specific logic
            const command = 'df -h --output=source,size,used,avail | grep -E "^/dev/"';

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing command: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`Command error: ${stderr}`);
                    return;
                }

                // Parse the output for Linux
                const lines = stdout.trim().split('\n');
                let mainDriveInfo = null;

                lines.forEach((line) => {
                    const columns = line.split(/\s+/);
                    const [filesystem, size, used, avail] = columns;

                    // Focus on the root filesystem ("/") or the first physical drive
                    if (columns.length >= 4) {
                        mainDriveInfo = {
                            drive: filesystem,
                            total: size,
                            used: used,
                            avail: avail,
                        };
                    }
                });

                if (mainDriveInfo) {
                    console.log('Main Hard Drive Information:');
                    console.log('---------------------------');
                    console.log(`Drive: ${mainDriveInfo.drive}`);
                    console.log(`Total: ${mainDriveInfo.total}`);
                    console.log(`Used: ${mainDriveInfo.used}`);
                    console.log(`Available: ${mainDriveInfo.avail}`);
                } else {
                    console.log('Unable to retrieve main hard drive information.');
                }
            });
        }

        else if (platform === 'win32') {
            // Execute 'wmic' command to get disk information on Windows
            const stdout = execSync('wmic logicaldisk get caption,size,freespace').toString();
            const lines = stdout.split('\r\r\n').filter(line => line.trim() !== '');

            lines.forEach((line, index) => {
                if (index > 0) { // Skip the header
                    const [caption, size, freespace] = line.trim().split(/\s+/);

                    console.log(`\nDrive ${index}:`);
                    console.log(`- Device: ${caption}`);
                    console.log(`- Type: N/A`);
                    console.log(`- Size: ${formatBytes(parseInt(size) * 1024)}`);
                    console.log(`- Interface: N/A`);

                    console.log(`\nDrive ${index} (File System):`);
                    console.log(`- Size: ${formatBytes(parseInt(size) * 1024)}`);
                    console.log(`- Used: ${formatBytes((parseInt(size) - parseInt(freespace)) * 1024)}`);
                    console.log(`- Available: ${formatBytes(parseInt(freespace) * 1024)}`);
                    console.log(`- Capacity: ${((parseInt(size) - parseInt(freespace)) / parseInt(size)).toFixed(2) * 100}%`);
                }
            });
        } else {
            console.error('Unsupported operating system.');
        }
    } catch (error) {
        console.error('Error fetching disk information:', error);
    }

};





const { execSync } = require('child_process');

// Function to convert bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to parse human-readable sizes into bytes
function parseSize(sizeStr) {
    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2];
    const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
    return value * (units[unit] || 1);
}

// Helper function to format bytes into human-readable sizes
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    while (bytes >= 1024 && unitIndex < units.length - 1) {
        bytes /= 1024;
        unitIndex++;
    }
    return `${bytes.toFixed(1)}${units[unitIndex]}`;
}





//test network speed
const testNetworkSpeed = async () => {

    // const imageUrl = "https://source.unsplash.com/random?topics=nature";
    // let startTime, endTime;
    // let imageSize;

    // try {
    //     startTime = new Date().getTime();

    //     const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    //     imageSize = response.headers['content-length'];
    //     console.log(`Image size: ${imageSize / 1024} KB`);

    //     endTime = new Date().getTime();

    //     const timeDuration = (endTime - startTime) / 1000;
    //     const loadedBits = imageSize * 8;

    //     const speedInBps = (loadedBits / timeDuration).toFixed(2);
    //     const speedInKbps = (speedInBps / 1024).toFixed(2);
    //     const speedInMbps = (speedInKbps / 1024).toFixed(2);

    //     console.log(`${speedInBps} bps`);
    //     console.log(`${speedInKbps} kbps`);
    //     console.log(`${speedInMbps} Mbps`);

    //     return { speedInBps, speedInKbps, speedInMbps };
    // } catch (error) {
    //     console.error(`Error: ${error.message}`);
    //     return null;
    // }

    console.log("Testing network speed...");

    return new Promise((resolve, reject) => {
        const command = 'fast --upload --json'; // Adjust the command as needed

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`Error executing command: ${error.message}`);
                reject(`Error executing command: ${error.message}`);
                return;
            }

            if (stderr) {
                console.log(`Command stderr: ${stderr}`);
                reject(`Command stderr: ${stderr}`);
                return;
            }

            console.log(`Command stdout: ${stdout}`);
            // Resolve the Promise with the output (stdout)
            resolve(stdout);
        });
    });

}

module.exports = { getDriveInfo, getDiskSpaceInfo, testNetworkSpeed }