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
const env = require('./env.js');
function isStringOnlyNumbersRegtest(str) {
    if (typeof str !== 'string') {
        return false;
    }

    const regex = /^[0-9]+$/;
    return regex.test(str);
}

function getCurrentApps() {
    const appsPath = path.join(__dirname, '..', '..', '..', 'apps');
    return fs.readdirSync(appsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}
const apps = getCurrentApps();
// Get all subdirectories from apps directory
function getAppDirectories() {
    const appsPath = path.join(__dirname, '..', '..', '..', 'apps');
    try {
        if (fs.existsSync(appsPath)) {
            return fs.readdirSync(appsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        }
    } catch (error) {
        console.error('Error reading apps directory:', error);
    }
    return [];
}

function getFromParam(parameterPrefixs, parameterName, printUsage = true, checkIndex = false) {
    const args = process.argv.slice(2);
    const appNameParam = args.find(arg =>
        parameterPrefixs.some(prefix => arg.startsWith(prefix))
    );
    if (appNameParam) {
        let appName = appNameParam.split('=')[1];
        if (checkIndex) {
            if (isStringOnlyNumbersRegtest(appName)) {
                appName = parseInt(appName);
                appName = apps[appName];
            }
        }
        if (
            (!appName || !appName.trim())
            && printUsage
        ) {
            console.error(`Invalid parameter: ${parameterName}`);
            console.error('Usage:');
            parameterPrefixs.forEach(prefix => {
                console.error(` node  ${prefix}=myapp`);
            });
            console.error('  ---------------------------------------------');
            console.error('  Current Apps:');
            apps.forEach((app) => {
                console.log(`  ${app}`)
            })
            console.error('  ---------------------------------------------');
        }
        return appName;
    }
    return null;
}

function getAppNameFromParam(parameterPrefixs, parameterName, printUsage = true, checkIndex = false) {
    const appParam = getFromParam(parameterPrefixs, parameterName, printUsage, checkIndex);
    if (apps.includes(appParam)) {
        return appParam;
    }
    let checkApps = []
    for (let i = 0; i < apps.length; i++) {
        if (apps[i].startsWith(appParam)) {
            checkApps.push(apps[i]);
        }
    }
    if (checkApps.length == 1) {
        return checkApps[0];
    }
    if (checkApps.length > 1) {
        console.error(`Ambiguous app name: ${appParam}`);
        console.error('  ---------------------------------------------');
        console.error('  Current Apps:');
        checkApps.forEach((app) => {
            console.log(`  ${app}`)
        })
        console.error('  ---------------------------------------------');
    }
    return null;
}

function getAppNameFromFirstArg() {
    const args = process.argv.slice(2);
    if (args.length >= 1) {
        const potentialAppName = args[0];
        if (apps.includes(potentialAppName)) {
            return potentialAppName;
        }
    }
    return null;
}

function getIsServer() {
    let parameterPrefixs = ['server', '--server', '-server', 'server', '--server', '-server']
    const args = process.argv.slice(2); // Get command line arguments
    let namedParamResult = args.some(arg =>
        parameterPrefixs.some(prefix =>
            arg.toLowerCase().startsWith(prefix.toLowerCase())
        )
    );
    if (namedParamResult) {
        return namedParamResult;
    } else {
        const envNames = ['SERVER', 'IS_SERVER', 'ISSERVER']
        namedParamResult = getFromEnv(envNames);
        if (namedParamResult) {
            return namedParamResult;
        }
    }
    return false;
}

function getIsService() {
    const parameterName = 'service';
    let parameterPrefixs = ['service', '--service', '-service', 'service', '--service', '-service']
    const namedParamResult = getFromParam(parameterPrefixs, parameterName, false);
    if (namedParamResult) {
        return namedParamResult;
    } else {
        const envNames = ['SERVICE', 'IS_SERVICE', 'ISSERVICE']
        const namedParamResult = getFromEnv(envNames);
        return namedParamResult;
    }
}

function getFromEnv(envNames) {
    for (const envName of envNames) {
        let upperEnvName = envName.toUpperCase();
        let lowerEnvName = envName.toLowerCase();
        const argAppname = env.getEnvValue(upperEnvName) || env.getEnvValue(lowerEnvName)
        if (argAppname) {
            return argAppname;
        }
    }
    return null;
}

function getAppName() {
    const parameterName = 'appname';
    let parameterPrefixs = ['appname', '--appname', '-appname', 'app', '--app', '-app']
    const namedParamResult = getAppNameFromParam(parameterPrefixs, parameterName, true, true);
    if (namedParamResult) {
        return namedParamResult;
    }
    let argAppname = getAppNameFromFirstArg();
    if (!argAppname) {
        const envNames = ['APP', 'APPNAME', 'APP_NAME']
        argAppname = getFromEnv(envNames);
    }
    return argAppname;
}


module.exports = { getAppName, getIsServer, getIsService, apps, getCurrentApps };