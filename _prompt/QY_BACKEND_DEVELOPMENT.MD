# QY Backend Development

## Overview

Check if backend QY APP v1 has a method to submit an article, then automatically transcribe to language, and extract words (words are parsed from article by spaces, `-`, `_`, `,`, `?`, etc.). Currently first support English, then return article, sentences corresponding to voice, word groups. Note: Need to link with heartbeat center, because voice will not be generated immediately, so need to use task system to continuously generate language.

## Task System Integration

**File**: `AppQyV1TTSGenerationTask.php`

Integrate into it. Each task added will immediately enter processing. Process only one task at a time. Create data table, use article as daily reading. At the same time, words will link with word library. Simultaneously extend article types, currently first support English.

## Article to Word Group Method

In old code `__misc__\_pycore`, find the method for article to word group conversion, then first extend public method for PHP.

## Current Status Analysis

According to code check, AppQyV1 backend currently does not have complete article submission and voice generation functionality, but already has some infrastructure that can support this requirement.

### ✅ Existing Components

1. **TTS Voice Generation Service** (`app/Services/EdgeTTS/EdgeTTSService.php`)
   - Supports 82 languages
   - Single text generation: `generate()`
   - Batch generation: `batchGenerate()`
   - Supported types: sentence, word, letter

2. **Cache Manager** (`app/Services/EdgeTTS/TTSCacheManager.php`)
   - File-based JSON cache
   - Store by language and text type in separate files
   - Automatic cleanup mechanism (max 1000 entries/file)

3. **Timer Task System** (`app/Services/TimerTasks/AppQyV1TTSGenerationTask.php`)
   - Execute every 60 seconds
   - Automatically generate voice for words in dictionary
   - Support retry mechanism (max 3 times)

4. **Global Task System** (`app/Http/Controllers/TaskController.php`)
   - Task creation: `POST /api/task/create`
   - Task status query: `GET /api/task/{taskId}/status`
   - Support multiple execution types: local_timer, remote_compute, remote_io, etc.
   - Worker heartbeat mechanism: `POST /api/worker/heartbeat`

5. **Existing Routes** (`routes/AppQyV1Router/AppQyV1AITools.php`)
   - `POST /api/app_qy_v1/ai_tools/tts/generate`
   - `POST /api/app_qy_v1/ai_tools/tts/batch-generate`
   - `GET /api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{filename}`

### ❌ Missing Features

1. Article submission interface - does not exist
2. Article parsing to sentences - does not exist
3. Word extraction logic (parse by spaces, `-`, `_`, `,`, `?`) - does not exist
4. Article-level asynchronous tasks - does not exist
5. Frontend polling mechanism - does not exist

## Implementation Requirements

### Frontend Submission Flow

After frontend submits, get a task ID and result. If not completed, continuously query and update data. Note: Use global cache.

### Task Processing

- Each task added will immediately enter processing
- Process only one task at a time
- Create data table
- Use article as daily reading
- Words will link with word library
- Extend article types (currently first support English)

