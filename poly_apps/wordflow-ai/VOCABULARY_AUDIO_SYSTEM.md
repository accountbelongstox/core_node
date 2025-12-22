# Vocabulary Audio System - Frontend Implementation

## Architecture Overview

The frontend audio system consists of three main components:

### 1. VocabularyLibraryManager (services/VocabularyLibraryManager.ts)
Global vocabulary library manager that handles:
- Loading/unloading vocabulary libraries
- Managing word data with pagination
- Caching words in localStorage
- Tracking pending audio requests
- Automatic audio availability checking with retry mechanism

**Key Features**:
- Stores libraries and words in memory with localStorage persistence
- Tracks which pages have been loaded for each library
- Maintains a queue of words needing audio
- Auto-retries audio requests (max 3 times, 5-second delay)
- Emits events when words are added or audio becomes ready

**API**:
```typescript
// Load a library
VocabularyLibraryManager.loadLibrary(libraryId, name, language, totalWords);

// Add words to library (triggers audio processing)
VocabularyLibraryManager.addWords(libraryId, words, page);

// Get library data
VocabularyLibraryManager.getLibrary(libraryId);

// Get specific word
VocabularyLibraryManager.getWord(libraryId, wordIndex);

// Unload library
VocabularyLibraryManager.unloadLibrary(libraryId);
```

### 2. AudioProcessingHook (services/AudioProcessingHook.ts)
Event-driven hook that sends audio requests to backend queue:
- Listens for 'library:audio_needed' events
- Batches audio requests (50 words per batch, 2-second delay)
- Sends batched requests to `/api/app_qy_v1/tts/queue_batch`
- Backend queues audio generation tasks

**Batch Processing**:
- Default batch size: 50 words
- Default batch delay: 2 seconds
- Automatically flushes when batch size is reached
- Sends language code, word text, and type ('word')

**Backend API Endpoint** (to be implemented by backend AI):
```typescript
POST /api/app_qy_v1/tts/queue_batch
{
  "words": [
    { "text": "hello", "language": "en", "type": "word" },
    { "text": "world", "language": "en", "type": "word" }
  ]
}
```

### 3. GlobalInitializer (services/GlobalInitializer.ts)
Initializes global services on app startup:
- Initializes AudioProcessingHook
- Provides initialization status

## Event System

The system uses EventBus for communication:

**Events Emitted**:
- `library:loaded` - When library is loaded
- `library:words_added` - When words are added to library
- `library:audio_needed` - When words need audio (triggers AudioProcessingHook)
- `library:audio_ready` - When audio becomes available
- `library:unloaded` - When library is unloaded
- `library:all_cleared` - When all libraries are cleared

**Event Listeners**:
Components can listen for `library:audio_ready` to update UI when audio becomes available.

## Integration with LibraryDetail Page

The LibraryDetail page (pages/Vocabulary/LibraryDetail.tsx) integrates the system:

1. Loads library and words from API
2. Passes words to VocabularyLibraryManager
3. Manager triggers audio processing hook for words without audio
4. Hook batches and sends requests to backend queue
5. Manager periodically checks audio availability
6. Emits events when audio becomes ready
7. Page updates UI to show audio controls

## Data Flow

```
User opens library
    ↓
LibraryDetail fetches words from API
    ↓
VocabularyLibraryManager.addWords(words)
    ↓
Manager checks which words need audio
    ↓
Emits 'library:audio_needed' event
    ↓
AudioProcessingHook batches words
    ↓
Sends batch to /api/app_qy_v1/tts/queue_batch
    ↓
Backend queues TTS generation tasks
    ↓
Manager periodically checks audio availability
    ↓
When audio ready, emits 'library:audio_ready'
    ↓
Page updates UI with audio controls
```

## Backend Requirements

The backend AI should implement:

### 1. Queue Batch Endpoint
```php
POST /api/app_qy_v1/tts/queue_batch
Request: {
  "words": [
    { "text": string, "language": string, "type": string }
  ]
}
Response: {
  "success": true,
  "queued": number,
  "message": string
}
```

### 2. Task Queue System
- Receive batched audio requests
- Queue TTS generation tasks
- Process tasks asynchronously
- Store generated audio at: `/www/wwwroot/laravel_db/tts_data/audio/{language}/word/{md5(word)}.mp3`

### 3. Audio Serve Endpoint (Already exists)
```php
GET /api/app_qy_v1/tts/audio/{language}/word/{filename}
- Returns audio file if exists
- Returns 404 if not yet generated
```

### 4. Integration with Global Task System
- Use Laravel queue system or custom task manager
- Allow third-party clients to process tasks
- Track task status and completion

## Storage

**localStorage Keys**:
- `vocabulary_library_cache` - Cached library and word data
- `audio_requests_cache` - Pending audio requests with retry count

## Configuration

**VocabularyLibraryManager**:
- `maxRetries`: 3
- `retryDelay`: 5000ms (5 seconds)

**AudioProcessingHook**:
- `batchSize`: 50 words
- `batchDelay`: 2000ms (2 seconds)

## Usage Example

```typescript
import { VocabularyLibraryManager } from './services/VocabularyLibraryManager';
import { EventBus } from './services/EventBus';

// Load library
VocabularyLibraryManager.loadLibrary(1, 'English Basics', 'english', 1000);

// Add words (triggers audio processing)
VocabularyLibraryManager.addWords(1, words, 1);

// Listen for audio ready
EventBus.on('library:audio_ready', (event) => {
  console.log('Audio ready for:', event.word);
  // Update UI to show audio control
});

// Check pending audio count
const pending = VocabularyLibraryManager.getPendingAudioCount();
console.log(`${pending} words waiting for audio`);
```

## Frontend Complete ✅

All frontend components are implemented and integrated. The system is ready to work once backend implements:
1. `/api/app_qy_v1/tts/queue_batch` endpoint
2. Async TTS generation queue processing
3. Audio file storage at correct paths
