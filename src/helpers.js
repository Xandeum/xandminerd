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
    } else if (platform === 'darwin') {
        // macOS-specific command
        exec('diskutil list -plist', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running macOS command: ${error.message}`);
                return;
            }

            try {
                const diskInfo = parseDiskutilOutput(stdout);
                printDiskInfo(diskInfo, 'macOS');
            } catch (parseError) {
                console.error(`Error parsing macOS command output: ${parseError.message}`);
            }
        });
    } else {
        // Linux/Unix-specific command
        exec('df -P', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running Linux/Unix command: ${error.message}`);
                return;
            }

            try {
                const diskInfo = parseDfOutput(stdout);
                printDiskInfo(diskInfo, 'Unix/Linux');
            } catch (parseError) {
                console.error(`Error parsing Linux/Unix command output: ${parseError.message}`);
            }
        });
    }
};

const parseDiskutilOutput = (output) => {
    const parsedOutput = {};
    const disks = output.match(/<string>(.*?)<\/string>/g);

    disks.forEach((disk) => {
        const match = disk.match(/<string>(.*?)<\/string>/);
        if (match) {
            const diskName = match[1];
            parsedOutput[diskName] = { mountPoint: `/Volumes/${diskName}` };
        }
    });

    return parsedOutput;
};

const parseDfOutput = (output) => {
    const parsedOutput = {};
    const lines = output.split('\n').filter(Boolean);
    lines.shift(); // Remove the header line

    lines.forEach(line => {
        const [filesystem, size, used, available, capacity, mountedOn] = line.split(/\s+/);
        parsedOutput[filesystem] = { mountPoint: mountedOn };
    });

    return parsedOutput;
};

const printDiskInfo = (diskInfo, platform) => {
    Object.keys(diskInfo).forEach(diskName => {
        const { mountPoint } = diskInfo[diskName];
        exec(`df -P ${mountPoint}`, (dfError, dfOutput) => {
            if (dfError) {
                console.error(`Error running df command: ${dfError.message}`);
                return;
            }

            const dfLines = dfOutput.split('\n').filter(Boolean);
            const [filesystem, size, used, available, capacity, mountedOn] = dfLines[1].split(/\s+/);
            console.log('Filesystem:', filesystem);
            console.log('Size:', size, 'bytes');
            console.log('Used Space:', used, 'bytes');
            console.log('Type:', platform);
            console.log('------------------------');
        });
    });
};


module.exports = { getDriveInfo, getDiskSpaceInfo }