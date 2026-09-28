const { strtool, arrtool, jsontool } = require('#@btools');
const { DictionariesTableName } = require(`../../provider/types/data_table_names.js`)
const { word_main_schema } = require(`../../provider/schemas/index.js`)
const { transformDictionaryData, processImageArray, processH2Content } = require('./trans_item_tool.js');
const logger = require('#@logger');
const { dbItemAlign } = require('./dbitem_align.js');
const WrapWordTransItemNotKeepIdKey = (dataOrWord) => {
    return WrapWordTransItemNormal(dataOrWord, false);
}
const WrapWordTransItemNormal = (dataOrWord, keepIdKey = true) => {
    let data;
    if (typeof dataOrWord === 'string') {
        data = {
            content: dataOrWord
        };
    } else {
        data = dataOrWord;
    }
    data = parseTranslationRecord(data);
    data = dbItemAlign(data, word_main_schema, DictionariesTableName, keepIdKey);

    return data;
};

function parseTranslationRecord(record) {
    const CurrentTime = Math.floor(Date.now() / 1000);
    let translation = record.translation ;
    translation = jsontool.toJSONSimple(translation)
    if (translation && translation.translation) {
        translation = translation.translation;
        translation = jsontool.toJSONSimple(translation)
    }
    let usPhonetic = record.us_phonetic || (translation && translation.us_phonetic) || record.usPhonetic || null
    let ukPhonetic = record.uk_phonetic || (translation && translation.uk_phonetic) || record.ukPhonetic || null
    record.usPhonetic = usPhonetic
    record.ukPhonetic = ukPhonetic
    let voice_files = record.voice_files || (translation && translation.voice_files) || null
    voice_files = voice_files ? jsontool.toJSONSimple(voice_files) : voice_files
    voice_files = transformDictionaryData(voice_files)
    let image_files = record.sample_images || (translation && translation.sample_images) || null
    image_files = image_files ? jsontool.toJSONSimple(image_files) : image_files
    image_files = processImageArray(image_files)
    record.voice_files = voice_files
    record.image_files = image_files
    record.translation = processH2Content(translation)
    record.content = strtool.cleanWord(record.content)
    if (!record.md5) record.md5 = strtool.generateMd5(record.content)
    if (record.hasOperations === undefined) record.hasOperations = true
    if (!record.createdAt) record.createdAt = CurrentTime
    if (!record.lastInsertTime) record.lastInsertTime = CurrentTime
    record.isTranslation = jsontool.isNotEmptyObject(record.translation)
    if (!record.lastQueryTimea) record.lastQueryTimea = CurrentTime
    if (!record.lastUpdateTime) record.lastUpdateTime = CurrentTime
    if (!record.lastModified) record.lastModified = CurrentTime
    if (!record.translation_provider || record.translation_provider == null) record.translation_provider = 0

    return record;
}


module.exports = {
    parseTranslationRecord,
    WrapWordTransItemNormal,
    WrapWordTransItemNotKeepIdKey
};