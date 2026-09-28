const fs = require('fs');
const path = require('path');

class DirectoryScanner {
    errordirs = []
    oldFolders = [];

    constructor() {
    }

    writeLog(filename, message) {
        const date = new Date();
        const logMessage = `${message} - ${date.toISOString()}\n`;
        console.log(logMessage)
        fs.appendFileSync(filename, logMessage, 'utf8');
    }

    writeAddDir(message) {
        this.writeLog('D:/programing/desktop_icondevelop/temp/log/adddir.log.log', message)
    }

    scanDirectory(dir) {
        let folders = [dir];
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    folders = folders.concat(this.scanDirectory(fullPath));
                }
            }
        } catch (error) {
            this.errordirs.push(dir);
            console.error(`Error scanning ${dir}: ${error.message}`);
        }
        return folders;
    }

    scanAndCompare(targetDir) {
        const newFolders = this.scanDirectory(targetDir);
        let firstScan = this.oldFolders.length == 0
        const addedFolders = newFolders.filter(folder => !this.oldFolders.includes(folder));
        if (addedFolders.length) {
            console.log('New directories detected:');
            addedFolders.forEach(dir => {
                if(!firstScan){
                    this.writeAddDir(dir)
                }
                this.oldFolders.push(dir)
            });
        } else {
            console.log('No new directories detected.');
        }
    }
}
const scanner = new DirectoryScanner();
setInterval(() => {
    scanner.scanAndCompare(path.resolve('C:/Users'));
    scanner.scanAndCompare(path.resolve('C:/Program Files'));
    scanner.scanAndCompare(path.resolve('C:/Program Files (x86)'));
    scanner.scanAndCompare(path.resolve('C:/ProgramData'));
}, 2000);


DirectoryScanner.toString = () => '[class DirectoryScanner]';
module.exports = new DirectoryScanner();

