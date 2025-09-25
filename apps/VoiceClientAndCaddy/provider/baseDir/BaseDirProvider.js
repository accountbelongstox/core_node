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

const path = require('path');
const fs = require('fs');
const sysarg = require('#@ncore/utils/systool/libs/sysarg.js');
const gconfig = require('#@gconfig');
const { fdir } = require('#@btools');
const logger = require('#@logger');
const { gdir, appname } = require('#@global_vars');

const { 
    ROOT_APP_STATIC_DIR,
    APP_METADATA_DIR,
} = gdir;

const DICTIONARY_DIR = path.join(APP_METADATA_DIR, 'dictionary');
const LEMMAS_DIR = path.join(APP_METADATA_DIR, 'lemmas');
const SENTENCES_DIR = path.join(APP_METADATA_DIR, 'sentences');
const VOCABULARY_DIR = path.join(APP_METADATA_DIR, 'vocabulary');
const TRANSLATE_DIR = path.join(APP_METADATA_DIR, 'translate');
const META_DIR = path.join(APP_METADATA_DIR, 'meta');
//-------------------------------------------------------------- 
const DATA_DIR = path.join(ROOT_APP_STATIC_DIR, `data`);
const CACHE_DIR = path.join(ROOT_APP_STATIC_DIR, `cache`);
const VOCABULARY_TABLE_DIR = path.join(CACHE_DIR, 'vocabulary_table');
const TEST_DIR = ""
const DICT_SOUND_DIR = gconfig.getConfig("DICT_SOUND_DIR");
const DICT_SOUND_SUBTITLE_DIR = gconfig.getConfig("DICT_SOUND_SUBTITLE_DIR");
const SENTENCES_SOUND_DIR = gconfig.getConfig("SENTENCES_SOUND_DIR");
const SENTENCES_SOUND_SUBTITLE_DIR = gconfig.getConfig("SENTENCES_SOUND_SUBTITLE_DIR");
const OLD_DB_DIR = path.join(ROOT_APP_STATIC_DIR, 'olddata');
const TRANSLATE_TMP_DIR = CACHE_DIR;
const OLD_BING_VOICE_DIR = path.join(ROOT_APP_STATIC_DIR, 'oldvoice');
const OLD_BING_IMAGE_DIR = path.join(ROOT_APP_STATIC_DIR, 'oldimage');

const WORD_QUERY_CACHE_DIR = path.join(CACHE_DIR,'words');

checkDirectory(OLD_DB_DIR, "OLD_DB_DIR");
checkDirectory(OLD_BING_VOICE_DIR, "OLD_BING_VOICE_DIR");
checkDirectory(OLD_BING_IMAGE_DIR, "OLD_BING_IMAGE_DIR");
const WORD_VALIDITY_DIR = path.join(APP_METADATA_DIR, 'word_validity');
const WORD_VALIDITY_FILE = path.join(WORD_VALIDITY_DIR, 'word_validity.json');

fdir.mkdirSync(DICT_SOUND_DIR)
fdir.mkdirSync(SENTENCES_SOUND_DIR)
fdir.mkdirSync(DICT_SOUND_SUBTITLE_DIR)
fdir.mkdirSync(SENTENCES_SOUND_SUBTITLE_DIR)
fdir.mkdirSync(META_DIR)
fdir.mkdirSync(VOCABULARY_TABLE_DIR)
fdir.mkdirSync(WORD_VALIDITY_DIR)
fdir.mkdirSync(OLD_BING_VOICE_DIR)
fdir.mkdirSync(OLD_BING_IMAGE_DIR)
fdir.mkdirSync(OLD_DB_DIR)
fdir.mkdirSync(TRANSLATE_DIR)
fdir.mkdirSync(TRANSLATE_TMP_DIR)
fdir.mkdirSync(DATA_DIR)
fdir.mkdirSync(CACHE_DIR)
fdir.mkdirSync(WORD_QUERY_CACHE_DIR)

function checkDirectory(dirPath, dirName, downloadUrl = "https://www.example.com") {
    if (fdir.isEmpty(dirPath)) {
        logger.error(`${dirName}[${dirPath}] is empty, you can download data from URL: ${downloadUrl}`);
    } else {
        const files = fdir.scanDirectory(dirPath);
        logger.success(`${dirName} is not empty (${dirPath})[${files.length} Files]`);
    }
}

module.exports = {
    DICTIONARY_DIR,
    LEMMAS_DIR,
    SENTENCES_DIR,
    VOCABULARY_DIR,
    VOCABULARY_TABLE_DIR,
    META_DIR,
    DICT_SOUND_DIR,
    DICT_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_DIR,
    WORD_VALIDITY_DIR,
    WORD_VALIDITY_FILE,
    OLD_BING_VOICE_DIR,
    OLD_BING_IMAGE_DIR,
    OLD_DB_DIR,
    TRANSLATE_DIR,
    TRANSLATE_TMP_DIR,
    DATA_DIR,
    OLD_BING_VOICE_DIR,
    OLD_BING_IMAGE_DIR,
    OLD_DB_DIR,
    CACHE_DIR,
    TEST_DIR,
    WORD_QUERY_CACHE_DIR

};