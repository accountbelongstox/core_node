require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('./express/app');

function updateEnvFile(key, value) {
    let envContent = fs.readFileSync('.env', 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
        envContent += `\n${key}=${value}`;
    }
    fs.writeFileSync('.env', envContent);
}

async function main() {
    const args = process.argv.slice(2);
    let appName = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--app' && i + 1 < args.length) {
            appName = args[i + 1];
            break;
        }
    }

    if (appName) {
        updateEnvFile('APP_NAME', appName);
        process.env.APP_NAME = appName;
    } else {
        appName = process.env.APP_NAME;
    }

    if (!appName) {
        console.error('Error: APP_NAME is not specified. Please set it in .env file or provide it as a command line argument (--app <appName>).');
        process.exit(1);
    }

    const appDir = path.join(__dirname, 'apps', appName);
    if (!fs.existsSync(appDir)) {
        console.error(`Error: App directory '${appDir}' does not exist.`);
        process.exit(1);
    }

    const appMainFile = path.join(appDir, 'main.js');
    if (!fs.existsSync(appMainFile)) {
        console.error(`Error: App main file '${appMainFile}' does not exist.`);
        process.exit(1);
    }
    const AppModule = require(appMainFile);
    const app = new AppModule();
    
    const expressApp = await express.createApp();
    
    if (typeof app.start === 'function') {
        await app.start(expressApp);
    }
    // await app.setup(expressApp);
    await express.start(expressApp);
}

main().catch(error => {
    console.error('Failed to start the application:', error);
    process.exit(1);
});