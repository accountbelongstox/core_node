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
    APP_OUTPUT_DIR,
    APP_METADATA_DIR,
    APP_DATA_CACHE_DIR 
} = gdir;

const OLD_VAR_DICTIONARY_DIR = path.join(APP_METADATA_DIR, 'dictionary');
const OLD_VAR_LEMMAS_DIR = path.join(APP_METADATA_DIR, 'lemmas');
const OLD_VAR_SENTENCES_DIR = path.join(APP_METADATA_DIR, 'sentences');
const OLD_VAR_VOCABULARY_DIR = path.join(APP_METADATA_DIR, 'vocabulary');
const OLD_VAR_TRANSLATE_TMP_DIR = path.join(APP_DATA_CACHE_DIR, 'translate_tmp');
const OLD_VAR_TRANSLATE_DIR = path.join(APP_METADATA_DIR, 'translate');
const OLD_VAR_VOCABULARY_TABLE_DIR = path.join(APP_DATA_CACHE_DIR, 'vocabulary_table');
const OLD_VAR_META_DIR = path.join(APP_METADATA_DIR, 'meta');
const OLD_VAR_DICT_SOUND_DIR = path.join(APP_OUTPUT_DIR, 'dictSoundLib');
const OLD_VAR_DICT_SOUND_SUBTITLE_DIR = path.join(APP_OUTPUT_DIR, 'dictSoundSubtitle');
const OLD_VAR_SENTENCES_SOUND_DIR = path.join(APP_OUTPUT_DIR, 'sentenceSoundLib');
const OLD_VAR_SENTENCES_SOUND_SUBTITLE_DIR = path.join(APP_OUTPUT_DIR, 'sentenceSoundSubtitle');
const OLD_VAR_OLD_DATA_DIR = path.join(APP_OUTPUT_DIR, 'oldData');
const OLD_VAR_OLD_BING_DIR = path.join(OLD_VAR_OLD_DATA_DIR, 'bing');
const OLD_VAR_OLD_BING_VOICE_DIR = path.join(OLD_VAR_OLD_DATA_DIR, 'voice');
const OLD_VAR_OLD_BING_IMAGE_DIR = path.join(OLD_VAR_OLD_DATA_DIR, 'image');
const OLD_VAR_OLD_DB_DIR = path.join(OLD_VAR_OLD_DATA_DIR, 'data');
const OLD_VAR_WORD_VALIDITY_DIR = path.join(APP_METADATA_DIR, 'word_validity');
const OLD_VAR_WORD_VALIDITY_FILE = path.join(OLD_VAR_WORD_VALIDITY_DIR, 'word_validity.json');

module.exports = {
    OLD_VAR_DICTIONARY_DIR,
    OLD_VAR_LEMMAS_DIR,
    OLD_VAR_SENTENCES_DIR,
    OLD_VAR_VOCABULARY_DIR,
    OLD_VAR_TRANSLATE_DIR,
    OLD_VAR_VOCABULARY_TABLE_DIR,   
    OLD_VAR_META_DIR,
    OLD_VAR_DICT_SOUND_DIR,
    OLD_VAR_DICT_SOUND_SUBTITLE_DIR,
    OLD_VAR_SENTENCES_SOUND_DIR,
    OLD_VAR_SENTENCES_SOUND_SUBTITLE_DIR,
    OLD_VAR_OLD_DATA_DIR,   
    OLD_VAR_TRANSLATE_TMP_DIR,
    OLD_VAR_OLD_BING_DIR,
    OLD_VAR_OLD_BING_VOICE_DIR,
    OLD_VAR_OLD_BING_IMAGE_DIR,
    OLD_VAR_OLD_DB_DIR,
    OLD_VAR_WORD_VALIDITY_DIR,
    OLD_VAR_WORD_VALIDITY_FILE,
    OLD_VAR_DICTIONARY_DIR,
    OLD_VAR_LEMMAS_DIR,
    OLD_VAR_SENTENCES_DIR,
    OLD_VAR_VOCABULARY_DIR,
    OLD_VAR_TRANSLATE_DIR,
    OLD_VAR_VOCABULARY_TABLE_DIR,   
    OLD_VAR_META_DIR,
};