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

const path = require('path');
const { execCmd } = require('#@commander');
const logger = require('#@logger');

class LinuxShortcut {
    constructor() {
        this.desktopEntryDir = '/usr/share/applications';
    }

    /**
     * Create a desktop entry for an application
     * @param {Object} options Desktop entry options
     * @param {string} options.name Application name
     * @param {string} options.exec Executable path
     * @param {string} options.icon Icon path
     * @param {string} options.comment Application description
     * @param {string} options.categories Application categories (semicolon-separated)
     * @param {string} options.fileName Custom .desktop file name (optional)
     * @param {boolean} options.terminal Run in terminal (optional)
     * @param {string} options.type Entry type (optional, defaults to 'Application')
     * @returns {Promise<boolean>} Success status
     */
    async createDesktopEntry(options) {
        try {
            const {
                name,
                exec,
                icon,
                comment,
                categories = 'Development',
                fileName = name.toLowerCase().replace(/\s+/g, '-'),
                terminal = false,
                type = 'Application'
            } = options;

            if (!name || !exec) {
                logger.error('Name and exec path are required for desktop entry');
                return false;
            }

            const desktopEntry = [
                '[Desktop Entry]',
                `Name=${name}`,
                `Exec=${exec}`,
                icon ? `Icon=${icon}` : null,
                `Type=${type}`,
                `Terminal=${terminal}`,
                comment ? `Comment=${comment}` : null,
                categories ? `Categories=${categories};` : null
            ]
                .filter(Boolean)
                .join('\n');

            const entryPath = path.join(this.desktopEntryDir, `${fileName}.desktop`);

            // Create the desktop entry file
            await execCmd(`sudo bash -c 'echo "${desktopEntry}" > ${entryPath}'`);
            await execCmd(`sudo chmod +x ${entryPath}`);

            // Update desktop database
            await execCmd('sudo update-desktop-database');

            logger.success(`Desktop entry created: ${entryPath}`);
            return true;
        } catch (error) {
            logger.error('Error creating desktop entry:', error);
            return false;
        }
    }

    /**
     * Remove a desktop entry
     * @param {string} name Application name or .desktop file name
     * @returns {Promise<boolean>} Success status
     */
    async removeDesktopEntry(name) {
        try {
            const fileName = name.toLowerCase().replace(/\s+/g, '-');
            const entryPath = path.join(this.desktopEntryDir, `${fileName}.desktop`);

            await execCmd(`sudo rm -f "${entryPath}"`);
            await execCmd('sudo update-desktop-database');

            logger.success(`Desktop entry removed: ${entryPath}`);
            return true;
        } catch (error) {
            logger.error('Error removing desktop entry:', error);
            return false;
        }
    }

    /**
     * Check if a desktop entry exists
     * @param {string} name Application name or .desktop file name
     * @returns {Promise<boolean>} Whether the entry exists
     */
    async hasDesktopEntry(name) {
        try {
            const fileName = name.toLowerCase().replace(/\s+/g, '-');
            const entryPath = path.join(this.desktopEntryDir, `${fileName}.desktop`);
            
            const result = await execCmd(`test -f "${entryPath}"`, { 
                throwOnError: false 
            });
            return result.code === 0;
        } catch {
            return false;
        }
    }

    /**
     * Update an existing desktop entry
     * @param {string} name Existing application name or .desktop file name
     * @param {Object} options New desktop entry options
     * @returns {Promise<boolean>} Success status
     */
    async updateDesktopEntry(name, options) {
        try {
            if (await this.hasDesktopEntry(name)) {
                await this.removeDesktopEntry(name);
            }
            return await this.createDesktopEntry({
                ...options,
                fileName: name.toLowerCase().replace(/\s+/g, '-')
            });
        } catch (error) {
            logger.error('Error updating desktop entry:', error);
            return false;
        }
    }
}

module.exports = new LinuxShortcut();
