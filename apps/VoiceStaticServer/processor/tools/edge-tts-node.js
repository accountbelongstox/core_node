const fs = require('fs');
const path = require('path');
const { EdgeTTS, GET_TTS_NODE_VOICES } = require('../../provider/index');
const { getAmericanVoices, getBritishVoices } = require('./mate_data/soundQuality');
const { checkVoice,updateWordCount} = require('./libs/check_voice');
const { ensureQueueItem, generateAudioMa3Name, generateAudioMa3RawName, getVoiceDir, showGenerateInfo } = require('./mate_libs/voice_tool');
let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

const getOrGenerateAudioNode = async (input,callback) => {
    try {
        const MS_TTS = new EdgeTTS();
        const voices = await GET_TTS_NODE_VOICES(MS_TTS);
        const queueItem = ensureQueueItem(input);
        if (!queueItem) {
            log.error('Failed to create valid queue item from input');
            return false;
        }

        const voiceDir = getVoiceDir(queueItem);
        const generatedFiles = [];
        const americanVoice = getAmericanVoices(voices);
        const britishVoice = getBritishVoices(voices);
        const accents = [
            {
                accent: 'us',
                SoundQuality: americanVoice.ShortName
            },
            {
                accent: 'gb',
                SoundQuality: britishVoice.ShortName
            }
        ];

        for (const { accent, SoundQuality } of accents) {
            const audioMapName = await generateAudioMa3Name(queueItem, accent);
            const mediaFilename = path.join(voiceDir, audioMapName);

            const ma3RawName = await generateAudioMa3RawName(queueItem, accent);
            const ma3RawFilename = path.join(voiceDir, ma3RawName);

            if (fs.existsSync(mediaFilename)) {
                const existingFile = await checkVoice(mediaFilename);
                if (existingFile) {
                    generatedFiles.push(existingFile);
                    log.success(`Already found existing file: ${existingFile}`);
                    continue;
                }
            }
            showGenerateInfo(queueItem, SoundQuality, mediaFilename);
            await MS_TTS.synthesize(queueItem.content, SoundQuality, {
                rate: '0%',
                volume: '100%',
                pitch: '100Hz'
            });
            MS_TTS.toBase64();
            await MS_TTS.toFile(ma3RawFilename);
            // await MS_TTS.toRaw();
            const result = await updateWordCount(mediaFilename, queueItem.type);
            if (result) {
                generatedFiles.push([SoundQuality, queueItem.content, mediaFilename]);
            }
        }
        if (generatedFiles.length < accents.length) {
            log.warn(`Some voice quality failed to generate for '${queueItem.content}'`);
        }
        if (generatedFiles.length == 0) {
            log.error(`Failed to generate valid audio file for '${queueItem.content}'`);
        } else {
            log.success(`Successfully generated ${generatedFiles.length} audio for '${queueItem.content}'`);
        }
        return generatedFiles;

    } catch (e) {
        log.error(`Error generating audio: ${e.message} at ${e.stack}`);
        return [];
    }finally{
        if(callback)callback();
    }
};

module.exports = {
    getOrGenerateAudioNode,
};



