# Frontend TTS Audio Integration Guide

## Overview

This guide describes how to integrate the TTS (Text-to-Speech) audio generation system in your frontend application. The system uses a **batch queue + polling** approach for optimal performance.

### How It Works

1. **Initial Request**: Frontend fetches vocabulary words from the API
2. **Audio Status Check**: Each word includes `audio_url` and `audio_available` fields
   - `audio_url`: The URL to the audio file (or `null` if not available)
   - `audio_available`: Boolean indicating if audio exists
3. **Batch Queue**: Words without audio are queued for generation
4. **Polling**: Frontend polls for audio generation completion
5. **Audio Playback**: Once available, frontend can play the audio

### Key Principles

- **NULL Handling**: When `audio_url` is `null`, the audio file does not exist yet
- **Non-blocking**: Users can continue using the app while audio generates in background
- **Priority-based**: High-priority words (user-requested) are processed first
- **Cached**: Once generated, audio is permanently cached in the database

---

## API Endpoints

### 1. Get Library Words with Audio Status

**Endpoint**: `GET /api/app_qy_v1/vocabulary/libraries/{library_id}/words`

**Purpose**: Fetch vocabulary words with their current audio availability status

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `per_page` (optional, default: 1000, max: 2000): Items per page

**Response**:
```json
{
  "status": "success",
  "data": {
    "library": {
      "id": 1,
      "name": "TOEFL Essential Vocabulary",
      "total_words": 1500,
      "language": "english"
    },
    "words": [
      {
        "index": 1,
        "word": "abandon",
        "translations": ["放弃", "抛弃"],
        "us_phonetic": "əˈbændən",
        "uk_phonetic": "əˈbændən",
        "word_details": null,
        "has_translation": true,
        "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/p0pct/default/5f93f983524def3dca464469d2cf9f3e.mp3",
        "audio_available": true
      },
      {
        "index": 2,
        "word": "abbreviate",
        "translations": ["缩写", "缩略"],
        "us_phonetic": "əˈbriːvieɪt",
        "uk_phonetic": "əˈbriːvieɪt",
        "word_details": null,
        "has_translation": true,
        "audio_url": null,
        "audio_available": false
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 1000,
      "total": 1500,
      "last_page": 2,
      "has_more": true
    }
  }
}
```

**Important Fields**:
- `audio_url`:
  - **Non-null**: Audio file exists and can be played immediately
  - **null**: Audio file does not exist, needs to be queued for generation
- `audio_available`: Quick boolean check (same info as `audio_url !== null`)

---

### 2. Queue Batch Words for TTS Generation

**Endpoint**: `POST /api/app_qy_v1/ai_tools/tts/queue_batch`

**Purpose**: Submit multiple words for audio generation

**Authentication**: Required (Bearer token via Sanctum)

**Request Body**:
```json
{
  "words": [
    {
      "word": "abbreviate",
      "language": "en",
      "priority": 10
    },
    {
      "word": "sophisticated",
      "language": "en",
      "priority": 5
    }
  ]
}
```

**Validation Rules**:
- `words`: Required array, min 1 item, max 100 items
- `words.*.word`: Required string, max 255 characters
- `words.*.language`: Required string, max 10 characters (language code: en, ja, ko, etc.)
- `words.*.priority`: Optional integer, 0-100 (default: 0, higher = processed first)

**Response**:
```json
{
  "status": "success",
  "message": "Batch request processed successfully",
  "data": {
    "queued": [
      {
        "word": "abbreviate",
        "language": "en",
        "status": "queued"
      }
    ],
    "available": [
      {
        "word": "sophisticated",
        "language": "en",
        "status": "available",
        "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/p0pct/default/abc123.mp3"
      }
    ],
    "queued_count": 1,
    "available_count": 1
  }
}
```

**Response Fields**:
- `queued`: Words that were added to the generation queue
- `available`: Words that already have audio (returned immediately)
- `queued_count`: Number of words queued
- `available_count`: Number of words already available

---

### 3. Check Queue Status for Specific Word

**Endpoint**: `GET /api/app_qy_v1/ai_tools/tts/queue/status`

**Purpose**: Check the generation status of a specific word

**Query Parameters**:
- `word` (required): The word to check
- `language` (required): Language code (e.g., "en")

**Example**: `GET /api/app_qy_v1/ai_tools/tts/queue/status?word=abbreviate&language=en`

**Response (Word in Queue)**:
```json
{
  "status": "success",
  "message": "Queue status retrieved",
  "data": {
    "word": "abbreviate",
    "language": "en",
    "status": "pending",
    "priority": 10,
    "retry_count": 0,
    "error_message": null,
    "audio_path": null,
    "requested_at": "2025-12-20 10:30:00",
    "started_at": null,
    "completed_at": null
  }
}
```

**Response (Word Not Found)**:
```json
{
  "status": "error",
  "message": "Word not found in queue"
}
```

**Status Values**:
- `pending`: Waiting to be processed
- `processing`: Currently generating audio
- `completed`: Audio generation finished successfully
- `failed`: Generation failed (check `error_message`)

---

### 4. Get Queue Statistics

**Endpoint**: `GET /api/app_qy_v1/ai_tools/tts/queue/stats`

**Purpose**: Get overall queue statistics for monitoring

**Response**:
```json
{
  "status": "success",
  "message": "Queue statistics retrieved",
  "data": {
    "pending": 45,
    "processing": 3,
    "completed": 1205,
    "failed": 12,
    "total": 1265
  }
}
```

---

## Integration Strategy

### Step 1: Fetch Vocabulary Words

When loading a vocabulary library, fetch words with audio status:

```typescript
interface VocabularyWord {
  index: number;
  word: string;
  translations: string[] | null;
  us_phonetic: string | null;
  uk_phonetic: string | null;
  word_details: any;
  has_translation: boolean;
  audio_url: string | null;  // null = not available
  audio_available: boolean;   // false = not available
}

async function fetchLibraryWords(
  libraryId: number,
  page: number = 1
): Promise<VocabularyWord[]> {
  const response = await fetch(
    `/api/app_qy_v1/vocabulary/libraries/${libraryId}/words?page=${page}&per_page=1000`,
    {
      headers: {
        'Accept': 'application/json'
      }
    }
  );

  const result = await response.json();
  return result.data.words;
}
```

### Step 2: Identify Words Without Audio

Filter words that need audio generation:

```typescript
function getWordsNeedingAudio(words: VocabularyWord[], languageCode: string) {
  return words
    .filter(w => !w.audio_available)
    .map(w => ({
      word: w.word,
      language: languageCode,
      priority: 10  // User-initiated requests get higher priority
    }));
}
```

### Step 3: Queue Words for Generation

Submit words in batches (max 100 per request):

```typescript
async function queueWordsForAudio(
  words: { word: string; language: string; priority: number }[],
  authToken: string
): Promise<{ queued: any[]; available: any[] }> {
  // Split into batches of 100
  const batches = [];
  for (let i = 0; i < words.length; i += 100) {
    batches.push(words.slice(i, i + 100));
  }

  const allQueued = [];
  const allAvailable = [];

  for (const batch of batches) {
    const response = await fetch('/api/app_qy_v1/ai_tools/tts/queue_batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ words: batch })
    });

    const result = await response.json();

    if (result.status === 'success') {
      allQueued.push(...result.data.queued);
      allAvailable.push(...result.data.available);
    }
  }

  return { queued: allQueued, available: allAvailable };
}
```

### Step 4: Implement Polling

Poll for audio generation completion:

```typescript
interface PollingState {
  pendingWords: Set<string>;  // "word:language"
  intervalId: number | null;
  onAudioReady: (word: string, audioUrl: string) => void;
}

class TTSPollingManager {
  private state: PollingState;
  private libraryId: number;
  private pollingInterval: number = 5000; // 5 seconds

  constructor(libraryId: number, onAudioReady: (word: string, audioUrl: string) => void) {
    this.libraryId = libraryId;
    this.state = {
      pendingWords: new Set(),
      intervalId: null,
      onAudioReady
    };
  }

  addWords(words: string[], language: string) {
    words.forEach(word => {
      this.state.pendingWords.add(`${word}:${language}`);
    });

    if (!this.state.intervalId) {
      this.startPolling();
    }
  }

  private startPolling() {
    this.state.intervalId = window.setInterval(async () => {
      await this.checkPendingWords();
    }, this.pollingInterval);
  }

  private async checkPendingWords() {
    if (this.state.pendingWords.size === 0) {
      this.stopPolling();
      return;
    }

    // Re-fetch library words to check for newly available audio
    const words = await fetchLibraryWords(this.libraryId);

    words.forEach(word => {
      const key = `${word.word}:en`; // Adjust language as needed

      if (this.state.pendingWords.has(key) && word.audio_available) {
        this.state.pendingWords.delete(key);
        this.state.onAudioReady(word.word, word.audio_url!);
      }
    });
  }

  stopPolling() {
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }
  }

  destroy() {
    this.stopPolling();
    this.state.pendingWords.clear();
  }
}
```

### Step 5: Complete Integration Example

```typescript
// React component example
import { useState, useEffect, useRef } from 'react';

function VocabularyLibrary({ libraryId, authToken }: { libraryId: number; authToken: string }) {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingManager = useRef<TTSPollingManager | null>(null);

  useEffect(() => {
    loadLibrary();

    return () => {
      pollingManager.current?.destroy();
    };
  }, [libraryId]);

  async function loadLibrary() {
    setLoading(true);

    // Fetch words
    const fetchedWords = await fetchLibraryWords(libraryId);
    setWords(fetchedWords);

    // Identify words without audio
    const wordsNeedingAudio = getWordsNeedingAudio(fetchedWords, 'en');

    if (wordsNeedingAudio.length > 0) {
      // Queue for generation
      const { queued, available } = await queueWordsForAudio(wordsNeedingAudio, authToken);

      console.log(`Queued ${queued.length} words for audio generation`);
      console.log(`${available.length} words already have audio`);

      // Start polling for queued words
      if (queued.length > 0) {
        pollingManager.current = new TTSPollingManager(
          libraryId,
          (word, audioUrl) => {
            console.log(`Audio ready for word: ${word}`);
            updateWordAudio(word, audioUrl);
          }
        );

        pollingManager.current.addWords(
          queued.map(q => q.word),
          'en'
        );
      }
    }

    setLoading(false);
  }

  function updateWordAudio(word: string, audioUrl: string) {
    setWords(prevWords =>
      prevWords.map(w =>
        w.word === word
          ? { ...w, audio_url: audioUrl, audio_available: true }
          : w
      )
    );
  }

  function playAudio(audioUrl: string) {
    const audio = new Audio(audioUrl);
    audio.play();
  }

  return (
    <div>
      <h1>Vocabulary Library</h1>

      {loading && <p>Loading...</p>}

      <ul>
        {words.map(word => (
          <li key={word.index}>
            <strong>{word.word}</strong>
            {word.us_phonetic && <span> /{word.us_phonetic}/</span>}
            {word.translations && (
              <span> - {word.translations.join(', ')}</span>
            )}

            {word.audio_available ? (
              <button onClick={() => playAudio(word.audio_url!)}>
                🔊 Play
              </button>
            ) : (
              <span style={{ color: '#999' }}>⏳ Generating audio...</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Error Handling

### Handle Queue Errors

```typescript
async function queueWordsWithErrorHandling(
  words: any[],
  authToken: string
) {
  try {
    const response = await fetch('/api/app_qy_v1/ai_tools/tts/queue_batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ words })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      if (response.status === 422) {
        const error = await response.json();
        throw new Error(`Validation error: ${JSON.stringify(error.errors)}`);
      }
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to queue words:', error);
    // Show user-friendly error message
    return { status: 'error', data: { queued: [], available: [] } };
  }
}
```

### Handle Missing Audio

When audio is not available:

```typescript
function renderAudioButton(word: VocabularyWord) {
  if (word.audio_available && word.audio_url) {
    return (
      <button onClick={() => playAudio(word.audio_url!)}>
        🔊 Play
      </button>
    );
  }

  return (
    <span style={{ color: '#999' }}>
      ⏳ Audio generating...
    </span>
  );
}
```

---

## Performance Recommendations

### 1. Batch Requests
- Queue words in batches of 100 (API maximum)
- Avoid queuing the same word multiple times

### 2. Polling Strategy
- **Interval**: 5-10 seconds (balance between responsiveness and server load)
- **Stop Condition**: Stop polling when all words have audio or after 5 minutes timeout
- **Exponential Backoff**: Optionally increase polling interval if no progress

### 3. Caching
- Once `audio_url` is received, cache it in frontend state
- Consider localStorage for persistent caching across sessions

### 4. Priority Management
- User-clicked words: priority 50-100
- Auto-loaded library words: priority 1-10
- This ensures interactive requests are processed first

---

## Audio File Format

- **Format**: MP3
- **Encoding**: MPEG-1 Layer 3
- **Provider**: Microsoft Edge TTS
- **Quality**: Standard quality, optimized for web
- **Caching**: Cache-Control header set to 1 year (`max-age=31536000`)

---

## Supported Languages

The system supports 82 languages via Microsoft Edge TTS. Common language codes:

| Language | Code |
|----------|------|
| English | en |
| Chinese | zh |
| Japanese | ja |
| Korean | ko |
| Spanish | es |
| French | fr |
| German | de |
| Russian | ru |
| Arabic | ar |
| Vietnamese | vi |
| Lao | lo |
| Thai | th |

For full language support, call: `GET /api/app_qy_v1/ai_tools/tts/languages`

---

## Troubleshooting

### Audio URL is always null

**Check**:
1. Is the TTS generation task running? (Check `AppQyV1TTSGenerationTask`)
2. Is edge-tts properly installed? (Check Laravel logs)
3. Are words actually queued? (Call queue/stats endpoint)

### Polling doesn't detect new audio

**Solutions**:
1. Increase polling interval to avoid API rate limits
2. Check if words are actually being processed (queue/status endpoint)
3. Verify authentication token is valid

### Queue batch fails with 401

**Cause**: Missing or invalid authentication token

**Solution**:
```typescript
// Ensure Bearer token is included
headers: {
  'Authorization': `Bearer ${authToken}`
}
```

### Queue batch fails with 422

**Cause**: Validation error (e.g., too many words, invalid language code)

**Solution**: Check request format matches API requirements (max 100 words per batch)

---

## Testing Checklist

- [ ] Fetch library words successfully
- [ ] Identify words without audio correctly
- [ ] Queue words returns success response
- [ ] Polling detects newly available audio
- [ ] Audio playback works when URL is available
- [ ] UI shows "generating" state for pending audio
- [ ] Error handling works for network failures
- [ ] Authentication token is properly included
- [ ] Batch size doesn't exceed 100 words
- [ ] Polling stops when all audio is available

---

## Summary

**Key Points**:

1. **Audio Availability**: Check `audio_url` field - `null` means not available yet
2. **Queue Words**: Use `/api/app_qy_v1/ai_tools/tts/queue_batch` (requires auth)
3. **Poll for Updates**: Re-fetch library words every 5-10 seconds
4. **Priority**: Set higher priority (50-100) for user-clicked words
5. **Error Handling**: Always handle null `audio_url` gracefully

**Flow Summary**:
```
1. Fetch library words
   ↓
2. Filter words where audio_url === null
   ↓
3. Queue these words for generation (POST /queue_batch)
   ↓
4. Start polling (re-fetch library words every 5s)
   ↓
5. When audio_url becomes non-null, stop polling for that word
   ↓
6. Play audio using the audio_url
```

For questions or issues, contact the backend team or check Laravel logs.
