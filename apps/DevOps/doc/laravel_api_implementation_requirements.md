<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Laravel Dictionary API Implementation Requirements

## API Endpoints Overview

This document outlines the requirements for implementing four core API endpoints in the Laravel dictionary system, with detailed reference files from the DevOps Node.js application for accurate logic translation.

## API 1: Initialization API

### Endpoint: `POST /api/dict/initialize`

### Purpose
Complete system initialization including database setup, audio files processing, and image assets management.

### Pre-execution Process Flow
The initialization API must execute the following pre-checks and processes in sequence:

#### 1. Legacy Database Scanning and Processing
**Reference Files**: 
- `server_controller/server_init_olddb.js` (lines 1-50)
- `basetool/db-tool/cache_coordinator.js` (database detection logic)
- `provider/schemas/old_tradata_schema.js` (legacy schema structure)

**Process Steps**:
1. Scan external directory for legacy database files (`.db`, `.sqlite`)
2. If legacy database missing → Return Google Drive download instructions
3. If legacy database found → Convert and merge to new database schema
4. Validate data integrity after conversion
5. Set `legacy_db_processed.flag` marker

**Implementation Logic Reference**:
```javascript
// From server_init_olddb.js - adapt this logic to Laravel
async function startOldDbInput() {
    // Database detection and download prompt logic
    // Database conversion and merging logic
}
```

#### 2. Legacy Audio Files Scanning and Merging
**Reference Files**:
- `basetool/voice_tool/search_voice.js` (audio file scanning)
- `basetool/voice_tool/check_voice.js` (audio validation)
- `config/index.js` (lines 47-55, audio directory paths)
- `provider/WatcherProvider.js` (audio directory monitoring logic)

**Process Steps**:
1. Scan for legacy audio archive files (`.7z`, `.zip`, `.tar.gz`)
2. If audio archive missing → Return download instructions for audio package
3. Extract audio files from archives
4. Merge all `.mp3`, `.wav`, `.ogg` files to new audio directory structure
5. Organize by word/sentence categories following DevOps pattern
6. Set `audio_processed.flag` marker

**Directory Structure Reference**:
```javascript
// From config/index.js - adapt directory structure
const DICT_SOUND_DIR = path.join(ROOT_APP_STATIC_DIR, 'wordSound');
const SENTENCES_SOUND_DIR = path.join(ROOT_APP_STATIC_DIR, 'sentenceSound');
```

#### 3. Legacy Image Files Processing
**Reference Files**:
- `basetool/folder.js` (file operations and directory scanning)
- `config/index.js` (static file paths configuration)

**Process Steps**:
1. Scan for legacy image archive files
2. If image archive missing → Return download instructions
3. Extract image files from archives
4. Merge image files to new image directory structure
5. Organize by word associations
6. Set `images_processed.flag` marker

### Response Format
```json
{
  "status": "success|processing|error",
  "message": "Initialization status description",
  "progress": {
    "database": {"status": "complete|processing|pending", "progress": 100},
    "audio": {"status": "complete|processing|pending", "progress": 85},
    "images": {"status": "complete|processing|pending", "progress": 60}
  },
  "download_instructions": {
    "database": "https://drive.google.com/file/...",
    "audio": "https://drive.google.com/file/...",
    "images": "https://drive.google.com/file/..."
  }
}
```

## API 2: Word Query API

### Endpoint: `GET /api/dict/word/{word}`

### Purpose
Query word translation, associated images, and audio files from the system.

### Query Logic Reference Files
**Primary Reference**: `http_controller/word_query.js`
**Database Operations**: `middware/middb/wordQuery.js`
**Audio File Logic**: `basetool/voice_tool/search_voice.js`
**Image Handling**: `basetool/folder.js` (file search methods)

### Implementation Logic Reference
```javascript
// From word_query.js - adapt this query logic
async function queryWord(word) {
    // 1. Database query logic
    // 2. Audio file path resolution
    // 3. Image file association
    // 4. Response formatting
}

// From wordQuery.js - database query patterns
async function findWordInDatabase(word) {
    // SQL query patterns and optimization
}

// From search_voice.js - audio file location logic
function findAudioFile(word) {
    // File naming conventions and search patterns
}
```

### Query Process Flow
1. **Database Query**: Search main word database for translation
2. **Audio File Search**: Locate audio files using naming conventions from `search_voice.js`
3. **Image File Search**: Find associated images using folder scanning logic
4. **URL Generation**: Create accessible URLs for audio and image assets
5. **Response Assembly**: Format complete word data response

### Response Format
```json
{
  "status": "success|not_found|error",
  "data": {
    "word": "example",
    "translation": "示例",
    "phonetic": "/ɪɡˈzæmpəl/",
    "definition": "A thing characteristic of its kind or illustrating a general rule",
    "audio": {
      "word": "https://domain.com/audio/word/example.mp3",
      "sentence": "https://domain.com/audio/sentence/example_sentence.mp3"
    },
    "images": [
      "https://domain.com/images/example_1.jpg",
      "https://domain.com/images/example_2.png"
    ],
    "metadata": {
      "last_updated": "2024-01-15T10:30:00Z",
      "source": "database|api_sync"
    }
  }
}
```

## API 3: Untranslated Words Query API

### Endpoint: `GET /api/dict/untranslated?limit=50&offset=0`

### Purpose
Retrieve words that lack translation content for processing by clients or administrators.

### Reference Files
**Primary Logic**: `server_controller/server_init_words.js` (lines for finding incomplete words)
**Database Patterns**: `middware/middb/wordQuery.js` (query filtering)
**Word Counter**: `provider/constants/WordCounter.js` (statistics tracking)

### Implementation Logic Reference
```javascript
// From server_init_words.js - adapt word filtering logic
async function findIncompleteWords() {
    // Query for words missing translations
    // Filter by completion status
    // Return paginated results
}

// From WordCounter.js - statistics tracking
function updateUntranslatedCount() {
    // Track untranslated word statistics
}
```

### Query Criteria
- Words with empty or null translation fields
- Words without associated audio files
- Words without phonetic notation
- Optionally include priority scoring based on usage frequency

### Response Format
```json
{
  "status": "success",
  "data": {
    "words": [
      {
        "id": 12345,
        "word": "example",
        "missing": ["translation", "phonetic", "audio"],
        "priority": 8.5
      }
    ],
    "pagination": {
      "total": 1500,
      "per_page": 50,
      "current_page": 1,
      "last_page": 30
    },
    "statistics": {
      "total_untranslated": 1500,
      "missing_translation": 800,
      "missing_audio": 1200,
      "missing_images": 900
    }
  }
}
```

## API 4: Word Data Submission APIs

### 4.1 Translation Submission API

#### Endpoint: `POST /api/dict/word/{word}/translation`

**Reference Files**:
- `middware/middb/wordInsert.js` (insertion logic)
- `middware/middb/wordUpdate.js` (update logic)
- `basetool/db-tool/trans_item_tool.js` (translation processing)

**Implementation Reference**:
```javascript
// From wordInsert.js - adapt insertion logic
async function insertTranslation(word, translationData) {
    // Validation and sanitization
    // Database insertion with conflict resolution
    // Update statistics
}

// From trans_item_tool.js - translation processing
function processTranslationData(rawData) {
    // Data normalization and validation
    // Encoding handling
}
```

**Request Format**:
```json
{
  "translation": "示例",
  "phonetic": "/ɪɡˈzæmpəl/",
  "definition": "A thing characteristic of its kind",
  "source": "manual|api|ai_generated"
}
```

### 4.2 Audio Submission API

#### Endpoint: `POST /api/dict/word/{word}/audio`

**Reference Files**:
- `http_controller/sync_audio.js` (audio upload handling)
- `basetool/voice_tool/voice_tool.js` (audio file processing)
- `basetool/voice_tool/check_voice.js` (audio validation)

**Implementation Reference**:
```javascript
// From sync_audio.js - adapt audio upload logic
async function submitAudio(word, audioFile) {
    // File validation and processing
    // Audio format conversion if needed
    // File storage and URL generation
}

// From voice_tool.js - audio file naming and organization
function processAudioFile(word, audioBuffer) {
    // File naming conventions
    // Directory organization
    // Metadata extraction
}

// From check_voice.js - audio validation
function validateAudioFile(audioFile) {
    // Format validation
    // Quality checks
    // Duration limits
}
```

**Request**: Multipart form data with audio file
**Supported Formats**: MP3, WAV, OGG (based on voice_tool.js validation)

### 4.3 Image Submission API

#### Endpoint: `POST /api/dict/word/{word}/images`

**Reference Files**:
- `basetool/folder.js` (file handling operations)
- `config/index.js` (image directory configuration)

**Implementation Reference**:
```javascript
// From folder.js - adapt file operations
async function submitImage(word, imageFile) {
    // Image validation and processing
    // Resize and optimize if needed
    // File storage and URL generation
}
```

**Request**: Multipart form data with image file(s)
**Supported Formats**: JPG, PNG, GIF, WebP

## Encoding and Storage References

### Character Encoding Handling
**Reference File**: `ncore/foundation/common/encoding.js`
- Use for proper UTF-8 handling of international characters
- Apply encoding standards for translation text processing
- Ensure database character set compatibility

### File Storage and Organization
**Reference Files**:
- `config/index.js` (directory structure patterns)
- `provider/baseDir/BaseDirProvider.js` (path management)
- `basetool/folder.js` (file operations)

### Database Transaction Patterns
**Reference Files**:
- `provider/DataProvider.js` (connection management)
- `middware/cacheMainMid.js` (transaction handling)

## Implementation Priority and Dependencies

### Phase 1: Core Infrastructure
1. Initialize external directory management
2. Implement file marker system
3. Set up database schema and connections

### Phase 2: Initialization API
1. Legacy database processing
2. Audio file extraction and merging
3. Image file processing and organization

### Phase 3: Query APIs
1. Word query with multi-source data retrieval
2. Untranslated words filtering and pagination

### Phase 4: Submission APIs
1. Translation submission with validation
2. Audio upload with format processing
3. Image upload with optimization

## Error Handling and Validation

### Common Error Scenarios
- Missing external directories
- Corrupted archive files
- Invalid audio/image formats
- Database connection failures
- Insufficient storage space

### Reference Error Handling Patterns
**Reference Files**:
- `main.js` (error handling in main flow)
- `server_controller/ClientMaster.js` (initialization error handling)
- `http_controller/system.js` (API error responses)

## Testing and Validation Requirements

### Unit Tests Should Cover
- Database conversion accuracy
- File extraction and merging
- Audio/image validation
- URL generation consistency
- Error handling scenarios

### Integration Tests Should Validate
- Complete initialization flow
- Multi-source data retrieval
- File upload and storage
- API response consistency

This completes the detailed API implementation requirements with specific reference files for accurate logic translation from the DevOps Node.js application to Laravel.