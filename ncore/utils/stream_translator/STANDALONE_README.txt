Stream Translator - Standalone Plugin
======================================

IMPORTANT: This plugin is FULLY STANDALONE and can be used independently
without any ncore dependencies.

INSTALLATION
------------

1. Standalone Usage (outside ncore):
   - Copy the entire stream_translator directory to your project
   - No additional npm packages required (uses only Node.js built-ins)
   - Configure via environment variables or config.json

2. As ncore Module (inside ncore framework):
   - Already integrated at ncore/utils/stream_translator/
   - Can be required via: require('#@ncore/utils/stream_translator')
   - Same configuration methods work

ZERO DEPENDENCIES
-----------------
This plugin has ZERO npm dependencies. It uses only Node.js built-in modules:
- https (for Azure API calls)
- events (for EventEmitter)
- stream (for streaming)
- fs, path (for config loading)

CONFIGURATION METHODS
---------------------

Priority Order (first found wins):
1. Environment variables (AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION)
2. ./stream_translator.config.json (current working directory)
3. ./config/stream_translator.json (config subdirectory)
4. ./config.json (plugin directory)

Quick Setup with Environment Variables:
----------------------------------------
Windows:
  $env:AZURE_TRANSLATOR_KEY="your-key"
  $env:AZURE_TRANSLATOR_REGION="global"

Linux/Mac:
  export AZURE_TRANSLATOR_KEY="your-key"
  export AZURE_TRANSLATOR_REGION="global"

Quick Setup with Config File:
------------------------------
1. Copy config.example.json to config.json
2. Edit config.json and set your Azure API key
3. Save and run

RUNNING EXAMPLES
----------------

Standalone mode:
  cd ncore/utils/stream_translator
  node example.js

With npm scripts:
  npm test              # Run basic examples
  npm run test:stream   # Run stream examples
  npm run config:check  # Check configuration
  npm run config:help   # Show setup instructions

USAGE EXAMPLES
--------------

Standalone (local require):
```javascript
const translator = require('./index.js');

translator.appendData('session1', 'Hello world\n');
translator.flushSession('session1');

setTimeout(() => {
  const result = translator.getFullText('session1');
  console.log(result);
}, 2000);
```

As ncore module:
```javascript
const translator = require('#@ncore/utils/stream_translator');

// Same API as above
```

As npm module (if published):
```javascript
const translator = require('stream-translator');

// Same API as above
```

FILE STRUCTURE
--------------
stream_translator/
├── config/
│   └── index.js                    # Config loader (standalone)
├── libs/
│   ├── Logger.js                   # Standalone logger (no dependencies)
│   ├── CodeDetector.js             # Code/comment detection
│   ├── SentenceBuffer.js           # Sentence buffering
│   ├── TranslatorAPI.js            # Azure API client
│   ├── StreamTranslatorManager.js  # Main manager
│   └── ConfigHelper.js             # Config utilities
├── index.js                        # Main entry point
├── example.js                      # Basic examples
├── test_stream.js                  # Advanced stream examples
├── package.json                    # NPM metadata
├── config.example.json             # Example configuration
├── .gitignore                      # Git ignore rules
├── STANDALONE_README.txt           # This file
├── QUICK_START.txt                 # Quick setup guide
├── SETUP_AZURE.txt                 # Azure setup guide
└── README_USAGE.txt                # Full API documentation

FEATURES
--------
✓ Zero npm dependencies
✓ Standalone - works without ncore
✓ Also works as ncore module
✓ Smart code and comment detection
✓ Real-time streaming translation
✓ Session management
✓ Azure Translator API with retry and caching
✓ Language detection support
✓ Configurable via environment or JSON

COPYING TO OTHER PROJECTS
--------------------------
To use this in a non-ncore project:

1. Copy the entire stream_translator folder
2. Remove the ncore-specific header comments if desired
3. Configure via environment variables or config.json
4. Require as: require('./stream_translator')

Example:
  my-project/
  ├── stream_translator/      # Copied from ncore/utils/
  ├── my-app.js
  └── package.json

  In my-app.js:
  const translator = require('./stream_translator');

ENVIRONMENT VARIABLES
---------------------
All configuration can be done via environment variables:

Required:
- AZURE_TRANSLATOR_KEY          Your Azure API key

Optional:
- AZURE_TRANSLATOR_ENDPOINT     (default: api.cognitive.microsofttranslator.com)
- AZURE_TRANSLATOR_REGION       (default: global)
- AZURE_SUBSCRIPTION_ID         For informational purposes
- AZURE_RESOURCE_GROUP          For informational purposes
- DEBUG                         Set to 'true' for debug logging

NPM SCRIPTS
-----------
npm test              # Run examples
npm run test:stream   # Run stream tests
npm run config:check  # Validate configuration
npm run config:help   # Show setup guide
npm run config:summary # Show current config

TESTING WITHOUT AZURE
----------------------
To test the plugin structure without Azure credentials:
1. Code detection and buffering work without API
2. Only actual translation requires Azure credentials
3. Configure mock mode by setting apiKey to 'mock' (returns original text)

LOGGING
-------
The plugin includes a standalone logger that doesn't depend on any
external logging framework.

Enable debug logging:
  Windows: $env:DEBUG="true"
  Linux/Mac: export DEBUG=true

Or create a Logger instance with custom settings:
  const { Logger } = require('./libs/Logger.js');
  const logger = new Logger({ enableDebug: true });

PERFORMANCE
-----------
- Translation results are cached in memory
- Configurable cache size (default: 10000 entries)
- Automatic retry on API failures (3 retries by default)
- Timeout protection (10 seconds default)
- Session-based memory management

SECURITY
--------
- API keys are loaded from environment or config file
- Keys are masked in logs
- No API keys are ever logged in clear text
- Config files containing keys should be .gitignored

SUPPORT
-------
- See QUICK_START.txt for step-by-step setup
- See SETUP_AZURE.txt for Azure configuration
- See README_USAGE.txt for full API documentation
- Check config with: npm run config:check

LICENSE
-------
Part of the core_node project
