const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration array
const CONFIG_LINES = [
    'registry=http://registry.npmmirror.com/',
    'disturl=https://registry.npmmirror.com/-/binary/node/',
    'sass_binary_site=https://registry.npmmirror.com/-/binary/node-sass',
    'sharp_libvips_binary_host=https://registry.npmmirror.com/-/binary/sharp-libvips',
    'python_mirror=https://registry.npmmirror.com/-/binary/python/',
    'electron_mirror=https://registry.npmmirror.com/-/binary/electron/',
    'electron_builder_binaries_mirror=https://registry.npmmirror.com/-/binary/electron-builder-binaries/',
    'canvas_binary_host_mirror=https://registry.npmmirror.com/-/binary/canvas',
    'node_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/sqlite3',
    'better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3'
];

// Path to .npmrc file
const NPMRC_PATH = path.join(os.homedir(), '.npmrc');

async function checkAndUpdateNpmrc() {
    try {
        // Read existing configuration or create empty string
        let currentContent = '';
        try {
            currentContent = await fs.promises.readFile(NPMRC_PATH, 'utf8');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        // Split existing content into lines
        const existingLines = currentContent.split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

        // Create a new set for configuration lines
        const newLines = new Set();

        // Keep non-configuration lines
        existingLines.forEach(line => {
            const isConfigLine = CONFIG_LINES.some(config => {
                const key = config.split('=')[0];
                return line.startsWith(key);
            });

            if (!isConfigLine) {
                newLines.add(line);
            }
        });

        // Add all configuration lines
        CONFIG_LINES.forEach(line => {
            newLines.add(line);
        });

        // Convert set to array and add newline
        const finalContent = Array.from(newLines).join('\n') + '\n';

        // Write to file
        await fs.promises.writeFile(NPMRC_PATH, finalContent, 'utf8');
        console.log('Successfully updated .npmrc configuration.');

        // Display updated content
        console.log('\nUpdated .npmrc content:');
        console.log(finalContent);

    } catch (error) {
        console.error('Error while updating .npmrc:', error);
        process.exit(1);
    }
}

// Execute check and update
checkAndUpdateNpmrc(); 