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