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

// Your converted code here...

    const Base = require('#@base');
    const net = require('net');
    const cmd = require('../unit/cmd.js');

    class Porttool extends Base {
        constructor() {
            super();
            this.currentDir = this.getCwd();
        }

        isWindows() {
            return process.platform === 'win32';
        }

        isLinux() {
            return process.platform === 'linux';
        }

        async isPortInUse(port) {
            return new Promise(async (resolve) => {
                const netstatCommand = `netstat -ano | findstr :${port}`;
                const result = await cmd.execCommand(netstatCommand);
                let stdout = result && result.stdout ? result.stdout : '';
                if (!stdout) {
                    stdout = result && result.error ? result.error : '';
                }
                const lines = stdout.trim().split('\n').map(line => line.trim().replace(/\r/g, ''));
                let isPortUsed = false;
                for (let i = 0; i < lines.length; i++) {
                    const parts = lines[i].split(/\s+/);
                    let isIncludePort = false;
                    let firstValue = parts[0];
                    if (firstValue === "TCP") firstValue = parts[1];
                    if (firstValue.endsWith(`:${port}`)) {
                        isIncludePort = true;
                    }
                    const lastValue = parts[parts.length - 1];
                    const usePid = parseInt(lastValue, 10);
                    if (!isNaN(usePid) && usePid > 0 && isIncludePort) {
                        if (!Array.isArray(isPortUsed)) {
                            isPortUsed = [];
                        }
                        isPortUsed.push(usePid);
                    }
                }
                resolve(isPortUsed);
            }).catch(error => {
                console.error("An error occurred while checking port:", error);
                return true;
            });
        }

        async killProcessByPort(port) {
            return new Promise(async (resolve) => {
                const pids = await this.isPortInUse(port);
                if (pids) {
                    const forceOption = pids.length > 1 ? '/F' : '';
                    const taskkillCommand = `taskkill ${forceOption} /PID ${pids.join(' /PID ')}`;
                    const stdout = await cmd.execCommand(taskkillCommand);
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
            if (info) {
                this.info(this.byteToStr(stdout));
                this.warn(this.byteToStr(error));
            }
            return { success, stdout, error, code };
        }

        byteToStr(astr) {
            try {
                return astr.toString('utf-8');
            } catch (e) {
                astr = String(astr);
                if (/^b\'{0,1}/.test(astr)) {
                    astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
                }
                return astr;
            }
        }
    }

    Porttool.toString = () => '[class Porttool]';

    module.exports = new Porttool();