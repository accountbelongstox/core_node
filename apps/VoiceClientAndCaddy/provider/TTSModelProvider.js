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