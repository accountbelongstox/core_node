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

const OldDirProvider = require('../provider/baseDir/OldDirProvider.js');  
const BaseDirProvider = require('../provider/baseDir/BaseDirProvider.js');
const { gdir } = require('#@global_vars');
const logger = require('#@logger');
const { fcopy, file } = require('#@btools');
const OldDirProviderMigrate = async () => {
    let isExistsOldDirs = [];
    for (const [key, value] of Object.entries(OldDirProvider)) {
        const newKey = key.replace('OLD_VAR_', '');
        const newDir = BaseDirProvider[newKey];
        const oldDir = value;
        if(newDir) {
            const isDifferentDir = oldDir != newDir;
            const isExistsOldDir = file.exists(oldDir);
            if(isDifferentDir && isExistsOldDir) {
                logger.warn(`newKey: ${newKey}`);
                logger.warn(`newDir: ${newDir}`);
                logger.warn(`oldDir: ${oldDir}`);
                logger.warn(`isDifferentDir: ${isDifferentDir}`);
                logger.warn(`isExistsOldDir: ${isExistsOldDir}`);
                logger.warn(`Migrating ${newKey} ${oldDir} to ${newDir}`);
                await fcopy.Copy(oldDir, newDir);
                isExistsOldDirs.push(oldDir);
            }
        }
    }
    if(isExistsOldDirs.length > 0) {
        logger.warn(`old dirs already migrated: ${isExistsOldDirs.length}`);
        logger.warn('need to delete old dirs:');
        for(const oldDir of isExistsOldDirs) {
            logger.warn(`${oldDir}`);
        }
        logger.warn('delete commands:');
        const deleteCommands = [];
        for(const oldDir of isExistsOldDirs) {
            deleteCommands.push(`sudo rm -rf ${oldDir}`);
        }
        logger.warn(deleteCommands.join(' && '));
        logger.warn('--------------------------------');
    }
}

module.exports = {
    OldDirProviderMigrate
}