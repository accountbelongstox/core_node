const logger = require('#@logger');

const generateGbNormalName = async (content, md5) => {
    content = content.toUpperCase();
    let audioMapName = `gb_${md5}_${content}_normal.mp3`;
    return audioMapName;
}

const generateUsNormalName = async (content, md5) => {
    content = content.toUpperCase();
    let audioMapName = `us_${md5}_${content}_normal.mp3`;
    return audioMapName;
}

module.exports = {
    generateGbNormalName,
    generateUsNormalName,
}
