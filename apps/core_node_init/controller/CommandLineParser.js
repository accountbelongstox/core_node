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

'use strict';

const logger = require('#@logger');
const gconfig = require('#@gconfig');
const { fdir } = require('#@ftools');

class CommandLineParser {
    constructor() {
        this.supportedCommands = ['download', 'list', 'status', 'help', 'image', 'audio', 'url'];
    }

    parseArguments() {
        const args = process.argv.slice(2);
        const parsedArgs = {
            command: 'download', // Default to download command
            target: null,
            options: {}
        };
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            // Skip app= and apps= parameters
            if (arg.startsWith('app=') || arg.startsWith('apps=')) {
                continue;
            }

            if (arg.startsWith('--')) {
                // Handle options
                const optionName = arg.substring(2);
                const nextArg = args[i + 1];

                if (nextArg && !nextArg.startsWith('--')) {
                    parsedArgs.options[optionName] = nextArg;
                    i++; // Skip next argument as it's the value
                } else {
                    parsedArgs.options[optionName] = true;
                }
            } else if (!parsedArgs.command || parsedArgs.command === 'download') {
                // First non-option argument is the command
                if (this.supportedCommands.includes(arg)) {
                    parsedArgs.command = arg;
                } else {
                    parsedArgs.target = arg;
                    parsedArgs.command = 'download'; // Default to download if target is specified
                }
            } else if (!parsedArgs.target) {
                // Second non-option argument is the target
                parsedArgs.target = arg;
            }
        }
        
        return parsedArgs;
    }

    displayHelp() {
        console.log(`
Core Node Init - Download Manager (v2)

Usage:
  node main.js app=core_node_init [command] [target] [options]

Commands:
  download <target>    Download specified application
  image <selector>     Download image from CSS selector
  audio <selector>     Download audio from CSS selector
  url <url>            Download file from direct URL
  list                 List available download targets
  status              Show download status
  help                Show this help message

Targets:
  cursor              Download Cursor IDE
  vscode              Download Visual Studio Code

Options:
  --force             Force download even if file exists
  --headless          Run browser in headless mode
  --timeout <ms>      Set timeout in milliseconds
  --wait              Wait for manual download completion
  --no-wait           Don't wait for download completion

Examples:
  node main.js app=core_node_init download cursor
  node main.js app=core_node_init download vscode --force
  node main.js app=core_node_init image "img.download-image"
  node main.js app=core_node_init audio "audio.download-audio"
  node main.js app=core_node_init url "https://example.com/file.zip"
  node main.js app=core_node_init list
  node main.js app=core_node_init status
`);
    }
}

module.exports = CommandLineParser;
