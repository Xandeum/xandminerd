const si = require('systeminformation');

const getDriveInfo = async () => {
    try {
        const drives = await si.diskLayout()
        // console.log("diskLayout>>> ", drives)
        // const drives = await si.blockDevices()
        // console.log("blockDevices>>> ", drives)
        // const drives = await si.fsSize("/")
        // console.log("fsSize>>> ", drives)
        return drives;
    } catch (err) {
        console.log("error while reading system info>>> ", err)
    }
}

const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

const getDriveDetails = () => {
    const platform = os.platform();
    if (platform === 'win32') {
        // Windows-specific command
        exec('wmic logicaldisk get DeviceID,Size,FreeSpace', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running Windows command: ${error.message}`);
                return;
            }

            const lines = stdout.split('\r\r\n').filter(Boolean);
            lines.shift(); // Remove the header line

            lines.forEach(line => {
                const [drive, size, freeSpace] = line.trim().split(/\s+/);
                console.log('Drive:', drive);
                console.log('Size:', size, 'bytes');
                console.log('Free Space:', freeSpace, 'bytes');
                console.log('Type: Local Disk (Windows)');
                console.log('------------------------');
            });
        });
    } else {
        // Unix/Linux and macOS-specific command to identify physical drives
        const mountFile = platform === 'darwin' ? '/etc/mtab' : '/proc/mounts';

        fs.readFile(mountFile, 'utf8', (mountsError, mountsData) => {
            if (mountsError) {
                console.error(`Error reading ${mountFile}: ${mountsError.message}`);
                return;
            }

            const mounts = mountsData.split('\n');
            const driveInfo = {};

            mounts.forEach(line => {
                const [filesystem, mountPoint] = line.split(/\s+/);
                if (filesystem.startsWith('/dev/')) {
                    const driveName = filesystem.split('/').pop();
                    driveInfo[driveName] = mountPoint;
                }
            });

            // Read partition sizes from /proc/partitions
            fs.readFile('/proc/partitions', 'utf8', (partitionsError, partitionsData) => {
                if (partitionsError) {
                    console.error(`Error reading /proc/partitions: ${partitionsError.message}`);
                    return;
                }

                const partitions = partitionsData.split('\n');
                partitions.shift(); // Remove the header line

                partitions.forEach(partition => {
                    const [major, minor, blocks, name] = partition.split(/\s+/);
                    if (driveInfo[name]) {
                        exec(`df -P ${driveInfo[name]}`, (dfError, dfOutput) => {
                            if (dfError) {
                                console.error(`Error running df command: ${dfError.message}`);
                                return;
                            }

                            const dfLines = dfOutput.split('\n').filter(Boolean);
                            const [filesystem, size, used, available, capacity, mountedOn] = dfLines[1].split(/\s+/);
                            console.log('Filesystem:', filesystem);
                            console.log('Size:', size, 'bytes');
                            console.log('Used Space:', used, 'bytes');
                            console.log('Type: Unix/Linux/macOS');
                            console.log('------------------------');
                        });
                    }
                });
            });
        });
    }
}

async function getDiskSpaceInfo() {
    // exec('df -k /', (error, stdout) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         return;
    //     }

    //     const lines = stdout.split('\n')[1].split(/\s+/);

    //     const usedSpaceKB = parseInt(lines[2]);
    //     const availableSpaceKB = parseInt(lines[3]);

    //     const usedSpaceGB = usedSpaceKB / 1024 / 1024;
    //     const availableSpaceGB = availableSpaceKB / 1024 / 1024;

    //     console.log(`Used Space: ${usedSpaceGB.toFixed(2)} GB`);
    //     console.log(`Available Space: ${availableSpaceGB.toFixed(2)} GB`);
    // });

    try {
        // const drives = await si.diskLayout()
        // console.log("diskLayout>>> ", drives)
        // const drives = await si.blockDevices()
        // console.log("blockDevices>>> ", drives)
        const drives = await si.fsSize()
        // console.log("fsSize>>> ", drives)
        return drives;
    } catch (err) {
        console.log("error while reading system info>>> ", err)
    }
}

module.exports = { getDriveInfo, getDriveDetails, getDiskSpaceInfo }