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

const { getUniqueContentLines } = require('../libs/analyze_unique_line.js');
const { VOCABULARY_DIR } = require('../provider/baseDir/BaseDirProvider.js');
const { findLocalVoice } = require('../basetool/voice_tool/check_voice.js');
const logger = require('#@logger');
const { addWordBack } = require('../basetool/thredShareByVoiceFile.js');
const sysarg = require('#@ncore/utils/systool/libs/sysarg.js'); 

async function initialize_not_client() {
    let word_segmentation = sysarg.getArg('word_segmentation');
    let vocabulary = getUniqueContentLines(VOCABULARY_DIR);

    let vocabulary_start = 0;
    let vocabulary_end = vocabulary.length;
    if (word_segmentation) {
        word_segmentation = word_segmentation.split('-');
        vocabulary_start = parseInt(word_segmentation[0]);
        vocabulary_end = parseInt(word_segmentation[1]);
    }

    const vocabulary_slice = vocabulary.slice(vocabulary_start, vocabulary_end);

    const generatedWords = []
    const notGeneratedWords = []
    for (const item of vocabulary_slice) {
        const validFile = await findLocalVoice(item);
        if (!validFile) {
            addWordBack(item);
            notGeneratedWords.push(item);
        } else {
            generatedWords.push(item);
        }
    }

    const totalCount = vocabulary.length;
    const waitingCount = notGeneratedWords.length;

    const trimedGeneratedWords = generatedWords.slice(0, 100);
    const trimedNotGeneratedWords = notGeneratedWords.slice(0, 100);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.success(`"${trimedGeneratedWords.join(',')}" is already generated`);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.warn(`"${trimedNotGeneratedWords.join(',')}" is not generated, adding to queue`);
    logger.warn(`-------------------------------------------------------------------------------`);
    logger.success(`Total words: ${vocabulary.length}`);
    logger.success(`Generated words: ${generatedWords.length}`);
    logger.warn(`Not generated words: ${notGeneratedWords.length}`);
    logger.info(`word_segmentation: ${word_segmentation}`);
}


module.exports = {
    initialize_not_client
};
