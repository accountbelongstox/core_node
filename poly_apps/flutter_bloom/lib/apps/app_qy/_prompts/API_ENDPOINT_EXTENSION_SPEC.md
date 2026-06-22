# API Endpoint Extension Specification for QY App

## Overview
This document specifies the backend API endpoints required to support the QY vocabulary learning app, including user initialization, language management, vocabulary libraries, memory bank, AI features, and reading materials.

## Table of Contents
1. [Public Endpoints (No Authentication Required)](#public-endpoints)
2. [User Initialization Endpoints](#user-initialization-endpoints)
3. [Language Management Endpoints](#language-management-endpoints)
4. [Vocabulary Library Endpoints](#vocabulary-library-endpoints)
5. [Memory Bank Endpoints](#memory-bank-endpoints)
6. [Word Search Endpoints](#word-search-endpoints)
7. [AI Features Endpoints](#ai-features-endpoints)
8. [TTS & Translation Endpoints](#tts--translation-endpoints)
9. [Reading Materials Endpoints](#reading-materials-endpoints)

---

## Public Endpoints (No Authentication Required)

### 1. Get Supported Languages
**Endpoint**: `GET /api/dict/v1/system/supported-languages`

**Description**: Get list of supported languages for learning. Called on app startup. Local app should have hardcoded default languages, which will be overridden by API response.

**Authentication**: Not required

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "code": "en",
      "name": "English",
      "native_name": "English",
      "flag_emoji": "🇺🇸",
      "is_available": true
    },
    {
      "code": "zh",
      "name": "Chinese",
      "native_name": "中文",
      "flag_emoji": "🇨🇳",
      "is_available": true
    },
    {
      "code": "fr",
      "name": "French",
      "native_name": "Français",
      "flag_emoji": "🇫🇷",
      "is_available": true
    }
  ]
}
```

**Local Default Languages** (hardcoded in app):
- English (en)
- Chinese (zh)
- French (fr)
- Spanish (es)
- German (de)

### 2. Get Default Recommended Vocabulary Libraries
**Endpoint**: `GET /api/dict/v1/vocabulary/libraries/recommended`

**Description**: Get default recommended vocabulary libraries for new users.

**Authentication**: Not required

**Query Parameters**:
- `language` (optional, string): Filter by language code (default: "en")
- `limit` (optional, int): Number of results (default: 10)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "TOEFL Core Vocabulary",
      "description": "Essential words for TOEFL preparation",
      "word_count": 5000,
      "language": "en",
      "difficulty": "intermediate",
      "category": "academic",
      "image_url": "https://domain.com/static/app_qy_v1/covers/library_00010.png",
      "cover_status": "ready",
      "is_recommended": true
    }
  ]
}
```

### 3. Get All Vocabulary Libraries (Paginated)
**Endpoint**: `GET /api/dict/v1/vocabulary/libraries`

**Description**: Get all vocabulary libraries with pagination support (waterfall/infinite scroll).

**Authentication**: Not required

**Query Parameters**:
- `page` (optional, int): Page number (default: 1)
- `per_page` (optional, int): Items per page (default: 20)
- `language` (optional, string): Filter by language code
- `category` (optional, string): Filter by category
- `difficulty` (optional, string): Filter by difficulty level
- `search` (optional, string): Search query

**Response**:
```json
{
  "success": true,
  "data": {
    "libraries": [
      {
        "id": 1,
        "name": "TOEFL Core Vocabulary",
        "description": "Essential words for TOEFL preparation",
      "word_count": 5000,
      "language": "en",
      "difficulty": "intermediate",
      "category": "academic",
      "image_url": "https://domain.com/static/app_qy_v1/covers/library_00010.png",
      "cover_status": "ready"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 150,
      "last_page": 8,
      "has_more": true
    }
  }
}
```

### 4. Get Default Recommended Daily Reading
**Endpoint**: `GET /api/dict/v1/reading/daily/recommended`

**Description**: Get default recommended daily reading articles.

**Authentication**: Not required

**Query Parameters**:
- `language` (optional, string): Filter by language code (default: "en")
- `limit` (optional, int): Number of results (default: 5)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Daily News: Technology Trends",
      "excerpt": "Latest developments in AI and machine learning...",
      "content": "Full article content...",
      "language": "en",
      "difficulty": "intermediate",
      "word_count": 800,
      "reading_time": 5,
      "image_url": "https://example.com/image.jpg",
      "published_at": "2025-01-15T10:00:00Z",
      "is_recommended": true
    }
  ]
}
```

### 5. Get All Daily Reading (Paginated)
**Endpoint**: `GET /api/dict/v1/reading/daily`

**Description**: Get all daily reading articles with pagination support.

**Authentication**: Not required

**Query Parameters**:
- `page` (optional, int): Page number (default: 1)
- `per_page` (optional, int): Items per page (default: 20)
- `language` (optional, string): Filter by language code
- `difficulty` (optional, string): Filter by difficulty level
- `search` (optional, string): Search query

**Response**:
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": 1,
        "title": "Daily News: Technology Trends",
        "excerpt": "Latest developments...",
        "language": "en",
        "difficulty": "intermediate",
        "word_count": 800,
        "reading_time": 5,
        "image_url": "https://example.com/image.jpg",
        "published_at": "2025-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 200,
      "last_page": 10,
      "has_more": true
    }
  }
}
```

### 6. Get Default Recommended Book Reading List
**Endpoint**: `GET /api/dict/v1/reading/books/recommended`

**Description**: Get default recommended book reading list.

**Authentication**: Not required

**Query Parameters**:
- `language` (optional, string): Filter by language code (default: "en")
- `limit` (optional, int): Number of results (default: 10)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "description": "A classic American novel...",
      "language": "en",
      "difficulty": "advanced",
      "word_count": 50000,
      "chapters": 9,
      "cover_image": "https://example.com/cover.jpg",
      "is_recommended": true
    }
  ]
}
```

### 7. Get All Book Reading List (Paginated)
**Endpoint**: `GET /api/dict/v1/reading/books`

**Description**: Get all books with pagination support.

**Authentication**: Not required

**Query Parameters**:
- `page` (optional, int): Page number (default: 1)
- `per_page` (optional, int): Items per page (default: 20)
- `language` (optional, string): Filter by language code
- `difficulty` (optional, string): Filter by difficulty level
- `search` (optional, string): Search query

**Response**:
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": 1,
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "language": "en",
        "difficulty": "advanced",
        "word_count": 50000,
        "chapters": 9,
        "cover_image": "https://example.com/cover.jpg"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 500,
      "last_page": 25,
      "has_more": true
    }
  }
}
```

### 8. Public Word Lookup
**Endpoint**: `GET /api/words/public/{word}`

**Description**: Public word lookup without authentication. Default language is "en".

**Authentication**: Not required

**Path Parameters**:
- `word` (required, string): Word to lookup

**Query Parameters**:
- `language` (optional, string): Language code (default: "en")

**Response**:
```json
{
  "success": true,
  "data": {
    "word": "hello",
    "language": "en",
    "definitions": [
      {
        "part_of_speech": "interjection",
        "definition": "Used as a greeting",
        "example": "Hello, how are you?"
      }
    ],
    "pronunciation": "/həˈloʊ/",
    "audio_url": "https://example.com/audio/hello.mp3"
  }
}
```

---

## User Initialization Endpoints

### 1. Get User Initialization Status
**Endpoint**: `GET /api/dict/v1/user/initialization-status`

**Description**: Check if user has completed initialization setup.

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": {
    "is_initialized": false,
    "missing_fields": [
      "learning_languages",
      "occupation",
      "daily_words_target",
      "daily_study_time",
      "preferences"
    ],
    "initialization_completed_at": null,
    "learning_languages": [],
    "profile": null
  }
}
```

**Fields Checked**:
- `learning_languages`: Array of language codes (e.g., ["en", "fr"])
- `occupation`: String (e.g., "student", "teacher", "engineer", "other")
- `daily_words_target`: Integer (number of words to learn per day)
- `daily_study_time`: Integer (minutes available for study per day)
- `preferences`: Object containing user preferences (theme, notifications, etc.)

### 2. Update User Initialization Data
**Endpoint**: `POST /api/dict/v1/user/initialize`

**Description**: Submit user initialization data.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "learning_languages": ["en", "fr"],
  "occupation": "student",
  "daily_words_target": 20,
  "daily_study_time": 30,
  "preferences": {
    "theme": "light",
    "notifications_enabled": true,
    "auto_play_audio": true,
    "difficulty_level": "intermediate"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Initialization completed successfully",
  "data": {
    "is_initialized": true,
    "missing_fields": [],
    "initialization_completed_at": "2025-01-15T10:30:00Z",
    "learning_languages": ["en", "fr"],
    "profile": {
      "occupation": "student",
      "daily_words_target": 20,
      "daily_study_time": 30,
      "preferences": {
        "theme": "light",
        "notifications_enabled": true,
        "auto_play_audio": true,
        "difficulty_level": "intermediate",
        "daily_reminder_time": "08:00"
      }
    }
  }
}
```

**Backend Storage Notes**:
- Data persists in `app_qy_v1_user_initializations` (AppQyV1 SQLite connection) with columns for occupation, daily goals, preferences JSON, and completion timestamp.
- `users.learning_languages` (main connection) stores the selected language array; validation enforces AppQyV1 supported language codes.
- Preferences accept `theme`, `notifications_enabled`, `auto_play_audio`, `difficulty_level`, and `daily_reminder_time`, defaulting to server presets when missing.

### 3. Update User Profile (Partial Update)
**Endpoint**: `PATCH /api/dict/v1/user/profile`

**Description**: Update specific user profile fields.

**Authentication**: Required (Bearer token)

**Request Body** (all fields optional):
```json
{
  "occupation": "teacher",
  "daily_words_target": 30,
  "daily_study_time": 45,
  "preferences": {
    "theme": "dark"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": 1,
      "occupation": "teacher",
      "daily_words_target": 30,
      "daily_study_time": 45,
      "preferences": {
        "theme": "dark"
      }
    }
  }
}
```

---

## Language Management Endpoints

### 1. Get User Learning Languages
**Endpoint**: `GET /api/dict/v1/learning/languages`

**Description**: Get user's learning languages.

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": {
    "learning_languages": ["en", "fr"],
    "native_language": "zh"
  }
}
```

### 2. Set User Learning Languages
**Endpoint**: `POST /api/dict/v1/learning/languages`

**Description**: Set/update user learning languages.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "learning_languages": ["en", "fr", "es"],
  "native_language": "zh"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Learning languages updated successfully",
  "data": {
    "learning_languages": ["en", "fr", "es"],
    "native_language": "zh"
  }
}
```

---

## Vocabulary Library Endpoints

### 1. Get User Vocabulary Libraries
**Endpoint**: `GET /api/dict/v1/learning/libraries`

**Description**: Get user's vocabulary libraries.

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "My Custom Library",
      "word_count": 250,
      "language": "en",
      "created_at": "2025-01-10T08:00:00Z"
    }
  ]
}
```

### 2. Select Vocabulary Library
**Endpoint**: `POST /api/dict/v1/learning/libraries/select`

**Description**: Select a vocabulary library for learning.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "library_id": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Library selected successfully"
}
```

### 3. Get Vocabulary Recommendations
**Endpoint**: `GET /api/dict/v1/learning/recommendations`

**Description**: Get recommended vocabulary collections based on learning language.

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "TOEFL Core Vocabulary",
      "word_count": 5000,
      "language": "en"
    }
  ]
}
```

---

## Memory Bank Endpoints

### 1. Get User Memory Bank (Multi-language)
**Endpoint**: `GET /api/dict/v1/memory/bank`

**Description**: Query user's memory bank across all learning languages. Returns words with learning statistics.

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `language` (optional, string): Filter by language code
- `page` (optional, int): Page number (default: 1)
- `per_page` (optional, int): Items per page (default: 50)
- `status` (optional, string): Filter by status (learning, mastered, reviewing)

**Response**:
```json
{
  "success": true,
  "data": {
    "words": [
      {
        "id": 1,
        "word": "hello",
        "language": "en",
        "read_count": 15,
        "review_count": 8,
        "next_review_at": "2025-01-16T10:00:00Z",
        "mastery_level": 0.75,
        "status": "learning",
        "added_at": "2025-01-10T08:00:00Z"
      },
      {
        "id": 2,
        "word": "world",
        "language": "en",
        "read_count": 20,
        "review_count": 12,
        "next_review_at": "2025-01-20T10:00:00Z",
        "mastery_level": 0.90,
        "status": "mastered",
        "added_at": "2025-01-08T08:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 50,
      "total": 150,
      "last_page": 3
    },
    "statistics": {
      "total_words": 150,
      "learning_words": 80,
      "mastered_words": 60,
      "reviewing_words": 10
    }
  }
}
```

### 2. Add Vocabulary Library to Memory Bank
**Endpoint**: `POST /api/dict/v1/memory/bank/library`

**Description**: Add all words from a vocabulary library to user's memory bank. Words are added inline to the memory bank database.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "library_id": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Library added to memory bank successfully",
  "data": {
    "words_added": 5000,
    "library_id": 1
  }
}
```

### 3. Remove Vocabulary Library from Memory Bank
**Endpoint**: `DELETE /api/dict/v1/memory/bank/library/{library_id}`

**Description**: Remove all words from a vocabulary library from user's memory bank.

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `library_id` (required, int): Library ID to remove

**Response**:
```json
{
  "success": true,
  "message": "Library removed from memory bank successfully",
  "data": {
    "words_removed": 5000,
    "library_id": 1
  }
}
```

### 4. Upload File to Memory Bank
**Endpoint**: `POST /api/dict/v1/memory/bank/upload-file`

**Description**: Upload a file (PDF, DOCX, TXT, etc.) and extract words to add to memory bank. Extracted words are also added to the main vocabulary database.

**Authentication**: Required (Bearer token)

**Request**: Multipart form data
- `file` (required, file): File to upload
- `language` (optional, string): Language code (default: "en")
- `extract_mode` (optional, string): Extraction mode (default: "auto")

**Response**:
```json
{
  "success": true,
  "message": "File processed and words added to memory bank",
  "data": {
    "words_extracted": 1200,
    "words_added": 800,
    "words_skipped": 400,
    "file_id": "file_123456",
    "processing_time": 5.2
  }
}
```

### 5. Upload Text to Memory Bank
**Endpoint**: `POST /api/dict/v1/memory/bank/upload-text`

**Description**: Upload text content and extract words to add to memory bank. Extracted words are also added to the main vocabulary database.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "text": "The quick brown fox jumps over the lazy dog...",
  "language": "en",
  "extract_mode": "auto"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Text processed and words added to memory bank",
  "data": {
    "words_extracted": 150,
    "words_added": 120,
    "words_skipped": 30
  }
}
```

### 6. Set Memory Bank Status
**Endpoint**: `PATCH /api/dict/v1/memory/bank/status`

**Description**: Set status for the entire memory bank or filter by language.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "status": "active",
  "language": "en"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Memory bank status updated successfully"
}
```

### 7. Set Word Status in Memory Bank
**Endpoint**: `PATCH /api/dict/v1/memory/bank/word/{word_id}/status`

**Description**: Set status for a specific word in memory bank.

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `word_id` (required, int): Word ID in memory bank

**Request Body**:
```json
{
  "status": "mastered",
  "mastery_level": 1.0,
  "next_review_at": "2025-02-01T10:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Word status updated successfully",
  "data": {
    "word_id": 1,
    "status": "mastered",
    "mastery_level": 1.0
  }
}
```

---

## Word Search Endpoints

### 1. Enhanced Word Query
**Endpoint**: `GET /api/dict/v1/word/{word}/enhanced`

**Description**: Enhanced word query with full data including definitions, examples, audio, etc.

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `word` (required, string): Word to query

**Query Parameters**:
- `language` (optional, string): Language code (default: "en")

**Response**:
```json
{
  "success": true,
  "data": {
    "word": "hello",
    "language": "en",
    "definitions": [
      {
        "part_of_speech": "interjection",
        "definition": "Used as a greeting",
        "example": "Hello, how are you?",
        "translation": "你好"
      }
    ],
    "pronunciation": "/həˈloʊ/",
    "audio_url": "https://example.com/audio/hello.mp3",
    "etymology": "From Old English hælan",
    "synonyms": ["hi", "greetings"],
    "antonyms": ["goodbye"]
  }
}
```

---

## AI Features Endpoints

### 1. Get AI Usage Limit
**Endpoint**: `GET /api/app_qy_v1/ai/usage-limit`

**Description**: Get AI usage limit for current user. Unauthenticated users have 10 uses per day.

**Authentication**: Optional (if authenticated, returns user-specific limit)

**Response** (Unauthenticated):
```json
{
  "success": true,
  "data": {
    "daily_limit": 10,
    "used_today": 3,
    "remaining": 7,
    "reset_at": "2025-01-16T00:00:00Z",
    "is_authenticated": false
  }
}
```

**Response** (Authenticated):
```json
{
  "success": true,
  "data": {
    "daily_limit": 100,
    "used_today": 15,
    "remaining": 85,
    "reset_at": "2025-01-16T00:00:00Z",
    "is_authenticated": true
  }
}
```

### 2. AI Word Explanation
**Endpoint**: `POST /api/app_qy_v1/ai/word-explanation`

**Description**: Get AI-powered word explanation and usage examples.

**Authentication**: Optional (counts against daily limit if not authenticated)

**Request Body**:
```json
{
  "word": "hello",
  "language": "en",
  "context": "I said hello to my friend"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "word": "hello",
    "explanation": "A greeting used when meeting someone...",
    "usage_examples": [
      "Hello, how are you?",
      "Say hello to your mother for me"
    ],
    "usage_remaining": 7
  }
}
```

### 3. AI Learning Assistant
**Endpoint**: `POST /api/app_qy_v1/ai/learning-assistant`

**Description**: AI learning assistant for answering questions and providing learning guidance.

**Authentication**: Optional (counts against daily limit if not authenticated)

**Request Body**:
```json
{
  "question": "What's the difference between 'affect' and 'effect'?",
  "context": "learning_english"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "answer": "Affect is a verb meaning to influence, while effect is a noun meaning a result...",
    "examples": [
      "The weather affects my mood (verb)",
      "The effect of the weather is noticeable (noun)"
    ],
    "usage_remaining": 6
  }
}
```

---

## TTS & Translation Endpoints

### 1. Get TTS Voices
**Endpoint**: `GET /api/app_qy_v1/ai_tools/tts/voices`

**Description**: Get available TTS voices for pronunciation.

**Authentication**: Not required

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "voice_id": "en-US-Neural2-A",
      "name": "English (US) - Female",
      "language": "en",
      "gender": "female"
    }
  ]
}
```

### 2. Generate TTS Audio
**Endpoint**: `POST /api/app_qy_v1/ai_tools/tts/generate`

**Description**: Generate TTS audio for a word or text. Note: This is requested separately from memory bank data to avoid loading audio for thousands of words.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "text": "hello",
  "language": "en",
  "voice": "en-US-Neural2-A",
  "speed": 1.0
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "audio_url": "https://example.com/audio/hello_en.mp3",
    "duration": 0.5,
    "file_size": 10240
  }
}
```

### 3. Batch Generate TTS Audio
**Endpoint**: `POST /api/app_qy_v1/ai_tools/tts/batch-generate`

**Description**: Generate TTS audio for multiple words/texts.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "texts": ["hello", "world", "goodbye"],
  "language": "en",
  "voice": "en-US-Neural2-A"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "audio_files": [
      {
        "text": "hello",
        "audio_url": "https://example.com/audio/hello_en.mp3"
      },
      {
        "text": "world",
        "audio_url": "https://example.com/audio/world_en.mp3"
      }
    ]
  }
}
```

### 4. Translate Text
**Endpoint**: `POST /api/app_qy_v1/ai_tools/translation/translate`

**Description**: Translate text. Note: This is requested separately from memory bank data to avoid loading translations for thousands of words.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "text": "hello",
  "source_lang": "en",
  "target_lang": "zh"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "original_text": "hello",
    "translated_text": "你好",
    "source_lang": "en",
    "target_lang": "zh"
  }
}
```

### 5. Batch Translate
**Endpoint**: `POST /api/app_qy_v1/ai_tools/translation/batch`

**Description**: Translate multiple texts.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "texts": ["hello", "world", "goodbye"],
  "source_lang": "en",
  "target_lang": "zh"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "translations": [
      {
        "original": "hello",
        "translated": "你好"
      },
      {
        "original": "world",
        "translated": "世界"
      }
    ]
  }
}
```

---

## Reading Materials Endpoints

### 1. Get Reading Article Details
**Endpoint**: `GET /api/dict/v1/reading/article/{article_id}`

**Description**: Get full content of a reading article.

**Authentication**: Not required

**Path Parameters**:
- `article_id` (required, int): Article ID

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Daily News: Technology Trends",
    "content": "Full article content...",
    "language": "en",
    "difficulty": "intermediate",
    "word_count": 800,
    "reading_time": 5,
    "image_url": "https://example.com/image.jpg",
    "published_at": "2025-01-15T10:00:00Z",
    "vocabulary": [
      {
        "word": "technology",
        "definition": "The application of scientific knowledge",
        "frequency": 5
      }
    ]
  }
}
```

### 2. Get Book Details
**Endpoint**: `GET /api/dict/v1/reading/book/{book_id}`

**Description**: Get book details including chapters.

**Authentication**: Not required

**Path Parameters**:
- `book_id` (required, int): Book ID

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "description": "A classic American novel...",
    "language": "en",
    "difficulty": "advanced",
    "word_count": 50000,
    "chapters": [
      {
        "id": 1,
        "title": "Chapter 1",
        "word_count": 5000,
        "reading_time": 30
      }
    ],
    "cover_image": "https://example.com/cover.jpg"
  }
}
```

### 3. Get Book Chapter Content
**Endpoint**: `GET /api/dict/v1/reading/book/{book_id}/chapter/{chapter_id}`

**Description**: Get content of a specific book chapter.

**Authentication**: Not required

**Path Parameters**:
- `book_id` (required, int): Book ID
- `chapter_id` (required, int): Chapter ID

**Response**:
```json
{
  "success": true,
  "data": {
    "chapter_id": 1,
    "title": "Chapter 1",
    "content": "Full chapter content...",
    "word_count": 5000,
    "reading_time": 30,
    "vocabulary": [
      {
        "word": "gatsby",
        "definition": "Character name",
        "frequency": 20
      }
    ]
  }
}
```
