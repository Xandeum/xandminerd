const si = require('systeminformation');
const os = require('os');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const speedTest = require('speedtest-net');
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

const getDiskSpaceInfo = async () => {
    let drives = [];
    const platform = os.platform(); //win32, darwin

    try {
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
                drives.push(drive);
            } catch (error) {
                console.error(`Error executing command: ${error.message}`);
            }
            return drives;
        } else if (platform === 'linux') {
            // Linux-specific logic using lsblk
            const command = 'lsblk -o NAME,SIZE,FSUSED,FSUSE%,RO,TYPE,MOUNTPOINTS --json';

            // Make the function async
            return (async () => {
                try {
                    // Execute the command using execPromise
                    const { stdout } = await execPromise(command);

                    // Parse the JSON output from lsblk
                    const data = JSON.parse(stdout);

                    console.log("data >>> ", data);

                    // Filter for block devices that meet the criteria:
                    // 1. Type is 'disk' or 'part'
                    // 2. Size is greater than 10GB
                    // 3. RO (read-only) is 0
                    const filteredDevices = data.blockdevices.filter(device => {
                        // Convert size to bytes for comparison
                        const sizeInBytes = parseSize(device.size);
                        console.log("size >>> ", sizeInBytes);
                        console.log("device >>> ", device);
                        return (
                            (device.type === 'disk' || device.type === 'part') &&
                            sizeInBytes > 10 * 1024 ** 3 && // Greater than 10GB
                            device.ro === false // Read-only is 0 (write permissions)
                        );
                    });

                    // const drives = [];
                    if (filteredDevices.length > 0) {
                        console.log('Filtered Hard Drive/Partition Information:');
                        console.log('-----------------------------------------');
                        filteredDevices.forEach(device => {
                            console.log(`Drive: /dev/${device.name}`);
                            console.log(`Total: ${device.size}`);
                            console.log(`Used: ${device.fused || 'N/A'}`);
                            console.log(`Usage: ${device.fsuse || 'N/A'}`);
                            console.log(`Read-Only: ${device.ro === '1' ? 'Yes' : 'No'}`);
                            console.log(`Type: ${device.type}`);
                            console.log(`Mount Points: ${device.mountpoints?.join(', ') || 'N/A'}`);
                            console.log('-----------------------------------------');

                            const drive = {
                                name: device.name,
                                fsUsed: device.fused || 0,
                                available: device.size - (device.fused || 0),
                                // capacity: device.size,
                                capacity: parseSize(device.size),
                                type: device.type,
                                mountpoints: device.mountpoints,
                            };
                            drives.push(drive);
                        });
                    } else {
                        console.log('No disks or partitions found that meet the criteria.');
                    }

                    // Return the populated drives array
                    return drives;
                } catch (error) {
                    console.error(`Error executing command: ${error.message}`);
                    return []; // Return an empty array in case of error
                }
            })();
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
    const unit = match[2];
    const units = { B: 1, KB: 1024, M: 1024 ** 2, G: 1024 ** 3, TB: 1024 ** 4 };
    return value * (units[unit] || 1);
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

    // return new Promise((resolve, reject) => {
    //     const test = speedTest({ maxTime: 5000 }); // Set max time for the test (optional)

    //     test.on('data', (data) => {
    //         console.log('Speed Test Results:', data);
    //         resolve(data); // Resolve with the speed test results
    //     });

    //     test.on('error', (err) => {
    //         console.error('Speed Test Error:', err);
    //         reject(err); // Reject if an error occurs
    //     });
    // });

}

module.exports = { getDriveInfo, getDiskSpaceInfo, testNetworkSpeed }