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

const deepseekLauncher = require('./index.js');

console.log('='.repeat(60));
console.log('  DeepSeek Launcher - Example Usage');
console.log('='.repeat(60));
console.log('');

console.log('1. Getting DeepSeek Status...');
console.log('-'.repeat(60));
const status = deepseekLauncher.getStatus();
console.log('Installation Status:');
console.log(`  Platform: ${status.platform}`);
console.log(`  Base Directory: ${status.baseDirectory}`);
console.log(`  Install Directory: ${status.installDirectory}`);
console.log(`  Is Installed: ${status.isInstalled}`);
console.log(`  Is Valid: ${status.isValid}`);

if (status.isInstalled) {
    console.log(`  Has Git: ${status.hasGit}`);
    console.log(`  Has Requirements: ${status.hasRequirements}`);
    console.log(`  File Count: ${status.fileCount}`);
}

console.log('');

console.log('2. Getting DeepSeek Configuration...');
console.log('-'.repeat(60));
const config = deepseekLauncher.getConfig();
console.log('Configuration:');
console.log(`  Enabled: ${config.enabled}`);
console.log(`  Model Path: ${config.modelPath}`);
console.log(`  Model Directory: ${config.modelDir}`);
console.log(`  Python Command: ${config.pythonCommand}`);
console.log(`  Timeout: ${config.timeout}ms`);
console.log(`  Platform: ${config.platform}`);

console.log('');

console.log('3. Getting Installation Instructions...');
console.log('-'.repeat(60));
const instructions = deepseekLauncher.getInstallationInstructions();

console.log('Windows Installation:');
console.log(`  Script: ${instructions.windows.scriptPath.replace(/\\/g, '/')}`);
console.log(`  Command: ${instructions.windows.command}`);
console.log(`  Working Directory: ${instructions.windows.workingDirectory.replace(/\\/g, '/')}`);

console.log('');
console.log('Linux Installation:');
console.log(`  Script: ${instructions.linux.scriptPath.replace(/\\/g, '/')}`);
console.log(`  Command: ${instructions.linux.command}`);
console.log(`  Working Directory: ${instructions.linux.workingDirectory.replace(/\\/g, '/')}`);

console.log('');
console.log('Manual Installation:');
instructions.manual.steps.forEach((step, index) => {
    console.log(`  ${step}`);
});

console.log('');

console.log('4. Checking Installation and Prompting if Needed...');
console.log('-'.repeat(60));

if (!deepseekLauncher.isInstalled()) {
    console.log('DeepSeek is NOT installed - showing installation prompt:');
    console.log('');
    deepseekLauncher.showInstallationPrompt();
} else {
    console.log('DeepSeek is installed and ready!');
    console.log('');

    try {
        const checkResult = deepseekLauncher.checkAndPromptInstallation(config);
        console.log('Installation check result:', checkResult);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

console.log('');
console.log('5. Validating Configuration...');
console.log('-'.repeat(60));

const validation = deepseekLauncher.validateConfiguration(config);
console.log('Validation Result:');
console.log(`  Valid: ${validation.valid}`);

if (validation.errors.length > 0) {
    console.log('  Errors:');
    validation.errors.forEach(error => console.log(`    - ${error}`));
}

if (validation.warnings.length > 0) {
    console.log('  Warnings:');
    validation.warnings.forEach(warning => console.log(`    - ${warning}`));
}

console.log('');
console.log('='.repeat(60));
console.log('  Example Usage Complete');
console.log('='.repeat(60));
