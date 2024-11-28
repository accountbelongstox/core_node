import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PUBLIC_DIR,APP_PUBLIC_DIR,CWD } from '../../../ncore/gvar/gdir.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let printedAllPaths = false;

class TTSProvider {
    static BASE_DIR = CWD;
    static APP_DIR = path.join(this.BASE_DIR, 'app');
    static STATIC_DIR = path.join(APP_PUBLIC_DIR, 'static');
    static PUBLIC_DIR = PUBLIC_DIR;
    
    static DB_DIR = path.join(this.APP_DIR, 'db');
    static STATIC_DB_DIR = this.STATIC_DIR;
    static WORD_INDEX_FILE = path.join(this.DB_DIR, 'word_index.json');

    static VOCABULARY_DIR = path.join(this.DB_DIR, 'vocabulary');
    static SENTENCE_DIR = path.join(this.DB_DIR, 'sentences');
    static DICTIONARY_DIR = path.join(this.DB_DIR, 'dictionary');
    static LEMMAS_DIR = path.join(this.DB_DIR, 'lemmas');
    
    // Voice directories with URL prefixes
    static VOICE_DIR = path.join(this.PUBLIC_DIR, 'words');
    static VOICE_URL_PREFIX = '/voices';
    
    static SENTENCE_VOICE_DIR = path.join(this.PUBLIC_DIR, 'sentence_voices');
    static SENTENCE_VOICE_URL_PREFIX = '/sentence_voices';

    static printAllPaths() {
        if (!printedAllPaths) {
            console.info("All paths:");
            console.info(`BASE_DIR: ${this.BASE_DIR}`);
            console.info(`APP_DIR: ${this.APP_DIR}`);
            console.info(`STATIC_DIR: ${this.STATIC_DIR}`);
            console.info(`DB_DIR: ${this.DB_DIR}`);
            console.info(`STATIC_DB_DIR: ${this.STATIC_DB_DIR}`);
            printedAllPaths = true;
        }
    }

    static ensureDirectories() {
        [
            this.STATIC_DIR,
            this.VOICE_DIR,
            this.DB_DIR,
            this.SENTENCE_VOICE_DIR
        ].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    static getVoicePath(filename) {
        return path.join(this.VOICE_DIR, filename);
    }
    
    static getSentenceVoicePath(filename) {
        return path.join(this.SENTENCE_VOICE_DIR, filename);
    }
    
    static getVocabularyPath(filename) {
        return path.join(this.VOCABULARY_DIR, filename);
    }
}

export default TTSProvider;
