const si = require('systeminformation');

const getDriveInfo = async () => {
    try {
        const drives = await si.diskLayout()
        return drives;
    } catch (err) {
        console.log("error while reading system info>>> ", err)
    }
}

module.exports = { getDriveInfo }