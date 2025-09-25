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

# Laravel Dictionary System Migration Requirements

## Project Overview

This document outlines the requirements for migrating selected functionality from the DevOps Node.js application to a Laravel-based dictionary system. The Laravel system will handle word database management, phonetic audio files, and image assets through an external storage directory approach.

## Core Requirements Summary

### 1. External Storage Directory Management
Laravel will use an external directory (outside the Laravel project) to store:
- Word database files
- Phonetic audio files (MP3/WAV)
- Image files and assets
- Cache and temporary files

### 2. Remote Database Detection and Download Prompt
- Laravel will detect if the required database exists in the external directory
- If database is missing, API requests will return download instructions
- Instructions will guide users to download from Google Drive or similar cloud storage
- System will not function until database is properly installed

### 3. Legacy Database Migration and Conversion
- When legacy database is detected, Laravel will convert it to new schema format
- Migration will follow data structure standards from the DevOps app
- Conversion process handles schema updates, data transformation, and indexing

### 4. One-Time Processing with File Markers
- All initialization processes (download, migration, conversion) occur only once
- File markers prevent repeated processing on subsequent API requests
- Markers track completion status of each initialization phase
- Once markers are set, system bypasses initialization and serves data directly

### 5. API-Driven Initialization
- All setup processes trigger during API requests (not background jobs)
- First API request may have extended response time due to initialization
- Subsequent requests operate at normal speed after initialization completion
- System provides progress feedback during lengthy operations

## Functional Requirements

### External Directory Structure
```
external_data/
├── databases/
│   ├── word_main.db (SQLite main database)
│   ├── cache_translate.db (Translation cache)
│   └── legacy_data.db (Original database for migration)
├── audio/
│   ├── word_sounds/ (Word pronunciation files)
│   ├── word_subtitles/ (Subtitle files)
│   ├── sentence_sounds/ (Sentence audio)
│   └── sentence_subtitles/ (Sentence subtitles)
├── images/
│   └── word_images/ (Associated images)
├── cache/
│   └── temp/ (Temporary processing files)
└── markers/
    ├── database_ready.flag
    ├── migration_complete.flag
    └── initialization_done.flag
```

### API Behavior Flow
1. **API Request Received**
2. **Check Initialization Markers**
   - If all markers exist → Process request normally
   - If markers missing → Begin initialization sequence
3. **Initialization Sequence** (if needed):
   - Check database existence
   - Prompt download if missing
   - Detect legacy database
   - Perform migration if needed
   - Set completion markers
4. **Normal Operation**: Query database and return word data

## Reference Implementation Files

The following DevOps application files should be referenced for implementation:

### Database Schema and Structure
- **Reference File**: `provider/schemas/word_main_schema.js`
- **Purpose**: Define Laravel migration structure based on Node.js schema
- **Key Elements**: Table definitions, indexes, relationships

### Legacy Database Handling
- **Reference File**: `server_controller/server_init_olddb.js`
- **Purpose**: Understand legacy database import logic
- **Key Elements**: File detection, download handling, import process

### Database Migration Logic
- **Reference File**: `server_controller/server_migrate.js`
- **Purpose**: Migration and conversion algorithms
- **Key Elements**: Data transformation, schema updates, validation

### Directory Management
- **Reference File**: `provider/baseDir/BaseDirProvider.js`
- **Purpose**: External directory path management
- **Key Elements**: Path resolution, directory creation, validation

### File Marker System
- **Reference File**: `basetool/token_file.js`
- **Purpose**: File marker creation and validation
- **Key Elements**: Flag file management, completion tracking

### Database Operations
- **Reference File**: `provider/DataProvider.js`
- **Purpose**: Database connection and query patterns
- **Key Elements**: Connection management, query optimization

### Configuration Management
- **Reference File**: `config/index.js`
- **Purpose**: Configuration constants and paths
- **Key Elements**: Directory paths, database URLs, file naming conventions

## Implementation Instructions for AI Developers

### Phase 1: External Directory Setup
**Reference Files**: `provider/baseDir/BaseDirProvider.js`, `config/index.js`

1. Create Laravel service class for external directory management
2. Implement path resolution similar to BaseDirProvider logic
3. Add directory validation and creation methods
4. Configure external paths in Laravel config files

### Phase 2: Database Detection System
**Reference Files**: `server_controller/server_init_olddb.js`, `basetool/reader.js`

1. Implement database existence checking
2. Create API response structure for download instructions
3. Add Google Drive or cloud storage integration hints
4. Handle missing database scenarios gracefully

### Phase 3: Legacy Database Migration
**Reference Files**: `server_controller/server_migrate.js`, `provider/schemas/`

1. Read original migration logic from `server_migrate.js`
2. Convert Node.js Sequelize schemas to Laravel migrations
3. Implement data transformation algorithms
4. Add validation and error handling for conversion process

### Phase 4: File Marker Implementation
**Reference Files**: `basetool/token_file.js`

1. Create marker file management system
2. Implement completion tracking similar to token_file.js
3. Add marker validation before API processing
4. Ensure atomic operations for marker creation

### Phase 5: API Integration
**Reference Files**: `http_controller/word_query.js`, `middware/middb/wordQuery.js`

1. Study existing API patterns from word_query.js
2. Implement Laravel API controllers with initialization checks
3. Add progress feedback for long-running operations
4. Ensure proper error handling and user feedback

## Technical Specifications

### Database Requirements
- **Primary**: SQLite for main word database
- **Cache**: SQLite for translation caching
- **Migration**: Support for legacy database formats
- **Performance**: Indexed queries for fast word lookups

### File System Requirements
- **External Storage**: Outside Laravel project directory
- **Permissions**: Read/write access for Laravel application
- **Structure**: Organized by file type (audio, images, databases)
- **Cleanup**: Temporary file management and cleanup

### API Response Format
```json
{
  "status": "initializing|ready|error",
  "message": "Status description",
  "data": {
    "word": "example",
    "definition": "...",
    "pronunciation": "audio_url",
    "image": "image_url"
  },
  "initialization": {
    "database_ready": true,
    "migration_complete": true,
    "progress": 100
  }
}
```

### Performance Considerations
- First API request may take 30-60 seconds for initialization
- Subsequent requests should respond within 100ms
- Large database migrations may require progress tracking
- Memory usage optimization for large database operations

## Success Criteria

1. **External Directory Integration**: Laravel successfully manages external data directory
2. **Download Detection**: System properly detects missing databases and provides clear instructions
3. **Legacy Migration**: Old database formats convert successfully to new schema
4. **Marker System**: File markers prevent duplicate processing and track completion status
5. **API Performance**: Normal operations execute quickly after initialization
6. **Error Handling**: Graceful handling of missing files, failed downloads, and conversion errors

## Next Development Phases

After completing the basic database and initialization system, subsequent development will include:
- Word query API endpoints
- Audio file serving and streaming
- Image asset management
- Translation caching system
- Search and filtering capabilities

This document serves as the foundation for Phase 1 implementation. Additional requirements documents will follow for each subsequent development phase.