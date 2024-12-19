import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Priority 1: Check for appname=xxx or app=xxx parameter
function getAppNameFromNamedParam() {
    const args = process.argv.slice(2);
    // Find parameter that starts with either 'appname=' or 'app='
    const appNameParam = args.find(arg => 
        arg.startsWith('appname=') || arg.startsWith('app=')
    );

    if (appNameParam) {
        const appName = appNameParam.split('=')[1];
        // Check if the value after '=' is empty
        if (!appName || !appName.trim()) {
            console.error('Error: App name parameter is empty');
            console.error(`Invalid parameter: ${appNameParam}`);
            console.error('Usage:');
            console.error('  node get_appname.js appname=myapp');
            console.error('  node get_appname.js app=myapp');
            process.exit(1);
        }

        const directories = getAppDirectories();
        if (directories.includes(appName)) {
            return appName;
        }
        console.error(`App name parameter: ${appName}`);
        console.error('Error: App name parameter is not a valid app directory');
        process.exit(1);
    }
    return null;
}

// Priority 2: Check first argument (original method)
function getAppNameFromFirstArg() {
    const args = process.argv.slice(2);
    if (args.length >= 1) {
        const potentialAppName = args[0];
        const directories = getAppDirectories();
        if (directories.includes(potentialAppName)) {
            return potentialAppName;
        }
    }
    return null;
}

// Main function to get app name with priority handling
function getAppName() {
    // Priority 1: Check for appname=xxx or app=xxx parameter
    const namedParamResult = getAppNameFromNamedParam();
    if (namedParamResult) {
        return namedParamResult;
    }
    // Priority 2: Check first argument
    let argAppname = getAppNameFromFirstArg();
    if(!argAppname){
        argAppname = env.getEnvValue('app') || env.getEnvValue('appname') || env.getEnvValue('APP_NAME')    
    }
    return argAppname;
}

// Main test function
function main() {
    const appName = getAppName();
    
    if (appName) {
        console.log('Found app name:', appName);
    } else {
        console.log('No valid app name found in arguments');
        console.log('Usage:');
        console.log('  node get_appname.js [app_name]');
        console.log('  node get_appname.js appname=myapp');
        console.log('  node get_appname.js app=myapp');
    }
    
    console.log('\nAvailable app directories:');
    console.log(getAppDirectories());
}

// Format paths for comparison
const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const processFilePath = path.resolve(process.argv[1]);

// Run the main function if this file is run directly
if (currentFilePath === processFilePath) {
    main();
}

export { getAppName, getAppDirectories };
