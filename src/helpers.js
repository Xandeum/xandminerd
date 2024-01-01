const si = require('systeminformation');
const os = require('os');
const axios = require('axios');
const { exec } = require('child_process');

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
    const platform = os.platform(); //win32, darwin

    try {
        const diskLayout = await si.diskLayout()
        console.log("diskLayout>>> ", diskLayout)
        const blockDevices = await si.blockDevices()
        console.log("blockDevices>>> ", blockDevices)
        const fsSize = await si.fsSize()
        console.log("fsSize>>> ", fsSize)

        const drives = [{ ...diskLayout[0], available: fsSize[fsSize.length - 1]?.available }]
        console.log("drives>>> ", drives)
        return drives;
    } catch (err) {
        console.log("error while reading system info>>> ", err)
    }
};

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

    return new Promise((resolve, reject) => {
        const command = 'fast --download --json'; // Adjust the command as needed

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error executing command: ${error.message}`);
                return;
            }

            if (stderr) {
                reject(`Command stderr: ${stderr}`);
                return;
            }

            // Resolve the Promise with the output (stdout)
            resolve(stdout);
        });
    });
}

module.exports = { getDriveInfo, getDiskSpaceInfo, testNetworkSpeed }