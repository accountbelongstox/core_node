const path = require('path');
const logger = require('#@logger');

const generateUKName = async (content,md5) => {
    let audioMapName = `${content}_${md5}_UK.mp3`;
    return audioMapName;
}

const generateUSName = async (content,md5) => {
    let audioMapName = `${content}_${md5}_US.mp3`;
    return audioMapName;
}
const generateTTSName = async (content,md5) => {
    let audioMapName = `${content}_tts_${md5}.mp3`;
    return audioMapName;
}

module.exports = {
    generateUKName,
    generateUSName,
    generateTTSName,
}
