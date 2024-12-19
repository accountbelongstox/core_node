import fs from 'fs';
import path from 'path';

class DirectoryScanner {
    constructor() {
        this.errordirs = [];
        this.oldFolders = [];
    }

    writeLog(filename, message) {
        const date = new Date();
        const logMessage = `${message} - ${date.toISOString()}\n`;
        console.log(logMessage);
        fs.appendFileSync(filename, logMessage, 'utf8');
    }

    writeAddDir(message) {
        this.writeLog('D:/programing/desktop_icondevelop/temp/log/adddir.log', message);
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
        const firstScan = this.oldFolders.length === 0;
        const addedFolders = newFolders.filter(folder => !this.oldFolders.includes(folder));
        if (addedFolders.length) {
            console.log('New directories detected:');
            addedFolders.forEach(dir => {
                if (!firstScan) {
                    this.writeAddDir(dir);
                }
                this.oldFolders.push(dir);
            });
        } else {
            console.log('No new directories detected.');
        }
    }
}

DirectoryScanner.toString = () => '[class DirectoryScanner]';
export default new DirectoryScanner();
