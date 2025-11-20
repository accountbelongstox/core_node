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