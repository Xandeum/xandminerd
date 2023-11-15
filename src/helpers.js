const si = require('systeminformation');

// const getDriveInfo = async () => {

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

const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const diskusage = require('diskusage');
const path = require('path');

const getDiskSpaceInfo = () => {
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

module.exports = { getDriveInfo, getDiskSpaceInfo }