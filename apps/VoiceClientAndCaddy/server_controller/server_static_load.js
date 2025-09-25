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
const { findLocalVoice } = require('../basetool/voice_tool/check_voice.js');
const { getOrGenerateAudioPy } = require('../basetool/ptools/edge_tts_py.js');
const { datetool, arrtool,fcopy } = require('#@btools');
const logger = require('#@logger');
const { updateStaticIsExistsByMainDB } = require('../middware/middb/wordUpdate.js');
const { getVoiceGenerationThread } = require('../provider/ThreadProvider.js');
const { getDICTSoundWatcher, getOLD_BING_VOICEWatcher } = require('../provider/WatcherProvider.js');
const { showAllProperties } = require('#@inspect');
const { OLD_BING_IMAGE_DIR } = require('../provider/baseDir/BaseDirProvider.js');


async function searchVoiceTest() {
    logger.info(`searchVoiceTest`);
    let findVoiceMap = await findLocalVoice('test');
    logger.info(findVoiceMap);
    findVoiceMap = await findLocalVoice('word');
    logger.info(findVoiceMap);
    logger.info(`searchVoiceTest done`);
}

async function cleanCopyFiles() {
    const watcher = await getDICTSoundWatcher();
    watcher.show();
    const filesSet = await watcher.getFilesSet();
    for (let finame of filesSet) {
        if (finame.includes('- Copy')) {
            const file = await watcher.find(finame);
            logger.warn(`clean a Copy file:${file}`);
            try {
                fs.unlinkSync(file);
            } catch (error) {
                logger.error(`clean a Copy file:${file} error:${error}`);
            }
        }else if(finame.endsWith('.png') || finame.endsWith('.jpg') || finame.endsWith('.jpeg') || finame.endsWith('.gif') || finame.endsWith('.webp')){
            const file = await watcher.find(finame);
            logger.warn(`copy a image file:${file}`);
            await fcopy.copyFileToDir(file,OLD_BING_IMAGE_DIR,true,true);
        }
    }
}

async function fixOldBingFiles() {
    const watcher = await getOLD_BING_VOICEWatcher();
    watcher.show();
    const filesSet = await watcher.getFilesSet();
    for (let finame of filesSet) {
        if (finame.endsWith('_0.mp3')) {
            const newName = finame.replace('_0.mp3','.mp3');
            const file = await watcher.find(finame);
            logger.warn(`fix a old bing file:${file}`);
            try {
                fs.renameSync(file,newName);
            } catch (error) {
                logger.error(`fix a old bing file:${file} error:${error}`);
            }
        }
    }
}

async function start_load_static() {
    await cleanCopyFiles();
    await fixOldBingFiles();
    await searchVoiceTest();
}

module.exports = {
    start_load_static,
};


