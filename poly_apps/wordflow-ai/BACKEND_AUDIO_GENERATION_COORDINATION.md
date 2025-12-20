# Backend Audio Generation System - Frontend Coordination Document

**Date**: 2025-12-20
**Purpose**: Define audio generation workflow and API requirements

---

## 🎯 System Overview

**Problem**: Vocabulary libraries may contain thousands of words, but audio files don't exist for all words.

**Solution**:
1. Backend maintains a queue system for asynchronous audio generation
2. Frontend requests audio generation and polls for completion
3. Audio generation can be offloaded to third-party clients/workers

---

## 🔄 Complete Workflow

```
User opens vocabulary library (CET-6, 8013 words)
  ↓
Frontend: GET /api/app_qy_v1/vocabulary/libraries/4/words?page=1&per_page=100
  ↓
Backend returns: 100 words, some with audio_url=null
  ↓
Frontend: VocabularyAudioCenter.processVocabularyLibrary(4, words)
  ↓
Frontend identifies: 45 words without audio
  ↓
Frontend: POST /api/app_qy_v1/vocabulary/libraries/4/request_audio
         Body: { words: [{word: "abandon", language: "en", index: 2}, ...] }
  ↓
Backend:
  1. Check which words already have audio (skip those)
  2. Add missing words to audio generation queue
  3. Return: { queued_count: 30 } (15 already had audio)
  ↓
Backend Queue System:
  - Processes words one by one
  - Calls TTS service to generate MP3
  - Saves file to storage
  - Updates database with audio_url
  - Marks task as "completed"
  ↓
Frontend polls every 3 seconds:
POST /api/app_qy_v1/vocabulary/audio/check_status
Body: { words: [{word: "abandon", language: "en"}, ...] }
  ↓
Backend returns:
{
  "results": [
    {
      "word": "abandon",
      "language": "en",
      "status": "completed",
      "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/b0bbb2218aa3c78802a8ed8c78aa2cae.mp3"
    },
    {
      "word": "abbreviation",
      "language": "en",
      "status": "processing",
      "audio_url": null
    },
    {
      "word": "abide",
      "language": "en",
      "status": "pending",
      "audio_url": null
    }
  ]
}
  ↓
Frontend:
  - Receives completed audio URLs
  - Notifies UI components (display play button)
  - Removes completed words from pending queue
  - Continues polling for remaining words
  ↓
When all audio generation complete:
  - Frontend stops polling
  - All words now have play buttons
```

---

## 📡 Required Backend APIs

### API 1: Request Audio Generation (NEW)

**Endpoint**: `POST /api/app_qy_v1/vocabulary/libraries/{library_id}/request_audio`

**Purpose**: Queue audio generation for words missing audio files

**Request Body**:
```json
{
  "words": [
    {
      "word": "abandon",
      "language": "en",
      "index": 2
    },
    {
      "word": "abbreviation",
      "language": "en",
      "index": 3
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "library_id": 4,
    "total_requested": 50,
    "already_exists": 15,
    "queued_count": 35,
    "queue_position": 120,
    "estimated_completion_time": "2025-12-20T15:30:00Z"
  },
  "message": "Audio generation queued successfully"
}
```

**Backend Logic**:
```python
def request_audio_generation(library_id, words):
    queued = 0
    already_exists = 0

    for word_data in words:
        word = word_data['word']
        language = word_data['language']

        # Check if audio already exists
        audio_exists = check_audio_exists(word, language)

        if audio_exists:
            already_exists += 1
            continue

        # Add to queue
        queue_audio_task({
            'word': word,
            'language': language,
            'library_id': library_id,
            'index': word_data['index'],
            'priority': 'normal',
            'created_at': datetime.now()
        })
        queued += 1

    return {
        'queued_count': queued,
        'already_exists': already_exists,
        'total_requested': len(words)
    }
```

---

### API 2: Check Audio Generation Status (NEW)

**Endpoint**: `POST /api/app_qy_v1/vocabulary/audio/check_status`

**Purpose**: Poll for audio generation completion status

**Request Body**:
```json
{
  "words": [
    {
      "word": "abandon",
      "language": "en"
    },
    {
      "word": "abbreviation",
      "language": "en"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "word": "abandon",
        "language": "en",
        "status": "completed",
        "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/b0bbb2218aa3c78802a8ed8c78aa2cae.mp3",
        "generated_at": "2025-12-20T15:28:30Z"
      },
      {
        "word": "abbreviation",
        "language": "en",
        "status": "processing",
        "audio_url": null,
        "progress": 60,
        "queue_position": 3
      },
      {
        "word": "abide",
        "language": "en",
        "status": "pending",
        "audio_url": null,
        "queue_position": 45
      },
      {
        "word": "abolish",
        "language": "en",
        "status": "failed",
        "audio_url": null,
        "error": "TTS service timeout"
      }
    ]
  }
}
```

**Status Values**:
- `pending`: In queue, not yet started
- `processing`: Currently generating audio
- `completed`: Audio file ready
- `failed`: Generation failed (will retry)

**Backend Logic**:
```python
def check_audio_status(words):
    results = []

    for word_data in words:
        word = word_data['word']
        language = word_data['language']

        # Check database for audio record
        audio_record = get_audio_record(word, language)

        if audio_record and audio_record.status == 'completed':
            results.append({
                'word': word,
                'language': language,
                'status': 'completed',
                'audio_url': audio_record.url,
                'generated_at': audio_record.created_at
            })
        else:
            # Check queue status
            queue_task = get_queue_task(word, language)

            if queue_task:
                results.append({
                    'word': word,
                    'language': language,
                    'status': queue_task.status,
                    'audio_url': None,
                    'queue_position': queue_task.position
                })
            else:
                # Not in queue, might need to re-request
                results.append({
                    'word': word,
                    'language': language,
                    'status': 'not_found',
                    'audio_url': None
                })

    return {'results': results}
```

---

## 🗄️ Database Schema Requirements

### Table: `audio_generation_queue`

```sql
CREATE TABLE audio_generation_queue (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    library_id INT,
    word_index INT,

    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    priority ENUM('low', 'normal', 'high') DEFAULT 'normal',

    audio_url VARCHAR(500),
    file_path VARCHAR(500),
    file_size INT,

    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    last_error TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,

    INDEX idx_word_language (word, language),
    INDEX idx_status_priority (status, priority, created_at),
    INDEX idx_library (library_id),

    UNIQUE KEY uk_word_lang (word, language)
);
```

### Table: `word_audio_cache`

```sql
CREATE TABLE word_audio_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',

    audio_url VARCHAR(500) NOT NULL,
    file_path VARCHAR(500),
    file_size INT,
    duration_ms INT,

    tts_provider VARCHAR(50), -- 'google', 'azure', 'aws', etc.
    voice_id VARCHAR(100),

    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_word_lang (word, language),
    INDEX idx_language (language),
    INDEX idx_created (created_at)
);
```

---

## ⚙️ Queue System Requirements

### Queue Worker Configuration

**Recommended Setup**: Redis + Bull (Node.js) or Celery (Python)

**Worker Configuration**:
```yaml
audio_generation_worker:
  concurrency: 5  # Process 5 words simultaneously
  max_retries: 3
  retry_delay: 60s  # Wait 1 minute before retry
  timeout: 30s  # Max 30 seconds per word

  priorities:
    high: 100     # User-requested words
    normal: 50    # Library initialization
    low: 10       # Background pre-generation
```

**Worker Pseudo-code**:
```python
class AudioGenerationWorker:
    def process_task(self, task):
        word = task['word']
        language = task['language']

        try:
            # Update status
            update_queue_status(task.id, 'processing')

            # Generate audio
            audio_file = tts_service.generate(
                text=word,
                language=language,
                voice='neural',
                speed=1.0
            )

            # Save file
            file_path = save_audio_file(audio_file, word, language)
            audio_url = generate_audio_url(file_path)

            # Update database
            save_audio_cache(
                word=word,
                language=language,
                audio_url=audio_url,
                file_path=file_path
            )

            # Update queue
            update_queue_status(task.id, 'completed', audio_url=audio_url)

            log.info(f"Audio generated: {word} ({language})")

        except Exception as e:
            log.error(f"Failed to generate audio for {word}: {e}")

            task['attempts'] += 1
            if task['attempts'] >= task['max_attempts']:
                update_queue_status(task.id, 'failed', error=str(e))
            else:
                # Retry
                requeue_task(task, delay=60)
```

---

## 🌐 Third-Party Client Integration

### External Worker Protocol

Allow external clients to help process the queue:

**Endpoint**: `POST /api/app_qy_v1/vocabulary/audio/claim_task`

**Request**:
```json
{
  "worker_id": "worker-gpu-server-01",
  "capabilities": ["en", "zh", "ja"],
  "max_batch": 10
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "task_id": "task_12345",
        "word": "abandon",
        "language": "en",
        "priority": "high"
      }
    ]
  }
}
```

**Submit Completed Task**: `POST /api/app_qy_v1/vocabulary/audio/submit_result`

```json
{
  "task_id": "task_12345",
  "worker_id": "worker-gpu-server-01",
  "status": "completed",
  "audio_file": "<base64_encoded_mp3>",
  "metadata": {
    "duration_ms": 850,
    "file_size": 12340,
    "tts_provider": "google_cloud_tts"
  }
}
```

---

## 📊 Frontend Implementation

### Hook Usage Example

```typescript
import { VocabularyAudioCenter } from '../services/VocabularyAudioCenter';

function VocabularyLibraryPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [audioStats, setAudioStats] = useState({ pending: 0 });

  useEffect(() => {
    // Subscribe to audio updates
    const unsubscribe = VocabularyAudioCenter.subscribe((word, audioUrl) => {
      console.log(`Audio ready for: ${word}`);

      // Update word in list
      setWords(prevWords =>
        prevWords.map(w =>
          w.word === word ? { ...w, audio_url: audioUrl } : w
        )
      );
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch vocabulary library
    fetchLibrary(libraryId).then(response => {
      const libraryWords = response.data.words;
      setWords(libraryWords);

      // Trigger audio processing
      VocabularyAudioCenter.processVocabularyLibrary(libraryId, libraryWords);
    });

    // Update stats periodically
    const statsInterval = setInterval(() => {
      setAudioStats(VocabularyAudioCenter.getStats());
    }, 1000);

    return () => {
      clearInterval(statsInterval);
      VocabularyAudioCenter.clearPending();
    };
  }, [libraryId]);

  return (
    <div>
      {audioStats.pending > 0 && (
        <div className="audio-progress">
          Generating audio: {audioStats.pending} words remaining...
        </div>
      )}

      {words.map(word => (
        <div key={word.index}>
          <span>{word.word}</span>
          {word.audio_url ? (
            <button onClick={() => playAudio(word.audio_url)}>
              ▶️ Play
            </button>
          ) : (
            <span>⏳ Generating...</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 🧪 Testing Scenarios

### Test 1: Initial Library Load
```bash
# 1. Request library with 100 words
GET /api/app_qy_v1/vocabulary/libraries/4/words?page=1&per_page=100

# Expected: 60 words have audio, 40 missing

# 2. Frontend triggers audio generation
POST /api/app_qy_v1/vocabulary/libraries/4/request_audio
Body: { "words": [... 40 words ...] }

# Expected: { "queued_count": 40 }

# 3. Poll for status after 5 seconds
POST /api/app_qy_v1/vocabulary/audio/check_status
Body: { "words": [... 40 words ...] }

# Expected: 5 completed, 35 pending/processing

# 4. Poll again after 10 seconds
# Expected: 15 completed, 25 pending/processing

# 5. Poll after 30 seconds
# Expected: All 40 completed
```

### Test 2: Retry Logic
```bash
# Simulate TTS service failure
# Backend should retry 3 times before marking as failed
# Frontend should continue polling and eventually receive "failed" status
```

### Test 3: Large Library (10,000 words)
```bash
# Load library with 10,000 words
# Frontend processes in pages of 100
# Queue system should handle bulk requests efficiently
# Estimate: ~30 minutes to generate all audio (300 words/min)
```

---

## 📈 Performance Metrics

**Target Performance**:
- Audio generation: 10-20 words/second
- Queue processing: 300-600 words/minute
- Poll response time: < 100ms
- File storage: MP3, 8-16 KB per word

**Scalability**:
- Single worker: 600 words/minute
- 5 workers: 3000 words/minute
- 10 workers: 6000 words/minute

**Storage Calculation**:
- CET-6 (8013 words) × 12 KB = ~96 MB
- All libraries (50,000 words) × 12 KB = ~600 MB

---

## 🚨 Error Handling

### Frontend Error Handling
```typescript
try {
  await VocabularyAudioCenter.processVocabularyLibrary(libraryId, words);
} catch (error) {
  if (error.code === 'QUEUE_FULL') {
    toast.error('Audio generation queue is full. Please try again later.');
  } else if (error.code === 'TTS_SERVICE_DOWN') {
    toast.error('Audio service temporarily unavailable.');
  }
}
```

### Backend Error Codes
- `QUEUE_FULL`: Queue has reached maximum capacity
- `TTS_SERVICE_DOWN`: Text-to-speech service unavailable
- `INVALID_LANGUAGE`: Unsupported language code
- `RATE_LIMIT_EXCEEDED`: Too many requests from this user

---

## ✅ Backend Implementation Checklist

- [ ] **Database Tables**
  - [ ] Create `audio_generation_queue` table
  - [ ] Create `word_audio_cache` table
  - [ ] Add indexes for performance

- [ ] **APIs**
  - [ ] POST /vocabulary/libraries/{id}/request_audio
  - [ ] POST /vocabulary/audio/check_status
  - [ ] POST /vocabulary/audio/claim_task (optional, for external workers)
  - [ ] POST /vocabulary/audio/submit_result (optional)

- [ ] **Queue System**
  - [ ] Set up Redis/Bull/Celery
  - [ ] Implement worker process
  - [ ] Configure retry logic
  - [ ] Set up monitoring

- [ ] **TTS Integration**
  - [ ] Choose TTS provider (Google Cloud TTS, Azure, AWS Polly)
  - [ ] Implement audio generation
  - [ ] Handle rate limiting
  - [ ] Optimize file size (MP3 128kbps → 64kbps)

- [ ] **Storage**
  - [ ] Configure file storage path
  - [ ] Implement audio URL generation
  - [ ] Set up CDN (optional, for production)

- [ ] **Monitoring**
  - [ ] Queue metrics (pending, processing, completed, failed)
  - [ ] TTS API usage tracking
  - [ ] Storage usage monitoring

---

## 📞 Coordination Points

**Questions for Backend Team**:
1. Which TTS provider will be used? (Google Cloud TTS recommended)
2. Queue system preference? (Bull for Node.js or Celery for Python?)
3. Maximum queue size limit?
4. Audio file storage location? (Local disk vs S3/OSS)
5. Should we support external workers?

**Frontend Commitments**:
- Poll interval: 3 seconds (configurable)
- Batch size: 50 words per poll request
- Automatic retry on poll failure
- Clear pending queue when user leaves page

---

**Status**: ✅ Frontend implementation complete, awaiting backend APIs

**Last Updated**: 2025-12-20

*This document defines the complete audio generation workflow and coordination between frontend and backend teams.*
