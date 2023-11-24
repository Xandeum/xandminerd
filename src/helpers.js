const si = require('systeminformation');
const os = require('os');

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
        // const drives = await si.blockDevices()
        // console.log("blockDevices>>> ", drives)
        const fsSize = await si.fsSize()
        console.log("fsSize>>> ", fsSize)

        const drives = [{ ...diskLayout[0], available: fsSize[fsSize.length - 1]?.available }]
        console.log("drives>>> ", drives)
        return diskLayout;
    } catch (err) {
        console.log("error while reading system info>>> ", err)
    }
};


module.exports = { getDriveInfo, getDiskSpaceInfo }