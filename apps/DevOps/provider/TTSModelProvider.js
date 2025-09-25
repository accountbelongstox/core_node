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

const logger = require('#@logger');
const { EdgeTTS } = require('@andresaya/edge-tts');

let TTS_NODE_VOICES = null;
const GET_TTS_NODE_VOICES = async (MS_TTS) => {
    if (TTS_NODE_VOICES) {
        return TTS_NODE_VOICES;
    }
    TTS_NODE_VOICES = await MS_TTS.getVoices();
    logger.info(`support voices: `);
    for (const voice of TTS_NODE_VOICES) {
        logger.success(`\t- ${voice.ShortName}`);
    }
    logger.info(`\n--------------------------------------------------------------------------------`)
    return TTS_NODE_VOICES;
};

module.exports = {
    EdgeTTS,
    GET_TTS_NODE_VOICES,
};