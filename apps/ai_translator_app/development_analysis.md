<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# AI Translator App Development Analysis

## Project Requirements Analysis
- Monitor D:\programing\core_node_archive directory for .txt/.md files
- Automatic translation using OpenRouter API with free models
- Web interface for monitoring and control
- Real-time translation status and progress tracking

## ncore Functionality Assessment

### Available in ncore/global_vars:
- ✅ APP_RUNTIME_CACHE_DIR - For translation cache
- ✅ APP_RUNTIME_TMP_DIR - For temporary files
- ✅ APP_LARGE_FILES_CACHE_DIR - For large file storage
- ✅ Global configuration system via #@gconfig

### Available in ncore/foundation:
- ✅ #@logger - Logging functionality
- ✅ #@freader/#@fwriter - File I/O operations
- ✅ #@ftools - File utilities
- ✅ #@btools - Foundation utilities

### Available in ncore/utils:
- ✅ ai_translator - Complete translation utility (newly created)
- ✅ express - Web server functionality
- ✅ db_tool - Database operations

## App Implementation Strategy

### Functions to implement in APP:
1. **App Configuration** (config/index.js)
   - OpenRouter API key configuration
   - Watch directory configuration
   - Translation preferences

2. **Translation Service** (service/translation_service.js)
   - Interface to ncore/utils/ai_translator
   - Service orchestration and lifecycle management

3. **Web Interface** (http/index.js)
   - Real-time status dashboard
   - Translation progress monitoring
   - Configuration management

4. **Controller Logic** (controller/translation_controller.js)
   - Business logic for translation management
   - Status reporting and control operations

### Functions to call from ncore/utils:
1. **ai_translator utility**
   - startTranslation() - Main translation service
   - getStatus() - Service status
   - stopTranslation() - Service shutdown

2. **express utility**
   - Web server setup
   - Route management
   - Static file serving

3. **db_tool utility** (if needed)
   - Translation history storage
   - Progress tracking

### No extensions needed to ncore:
- All required functionality available in existing ncore utilities
- AI translator utility provides complete translation capabilities
- Express utility provides web interface needs

## File Structure Recommendations

```
apps/ai_translator_app/
├── main.js                    # Entry point with start() method
├── config/index.js           # App configuration
├── controller/
│   └── translation_controller.js  # Business logic
├── service/
│   └── translation_service.js     # Service layer
├── http/
│   └── index.js              # Web server setup
├── routes/
│   ├── api.js                # API routes
│   └── web.js                # Web interface routes
├── middleware/
│   └── auth.js               # Optional authentication
└── templates/
    ├── dashboard.html        # Main dashboard
    └── status.html           # Status page
```

## Dependencies Assessment
- No additional third-party packages required
- All functionality available through ncore utilities
- Uses existing ncore/utils/ai_translator for translation
- Uses existing ncore/utils/express for web interface