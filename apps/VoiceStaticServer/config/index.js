import path from 'path';
import fs from 'fs';
import { PUBLIC_DIR, APP_PUBLIC_DIR, CWD, APP_DIR, APP_DATA_DIR, APP_STATIC_DIR, APP_DATA_CACHE_DIR } from '../../../ncore/gvar/gdir.js';
import { updateConfig, getConfig } from '#@/ncore/utils/http-express/config/index.js';
const DB_DIR = path.join(APP_PUBLIC_DIR, 'db');

// Voice Static Server specific configuration
const voiceServerConfig = {
    // Base Directories
    BASE_DIR: CWD,
    PUBLIC_DIR: APP_PUBLIC_DIR,

    // Database Directories
    DB_DIR: APP_DATA_DIR,
    WORD_INDEX_FILE: path.join(DB_DIR, 'word_index.json'),

    // Content Directories
    VOCABULARY_DIR: path.join(DB_DIR, 'vocabulary'),
    SENTENCE_DIR: path.join(DB_DIR, 'sentences'),
    DICTIONARY_DIR: path.join(DB_DIR, 'dictionary'),
    LEMMAS_DIR: path.join(DB_DIR, 'lemmas'),

    // Voice Directories and URLs
    VOICE_DIR: path.join(APP_DATA_CACHE_DIR, 'words'),
    VOICE_URL_PREFIX: '/voices',
    SENTENCE_VOICE_DIR: path.join(APP_DATA_CACHE_DIR, 'sentence_voices'),
    SENTENCE_VOICE_URL_PREFIX: '/sentence_voices',
};

// Function to ensure required directories exist
function ensureDirectories() {
    const dirsToCreate = [
        voiceServerConfig.PUBLIC_DIR,
        voiceServerConfig.VOICE_DIR,
        voiceServerConfig.DB_DIR,
        voiceServerConfig.SENTENCE_VOICE_DIR,
        voiceServerConfig.VOCABULARY_DIR,
        voiceServerConfig.SENTENCE_DIR,
        voiceServerConfig.DICTIONARY_DIR,
        voiceServerConfig.LEMMAS_DIR
    ];

    dirsToCreate.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.info(`Created directory: ${dir}`);
        }
    });
}

// Helper functions for path operations
export const pathUtils = {
    getVoicePath: (filename) => path.join(voiceServerConfig.VOICE_DIR, filename),
    getSentenceVoicePath: (filename) => path.join(voiceServerConfig.SENTENCE_VOICE_DIR, filename),
    getVocabularyPath: (filename) => path.join(voiceServerConfig.VOCABULARY_DIR, filename)
};

// Initialize directories
ensureDirectories();

// Update the base configuration
updateConfig(voiceServerConfig);

export { getConfig };