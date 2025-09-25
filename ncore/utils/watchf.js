// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
    const path = require('path');

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
    module.exports = new DirectoryScanner();