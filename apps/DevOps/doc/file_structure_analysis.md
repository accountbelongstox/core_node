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

# DevOps App File Structure Analysis

## Total Files: 84

### Directory Structure Overview

```
apps/DevOps/
├── .env                                    # Environment configuration
├── .env-example                           # Environment template  
├── main.js                                # App entry point
├── config/index.js                        # App configuration
├── readme.md                              # App documentation
├── Dockerfile                             # Docker configuration
├── entry.sh                              # Shell entry script
├── basetool/                              # Base utility tools (23 files)
│   ├── db-tool/                          # Database tools (5 files)
│   ├── ptools/                           # Processing tools (5 files) 
│   ├── threads/                          # Thread management (1 file)
│   ├── voice_tool/                       # Voice processing (5 files)
│   └── other utility files (7 files)
├── http/                                  # HTTP service layer (2 files)
├── http_controller/                       # HTTP controllers (9 files)
├── libs/                                  # Library functions (4 files)
├── middware/                              # Middleware layer (13 files)
│   └── middb/                            # Database middleware (7 files)
├── provider/                              # Data providers (19 files)
│   ├── baseDir/                          # Directory providers (2 files)
│   ├── constants/                        # Constants (4 files)
│   ├── mate_data/                        # Metadata (1 file)
│   ├── schemas/                          # Database schemas (4 files)
│   └── types/                            # Type definitions (3 files)
├── server_controller/                     # Server controllers (11 files)
├── template/                              # Frontend templates (6 files)
│   └── static/                           # Static assets (4 files)
└── devdoc/                               # Development documentation (1 file)
```

## File List by Category

### Core Files (4)
1. main.js - Main entry point
2. config/index.js - Configuration
3. .env - Environment variables
4. .env-example - Environment template

### Base Tools (23 files)
1. basetool/folder.js - Folder operations
2. basetool/reader.js - File reading utilities
3. basetool/token_file.js - Token file handling
4. basetool/thredShareByVoiceFile.js - Voice file threading
5. basetool/thredShareByVoiceMem.js - Voice memory threading

#### Database Tools (5)
6. basetool/db-tool/cache_coordinator.js - Cache coordination
7. basetool/db-tool/dbitem_align.js - Database item alignment
8. basetool/db-tool/static_item_wrap.js - Static item wrapper
9. basetool/db-tool/trans_item_tool.js - Translation item tools
10. basetool/db-tool/trans_item_wrap.js - Translation item wrapper

#### Processing Tools (5)
11. basetool/ptools/edge-tts-node.js - Edge TTS Node integration
12. basetool/ptools/edgeTTSFinder.js - Edge TTS finder
13. basetool/ptools/edge_generate.py - Edge generation Python script
14. basetool/ptools/edge_tts_py.js - Edge TTS Python bridge
15. basetool/ptools/translation_processor.js - Translation processor

#### Voice Tools (5)
16. basetool/voice_tool/check_voice.js - Voice validation
17. basetool/voice_tool/search_voice.js - Voice search
18. basetool/voice_tool/voice_name_gen.js - Voice name generator
19. basetool/voice_tool/voice_oldname_gen.js - Voice old name generator
20. basetool/voice_tool/voice_tool.js - Main voice tool

#### Threading (1)
21. basetool/threads/voice_generate.js - Voice generation threading

### HTTP Layer (11 files)
22. http/index.js - HTTP server initialization
23. http/router.js - HTTP routing

#### HTTP Controllers (9)
24. http_controller/code_executor.js - Code execution controller
25. http_controller/dev_environments.js - Development environment controller
26. http_controller/dev_tools.js - Development tools controller
27. http_controller/dict_client.js - Dictionary client controller
28. http_controller/dict_server.js - Dictionary server controller
29. http_controller/dict_simple_client.js - Simple dictionary client
30. http_controller/sync_audio.js - Audio synchronization controller
31. http_controller/system.js - System controller
32. http_controller/voice_status.js - Voice status controller
33. http_controller/word_query.js - Word query controller

### Libraries (4 files)
34. libs/add_website_caddy.js - Caddy website addition
35. libs/analyze_unique_line.js - Line analysis utility
36. libs/main_init.js - Main initialization
37. libs/start_voice_gen_thread.js - Voice generation thread starter

### Middleware (13 files)
38. middware/cacheMainMid.js - Main cache middleware
39. middware/dbmid_init.js - Database middleware initialization

#### Database Middleware (7)
40. middware/middb/cacheDbInputDone.js - Cache database input completion
41. middware/middb/cacheTransDbMid.js - Cache translation database middleware
42. middware/middb/db_content_check.js - Database content validation
43. middware/middb/db_delete.js - Database deletion operations
44. middware/middb/oldDBMid.js - Old database middleware
45. middware/middb/wordInsert.js - Word insertion operations
46. middware/middb/wordQuery.js - Word query operations
47. middware/middb/wordUpdate.js - Word update operations

### Providers (19 files)
48. provider/DataProvider.js - Main data provider
49. provider/ThreadProvider.js - Thread provider
50. provider/TTSModelProvider.js - TTS model provider
51. provider/WatcherProvider.js - File watcher provider

#### Base Directory Providers (2)
52. provider/baseDir/BaseDirProvider.js - Base directory provider
53. provider/baseDir/OldDirProvider.js - Old directory provider

#### Constants (4)
54. provider/constants/StaticData.js - Static data constants
55. provider/constants/WordCounter.js - Word counter constants
56. provider/constants/WordDynamic.js - Dynamic word constants
57. provider/constants/WordDynamicData.js - Dynamic word data constants

#### Metadata (1)
58. provider/mate_data/soundQuality.js - Sound quality metadata

#### Schemas (4)
59. provider/schemas/cache_translate_schema.js - Cache translation schema
60. provider/schemas/index.js - Schema index
61. provider/schemas/old_tradata_schema.js - Old translation data schema
62. provider/schemas/word_main_schema.js - Main word schema

#### Types (3)
63. provider/types/data_table_names.js - Database table names
64. provider/types/data_types.js - Data type definitions
65. provider/types/default_value.js - Default value definitions

### Server Controllers (11 files)
66. server_controller/ClientMaster.js - Client master controller
67. server_controller/client_start.js - Client startup
68. server_controller/not_client.js - Non-client handler
69. server_controller/server_historytrans.js - History translation server
70. server_controller/server_init_image_input.js - Image input initialization
71. server_controller/server_init_olddb.js - Old database initialization
72. server_controller/server_init_valid.js - Validation initialization
73. server_controller/server_init_words.js - Word initialization
74. server_controller/server_migrate.js - Server migration
75. server_controller/server_static_load.js - Static loading
76. server_controller/server_test.js - Server testing
77. server_controller/server_voice_load.js - Voice loading

### Templates (6 files)
78. template/index.html - Main HTML template

#### Static Assets (4)
79. template/static/scripts/alpinejs@3.14.9.js - Alpine.js library
80. template/static/scripts/data_example.json - Example data
81. template/static/scripts/voice_status.js - Voice status script
82. template/static/styles/voice_static_panel.css - Voice panel styles

### Documentation (2 files)
83. devdoc/caddyinfo.txt - Caddy configuration info
84. readme.md - Main documentation

### Infrastructure (2 files)
- Dockerfile - Docker container configuration
- entry.sh - Shell entry script

## Analysis Summary

This DevOps app contains 84 files organized into 8 main categories:
- **Core Infrastructure**: Entry points and configuration
- **Base Tools**: Utility functions for database, voice processing, and file operations
- **HTTP Layer**: Web server and API controllers
- **Libraries**: Shared functionality and initialization
- **Middleware**: Request processing and database operations
- **Providers**: Data access and service providers
- **Server Controllers**: Backend business logic
- **Templates**: Frontend presentation layer

The app appears to be a comprehensive DevOps platform with features including:
- Voice processing and TTS (Text-to-Speech) capabilities
- Dictionary/translation services
- Database management with multiple schemas
- Web-based interface with Alpine.js frontend
- Docker containerization support
- Development environment management