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

/**
 * Create a symbolic link from source to target
 * @param {string} src - Source path
 * @param {string} target - Target path
 * @param {boolean} force - Whether to force creation by removing existing target
 */
function symlink(src, target, force = false) {
    if (force) {
        if (fs.existsSync(target)) {
            const stats = fs.lstatSync(target);
            if (stats.isDirectory()) {
                deleteFolder(target);
            } else if (stats.isSymbolicLink()) {
                fs.unlinkSync(target);
            } else {
                console.warn(`${target} exists and is not a symbolic link. Aborting.`);
                return;
            }
        }
    }

    if (!fs.existsSync(src)) {
        mkdir(src);
    }
    if (!fs.existsSync(target)) {
        fs.symlinkSync(src, target, 'junction');
        console.log(`Successfully created symlink from ${src} to ${target}`);
    }
}

/**
 * Synchronous wrapper for the symlink function
 * @param {string} src - Source path
 * @param {string} target - Target path
 * @param {boolean} force - Whether to force creation by removing existing target
 */
function symlinkSync(src, target, force = false) {
    symlink(src, target, force);
}

/**
 * Check if a path is a symbolic link
 * @param {string} folderPath - Path to check
 * @returns {boolean} True if path is a symbolic link
 */
function isSymbolicLink(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return false;
    }
    try {
        const stats = fs.lstatSync(folderPath);
        return stats.isSymbolicLink();
    } catch (error) {
        console.error(`isSymbolicLink-Error: ${error}`);
        return false;
    }
}

/**
 * Create a directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 */
function mkdir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Delete a folder recursively
 * @param {string} folderPath - Path of folder to delete
 */
function deleteFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const currentPath = path.join(folderPath, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
                deleteFolder(currentPath);
            } else {
                fs.unlinkSync(currentPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
}

/**
 * Link a folder to a target, with validation and force option
 * @param {string} src - Source path
 * @param {string} target - Target path
 * @param {boolean} force - Whether to force creation by removing existing target
 */
function linkToTarget(src, target, force = false) {
    if (fs.existsSync(target)) {
        if (isSymbolicLink(target)) {
            fs.unlinkSync(target);
        } else {
            console.warn(`${target} exists and is not a symbolic link. Aborting.`);
            return;
        }
    }
    symlinkSync(src, target, force);
}

module.exports = {
    symlink,
    symlinkSync,
    isSymbolicLink,
    mkdir,
    deleteFolder,
    linkToTarget
};