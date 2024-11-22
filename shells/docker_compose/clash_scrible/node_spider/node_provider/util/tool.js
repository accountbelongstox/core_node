
'use strict';
const {
    exec,
    execSync,
    spawn
    // execFile
} = require('node:child_process');

class Tool {

    jscodes = []

    commandToString(obj, indent = 2) {
        if (typeof obj == 'string' || typeof obj == 'number') {
            obj = "" + obj
            obj = obj.replace(/\\/g, '/');
            obj = obj.replace(/`/g, '"');
            obj = obj.replace(/\x00/g, '')
            return obj;
        } else {
            if (obj === null) {
                return `null`;
            }
            else if (obj === false) {
                return `false`;
            }
            else if (obj === true) {
                return `true`;
            } else if (Array.isArray(obj)) {
                const formattedArray = obj.map(item => this.toString(item, indent));
                return `[${formattedArray.join(', ')}]`;
            } else {
                try {
                    let str = JSON.stringify(obj);
                    return str;
                } catch (error) {
                    let str = obj.toString()
                    return str;
                }
            }
        }
    }

    execSync(cmd) {
        const opt = execSync(cmd)
        return opt
    }

    exeBySpawn(command, message, callback) {
        if (!callback && message) {
            callback = message
            message = null
        }
        const parts = command.split(/\s+/g);
        const cmd = parts[0];
        const args = parts.slice(1);

        const child = spawn(cmd, args, {
            shell: true
        });

        let stdoutData = '';
        let stderrData = '';
        let done = false

        child.stdout.on('data', (data) => {
            stdoutData += data.toString();
            if (message) {
                if (message) message(stdoutData)
            } else {
                callback(done, null, stdoutData);
            }
        });

        child.stderr.on('data', (data) => {
            stderrData += data.toString();
            if (message) {
                if (message) message(stderrData)
            } else {
                callback(done, null, stderrData);
            }
        });

        child.on('close', (code) => {
            done = true
            if (code !== 0) {
                callback(done, false, stderrData || `Command exited with code ${code}`);
            } else {
                callback(done, true, stdoutData);
            }
        });
    }


    exec_cmd(cmd, callback, log) {
        console.log(`exec_cmd : ${cmd}`)
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                if (log) {
                    log(`error : ${cmd}`)
                    log(error.message)
                } else {
                    console.error(`Error executing command: ${error.message}`);
                }
            }
            if (stderr) {
                if (log) {
                    log(`stderr : ${cmd}`)
                    log(stderr)
                } else {
                    console.error(`STDERR: ${stderr}`);
                }
            }
            if (stdout) {
                if (log) {
                    log(stdout)
                } else {
                    console.error(`STDOUT: ${stdout}`);
                }
            }
            if (callback) {
                stdout = this.commandToString(stdout)
                callback(stdout, error, stderr);
            }
        });
    }

    exec_cmds(cmds, callback, log) {
        if (typeof cmds == 'string') {
            cmds = [cmds]
        }
        if (cmds.length > 0) {
            let cmd = cmds.shift();
            this.exec_cmd(cmd, () => {
                log("exec" + cmd)
                this.exec_cmds(cmds, callback, log)
            }, log);
        } else {
            if (callback) callback()
        }
    }

    getParameters(para_key) {
        const args = process.argv.slice(1);
        if (this.parsedArgs) {
            if (para_key) {
                return this.parsedArgs[para_key]
            }
            return this.parsedArgs
        }
        this.parsedArgs = {};
        let currentKey = null;

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('-')) {
                const keyValue = arg.replace(/^-+/, '');
                const [key, value] = keyValue.includes(':')
                    ? keyValue.split(':')
                    : keyValue.split('=');

                currentKey = key;
                this.parsedArgs[currentKey] = value || true;
            } else if (currentKey !== null) {
                this.parsedArgs[currentKey] = arg.replace(/"/g, ''); // Remove surrounding quotes
                currentKey = null;
            }
        }
        if (para_key) {
            return this.parsedArgs[para_key]
        }
        return this.parsedArgs;
    }

    isParameter(key) {
        if (!this.parsedArgs) {
            this.getParameters()
        }
        return key in this.parsedArgs;
    }

    getParameter(para_key) {
        return this.getParameters(para_key)
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
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    }

    deepParse(item) {
        if (typeof item === 'object' && item !== null) {
            if (Array.isArray(item)) {
                item.forEach((i, index) => {
                    item[index] = this.deepParse(i)
                })
            } else {
                for (const key in item) {
                    try {
                        item[key] = JSON.parse(item[key]);
                    } catch (e) {
                        if (typeof item === 'object' && item !== null) {
                            item[key] = item.toString()
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
        result = result === null ? [] : result;
        result = result.map(item => item.toLowerCase());
        return result;
    }


    arrangeAccordingToA(paramNames, callback, args) {
        const l = paramNames.length;
        const index = paramNames.indexOf('callback');
        if (index !== -1) {
            paramNames[index] = callback;
            const args_a = args.slice(0, index);
            const args_b = args.slice(index);
            for (let i = 0; i < l; i++) {
                if (i < index) {
                    paramNames[i] = args_a[i] !== undefined ? args_a[i] : null;
                } else if (i > index) {
                    paramNames[i] = args_b[i - index - 1] !== undefined ? args_b[i - index - 1] : null;
                }
            }
        } else {
            const maxLength = Math.max(l, args.length);
            for (let i = 0; i < maxLength; i++) {
                if (i < l) {
                    paramNames[i] = args[i] !== undefined ? args[i] : null;
                } else {
                    paramNames.push(args[i]);
                }
            }
        }
        return paramNames;
    }


    isPromise(func) {
        return func instanceof Promise
    }

    isAsyncFunction(func) {
        return func.constructor && func.constructor.name == 'AsyncFunction';
    }

    isCall(func) {
        let para = this.getParamNames(func)
        return this.isCallByParam(para)
    }

    isCallByParam(paramNames) {
        const callbackIndex = paramNames.findIndex((param) => param.toLowerCase() === 'callback');
        if (callbackIndex === -1) {
            return false;
        }
        return true
    }

    printFunctions(obj, depth = 0) {
        console.log(`printFunctions`);
        console.dir(obj);
        if (depth > 10) {
            return;
        }
        for (let key in obj) {
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
