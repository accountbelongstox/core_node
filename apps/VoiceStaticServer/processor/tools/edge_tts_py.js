const fs = require('fs');
const path = require('path');
const { findEdgeTTSBinary } = require('./mate_libs/edgeTTSFinder');
const { getAmericanVoice, getEnglishVoice } = require('./mate_data/soundQuality');
const { execCommand, execCmdResultText } = require('#@utils_commander');
const { findVoiceByLocale } = require('./mate_data/soundQuality');
const { checkVoice, updateWordCount} = require('./libs/check_voice');
const { ensureQueueItem, generateAudioMa3Name, generateAudioMa3RawName, ITEM_TYPE, getVoiceDir, generateAudioSubtitleName, getSubtitleDir, showGenerateInfo } = require('./mate_libs/voice_tool');
const { getMd5 } = require('./mate_libs/string.js');
let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
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

let TTS_PY_VOICES = null;

function processVoiceTextToVoiceList(voicesText) {
    voicesText = voicesText.split('\n');
    const voices = [];
    for (const line of voicesText) {
        if (line.includes('Female') || line.includes('Male')) {
            const voiceName = line.trim().split(/\s+/)[0];
            if (voiceName) {
                voices.push(voiceName);
            }
        }
    }
    return voices;
}

const GET_TTS_PY_VOICES = async (edgeTTSBinary) => {
    if (TTS_PY_VOICES) {
        return TTS_PY_VOICES;
    }
    if (!edgeTTSBinary) {
        edgeTTSBinary = await findEdgeTTSBinary();
    }
    const command = `${edgeTTSBinary} --list-voices`;
    const voicesText = await execCmdResultText(command);
    TTS_PY_VOICES = processVoiceTextToVoiceList(voicesText);
    log.success(`\n--------------------------------------------------------------------------------`)
    log.success(`support voices: ${TTS_PY_VOICES.length}`);
    let voiceList = [];
    for(const voice of TTS_PY_VOICES){
        voiceList.push(`${voice}`);
    }
    log.success(voiceList.join(' / '));
    log.success(`\n--------------------------------------------------------------------------------`)
    return TTS_PY_VOICES;
};

const getOrGenerateAudioPy = async (input,callback) => {
    let generatedWordFiles = [];
    try {
        const edgeTTSBinary = await findEdgeTTSBinary();
        const voices = await GET_TTS_PY_VOICES(edgeTTSBinary);
        const queueItem = ensureQueueItem(input);
        if (!queueItem) {
            log.error('Failed to create valid queue item from input');
            return false;
        }

        if (!edgeTTSBinary) {
            log.error('Could not find edge-tts binary');
            return [];
        }

        const voiceDir = getVoiceDir(queueItem);
        const subtitleDir = getSubtitleDir(queueItem);
        const accents = [
            {
                accent: 'us',
                SoundQuality: findVoiceByLocale(voices,`en-US`)
            },
            {
                accent: 'gb',
                SoundQuality: findVoiceByLocale(voices,`en-GB`)
            }
        ];

        for (const { accent, SoundQuality } of accents) {
            const audioMapName = await generateAudioMa3Name(queueItem, accent);
            const mediaFilename = path.join(voiceDir, audioMapName);

            const ma3RawName = await generateAudioMa3RawName(queueItem, accent);
            const ma3RawFilename = path.join(voiceDir, ma3RawName);

            const subtitlesName = await generateAudioSubtitleName(queueItem, accent);
            const subtitlesFilename = path.join(subtitleDir, subtitlesName);

            if (fs.existsSync(mediaFilename)) {
                const existingFile = await checkVoice(mediaFilename);
                if (existingFile) {
                    generatedWordFiles.push(existingFile);
                    continue;
                }
            }
            let command = `${edgeTTSBinary} --voice ${SoundQuality} --text "${queueItem.content}" --write-media "${mediaFilename}" --write-subtitles "${subtitlesFilename}"`;
            showGenerateInfo(queueItem, SoundQuality, mediaFilename, command);
            await execCommand(command);
            updateWordCount(mediaFilename, queueItem.type);
            generatedWordFiles.push(mediaFilename);
        }
    } catch (e) {
        log.error(`Error generating audio: ${e.message}`);
        return [];
    }finally{
        if(callback)callback(generatedWordFiles);
    }
};

module.exports = {
    getOrGenerateAudioPy,
    GET_TTS_PY_VOICES
};

