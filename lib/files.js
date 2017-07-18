var fs = require('fs');
var path = require('path');

module.exports = {
    getCurrentDirectoryBase() {
        return path.basename(process.cwd());
    },
    directoryExists(filePath) {
        try {
            return fs.statSync(filePath).isDirectory();
        } catch (err) {
            return false;
        }
    },
    resolveHome() {
        const {env} = process;
        return env.HOME || env.USERPROFILE || ((env.HOMEDRIVE || 'C:') + env.HOMEPATH)
    }

};