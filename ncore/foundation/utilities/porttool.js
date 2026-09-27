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

const net = require('net');
const commander = require('../common/commander.js');

class Porttool {
    constructor() {
        this.currentDir = process.cwd();
    }

    isWindows() {
        return process.platform === 'win32';
    }

    isLinux() {
        return process.platform === 'linux';
    }

    async execCommand(command, info = true, cwd = null, logname = null) {
        return commander.execCommand(command, info, cwd, logname);
    }

    async spawnSync(command, info = true, cwd = null, logname = null) {
        return commander.spawnAsync(command, info, cwd);
    }

    async isPortInUse(port) {
        return new Promise(async (resolve, reject) => {
            const netstatCommand = `netstat -ano | findstr :${port}`;
            const result = await this.execCommand(netstatCommand)
            let stdout = result && result.stdout ? result.stdout : ``
            if (!stdout) {
                stdout = result && result.error ? result.error : ``
            }
            const lines = stdout.trim().split('\n').map(line => line.trim().replace(/\r/g, ''));
            let portLines = lines;
            let isPortUsed = false;
            for (let i = 0; i < portLines.length; i++) {
                const parts = portLines[i].split(/\s+/);
                let isIncludePort = false;
                let firstValue = parts[0];
                if (firstValue == "TCP") firstValue = parts[1];
                if (firstValue.endsWith(`:${port}`)) {
                    isIncludePort = true
                }
                const lastValue = parts[parts.length - 1];
                const usePid = parseInt(lastValue, 10)
                if (!isNaN(usePid) && usePid > 0) {
                    if (isIncludePort) {
                        if(!Array.isArray(isPortUsed)) {
                            isPortUsed = []
                        }
                        isPortUsed.push(usePid)
                    }
                }
            }
            resolve(isPortUsed);
        }).catch(error => {
            console.error("An error occurred while checking port:", error);
            return true;
        });
    }

    async killProcessByPort(port) {
        return new Promise(async (resolve, reject) => {
            let pids = await this.isPortInUse(port)
            if (pids) {
                const processesToKill = [];
                pids.forEach(pid => {
                    processesToKill.push({ pid, port });
                });
                const forceOption = processesToKill.length > 1 ? '/F' : '';
                const taskkillCommand = `taskkill ${forceOption} /PID ${pids}`;
                const stdout = await this.execCommand(taskkillCommand)
                resolve(stdout);
            }
        });
    }
    async checkPort(port) {
        return new Promise((resolve, reject) => {
            port = parseInt(port);
            const tester = net.createServer();
            tester.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    reject(err);
                }
            });

            tester.once('listening', () => {
                tester.close(() => {
                    resolve(false);
                });
            });

            tester.listen(port, 'localhost');
        });
    }
    isPortTaken(port) {
        return new Promise((resolve, reject) => {
            const tester = net.createServer()
                .once('error', err => {
                    if (err.code !== 'EADDRINUSE') {
                        reject(err);
                        return;
                    }
                    resolve(true);
                })
                .once('listening', () => {
                    tester.once('close', () => {
                        resolve(false);
                    }).close();
                })
                .listen(port);
        });
    }
    wrapEmdResult(success = true, stdout = '', error = null, code = 0, info = true) {
        return commander.wrapEmdResult(success, stdout, error, code, info);
    }
    byteToStr(astr) {
        try {
            astr = astr.toString('utf-8');
            return astr;
        } catch (e) {
            astr = String(astr);
            const isByte = /^b\'{0,1}/;
            if (isByte.test(astr)) {
                astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
            }
            return astr;
        }
    }
}

Porttool.toString = () => '[class Porttool]';
module.exports = new Porttool();
