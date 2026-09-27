'use strict';

    const { exec, execSync, spawn } = require('child_process');

    class Tool {
        constructor() {
            this.jscodes = [];
            this.parsedArgs = null;
        }

        commandToString(obj, indent = 2) {
            if (typeof obj === 'string' || typeof obj === 'number') {
                obj = obj.toString().replace(/\\/g, '/').replace(/`/g, '"').replace(/\x00/g, '');
                return obj;
            } else {
                if (obj === null) return 'null';
                if (obj === false) return 'false';
                if (obj === true) return 'true';
                if (Array.isArray(obj)) {
                    const formattedArray = obj.map(item => this.commandToString(item, indent));
                    return `[${formattedArray.join(', ')}]`;
                } else {
                    try {
                        return JSON.stringify(obj);
                    } catch (error) {
                        return obj.toString();
                    }
                }
            }
        }

        executeSync(cmd) {
            return execSync(cmd).toString();
        }

        executeBySpawn(command, message, callback) {
            if (!callback && message) {
                callback = message;
                message = null;
            }
            const parts = command.split(/\s+/g);
            const cmd = parts[0];
            const args = parts.slice(1);

            const child = spawn(cmd, args, { shell: true });

            let stdoutData = '';
            let stderrData = '';
            let done = false;

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
                if (message) {
                    message(stdoutData);
                } else {
                    callback(done, null, stdoutData);
                }
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
                if (message) {
                    message(stderrData);
                } else {
                    callback(done, null, stderrData);
                }
            });

            child.on('close', (code) => {
                done = true;
                if (code !== 0) {
                    callback(done, false, stderrData || `Command exited with code ${code}`);
                } else {
                    callback(done, true, stdoutData);
                }
            });
        }

        executeCommand(cmd, callback, log) {
            console.log(`Executing command: ${cmd}`);
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    if (log) {
                        log(`Error: ${cmd}`);
                        log(error.message);
                    } else {
                        console.error(`Error executing command: ${error.message}`);
                    }
                }
                if (stderr) {
                    if (log) {
                        log(`stderr: ${cmd}`);
                        log(stderr);
                    } else {
                        console.error(`STDERR: ${stderr}`);
                    }
                }
                if (stdout) {
                    if (log) {
                        log(stdout);
                    } else {
                        console.log(`STDOUT: ${stdout}`);
                    }
                }
                if (callback) {
                    callback(this.commandToString(stdout), error, stderr);
                }
            });
        }

        executeCommands(cmds, callback, log) {
            if (typeof cmds === 'string') {
                cmds = [cmds];
            }
            if (cmds.length > 0) {
                let cmd = cmds.shift();
                this.executeCommand(cmd, () => {
                    log(`Executed: ${cmd}`);
                    this.executeCommands(cmds, callback, log);
                }, log);
            } else {
                if (callback) callback();
            }
        }

        getParameters(para_key) {
            const args = process.argv.slice(2);
            if (this.parsedArgs) {
                return para_key ? this.parsedArgs[para_key] : this.parsedArgs;
            }
            this.parsedArgs = {};
            let currentKey = null;

            args.forEach(arg => {
                if (arg.startsWith('-')) {
                    const keyValue = arg.replace(/^-+/, '');
                    const [key, value] = keyValue.includes(':') ? keyValue.split(':') : keyValue.split('=');
                    currentKey = key;
                    this.parsedArgs[currentKey] = value || true;
                } else if (currentKey !== null) {
                    this.parsedArgs[currentKey] = arg.replace(/"/g, '');
                    currentKey = null;
                }
            });

            return para_key ? this.parsedArgs[para_key] : this.parsedArgs;
        }

        isParameter(key) {
            if (!this.parsedArgs) {
                this.getParameters();
            }
            return key in this.parsedArgs;
        }

        getParameter(para_key) {
            return this.getParameters(para_key);
        }

        mergeJSON(jsonA, jsonB) {
            for (const key in jsonB) {
                if (typeof jsonB[key] === 'object' && jsonB[key] !== null && !Array.isArray(jsonB[key])) {
                    if (jsonA.hasOwnProperty(key) && typeof jsonA[key] === 'object' && !Array.isArray(jsonA[key])) {
                        this.mergeJSON(jsonA[key], jsonB[key]);
                    } else {
                        jsonA[key] = jsonB[key];
                    }
                } else {
                    if (!jsonA.hasOwnProperty(key)) {
                        jsonA[key] = jsonB[key];
                    }
                }
            }
            return jsonA;
        }

        getRandomItem(array) {
            return array[Math.floor(Math.random() * array.length)];
        }

        deepParse(item) {
            if (typeof item === 'object' && item !== null) {
                if (Array.isArray(item)) {
                    item.forEach((i, index) => {
                        item[index] = this.deepParse(i);
                    });
                } else {
                    for (const key in item) {
                        try {
                            item[key] = JSON.parse(item[key]);
                        } catch (e) {
                            if (typeof item === 'object' && item !== null) {
                                item[key] = item.toString();
                            }
                        }
                    }
                }
            }
            return item;
        }

        getParamNames(func) {
            const fnStr = func.toString().replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '');
            let result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
            return result === null ? [] : result.map(item => item.toLowerCase());
        }

        arrangeAccordingToA(paramNames, callback, args) {
            const index = paramNames.indexOf('callback');
            if (index !== -1) {
                paramNames[index] = callback;
                const args_a = args.slice(0, index);
                const args_b = args.slice(index);
                paramNames.forEach((param, i) => {
                    if (i < index) {
                        paramNames[i] = args_a[i] !== undefined ? args_a[i] : null;
                    } else if (i > index) {
                        paramNames[i] = args_b[i - index - 1] !== undefined ? args_b[i - index - 1] : null;
                    }
                });
            } else {
                const maxLength = Math.max(paramNames.length, args.length);
                paramNames.forEach((param, i) => {
                    if (i < maxLength) {
                        paramNames[i] = args[i] !== undefined ? args[i] : null;
                    } else {
                        paramNames.push(args[i]);
                    }
                });
            }
            return paramNames;
        }

        isPromise(func) {
            return func instanceof Promise;
        }

        isAsyncFunction(func) {
            return func.constructor && func.constructor.name === 'AsyncFunction';
        }

        isCall(func) {
            const para = this.getParamNames(func);
            return this.isCallByParam(para);
        }

        isCallByParam(paramNames) {
            return paramNames.findIndex((param) => param.toLowerCase() === 'callback') !== -1;
        }

        printFunctions(obj, depth = 0) {
            console.log('printFunctions');
            console.dir(obj);
            if (depth > 10) return;
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (typeof obj[key] === 'function') {
                        console.log(`${'  '.repeat(depth)}${key}`);
                    }
                    if (typeof obj[key] === 'object') {
                        this.printFunctions(obj[key], depth + 1);
                    }
                }
            }
        }
    }

    Tool.toString = () => '[class Tool]';
    module.exports = new Tool();