Stream Translator - Real-time Translation Plugin for Node.js
=============================================================

OVERVIEW
--------
A powerful stream-based translation plugin that intelligently translates text
while preserving code structure, comments, and formatting. Perfect for translating
documentation, code comments, and mixed content in real-time.

FEATURES
--------
✓ Stream-based processing - handles data as it arrives
✓ Session management - multiple concurrent translation sessions
✓ Smart code detection - identifies code blocks and programming languages
✓ Comment detection - recognizes single-line and multi-line comments
✓ Context-aware translation - only translates appropriate content
✓ Azure Translator API integration with auto-retry and caching
✓ Language detection support
✓ Real-time streaming output
✓ Translation caching for performance
✓ Batch processing support

QUICK START
-----------

1. Configure Azure Translator (see SETUP_AZURE.txt for detailed instructions)

   Set environment variables:

   Windows:
   $env:AZURE_TRANSLATOR_KEY="your-key-here"
   $env:AZURE_TRANSLATOR_REGION="global"

   Linux/Mac:
   export AZURE_TRANSLATOR_KEY="your-key-here"
   export AZURE_TRANSLATOR_REGION="global"

2. Basic Usage Example:

   const translator = require('#@ncore/utils/stream_translator');

   // Check configuration
   if (!translator.checkConfig()) {
       translator.printSetupInstructions();
       process.exit(1);
   }

   // Create a session
   const sessionId = 'my-translation-session';

   // Listen for translations
   translator.onTranslationReady((data) => {
       console.log('Translated:', data.id, data.index);
   });

   // Stream data in
   translator.appendData(sessionId, 'Hello world\n');
   translator.appendData(sessionId, 'This is a test\n');
   translator.appendData(sessionId, '# This is a comment\n');

   // Flush remaining data
   translator.flushSession(sessionId);

   // Get results
   setTimeout(() => {
       const fullText = translator.getFullText(sessionId);
       console.log(fullText);

       const translations = translator.getTranslationMap(sessionId);
       console.log(translations);

       translator.clearSession(sessionId);
   }, 2000);

3. Stream Output Example:

   const sessionId = 'stream-session';

   // Append data as it arrives
   translator.appendData(sessionId, 'Line 1\n');
   translator.appendData(sessionId, 'Line 2\n');

   // Get translated output as it's ready
   const output = translator.getStreamOutput(sessionId);
   console.log(output); // Shows only newly translated lines

   // Check if there's more to process
   if (translator.hasUnprocessed(sessionId)) {
       console.log('Still processing...');
   }

TRANSLATION LOGIC
-----------------

The plugin intelligently decides what to translate based on:

1. Code Context Detection:
   - Looks for keywords like "code", "python", "javascript", etc.
   - Marks session as code context if found

2. Code Block Detection:
   - Recognizes ```code blocks```, <code> tags, etc.
   - Skips translation inside code blocks

3. Comment Detection:
   - Single-line: #, //, --, ;, %
   - Multi-line: /* */, """ """, <!-- -->

4. Translation Rules:
   - IF: Code context AND comment → TRANSLATE
   - IF: Not code context AND not in code block AND English only → TRANSLATE
   - ELSE: DO NOT TRANSLATE

Example:
--------
Input:
```
This is documentation text
```python
# This function adds numbers
def add(a, b):
    return a + b
```
The code above performs addition
```

Translation behavior:
- "This is documentation text" → TRANSLATED (not in code context)
- "# This function adds numbers" → TRANSLATED (comment in code block)
- "def add(a, b):" → NOT TRANSLATED (code)
- "The code above performs addition" → TRANSLATED (after code block)

API REFERENCE
-------------

Main Functions:
- appendData(id, chunk) - Add data to session
- flushSession(id) - Process remaining buffered data
- getFullText(id) - Get all sentences with translations
- getTranslationMap(id) - Get only translated sentences
- getStreamOutput(id) - Get newly available translations
- hasUnprocessed(id) - Check if session has pending translations
- clearSession(id) - Clear a single session
- clearAllSessions() - Clear all sessions

Configuration Functions:
- checkConfig() - Validate Azure Translator configuration
- printSetupInstructions() - Display setup guide
- getSupportedLanguages() - Get list of supported languages
- printSupportedLanguages() - Display supported languages
- getConfigSummary() - Get current configuration
- printConfigSummary() - Display current configuration

Session Info:
- getSessionInfo(id) - Get session details
- getAllSessions() - Get all active sessions

Event Listeners:
- onTranslationReady(callback) - Listen for translation completion

SUPPORTED LANGUAGES
-------------------
- zh-Hans: Simplified Chinese (default)
- zh-Hant: Traditional Chinese
- en: English
- ja: Japanese
- ko: Korean
- fr: French
- de: German
- es: Spanish
- ru: Russian
- ar: Arabic
- pt: Portuguese
- it: Italian

Change target language:
translator.setTranslationProvider('azure', {
    defaultTargetLanguage: 'ja'
});

FILE STRUCTURE
--------------
stream_translator/
├── config/
│   └── index.js                    # Configuration
├── libs/
│   ├── CodeDetector.js             # Code and comment detection
│   ├── SentenceBuffer.js           # Sentence buffering and management
│   ├── TranslatorAPI.js            # Azure Translator API client
│   ├── StreamTranslatorManager.js  # Main session manager
│   └── ConfigHelper.js             # Configuration utilities
├── index.js                        # Main entry point
├── example.js                      # Basic examples
├── test_stream.js                  # Stream testing examples
├── SETUP_AZURE.txt                 # Azure setup guide
└── README_USAGE.txt                # This file

PERFORMANCE TIPS
----------------
1. Enable caching (enabled by default) for repeated translations
2. Use batch processing for multiple sentences
3. Adjust buffer timeout in config if needed
4. Consider Azure pricing tiers for high-volume usage

TROUBLESHOOTING
---------------
Q: Translations not appearing?
A: Make sure to call flushSession() and allow async time for translation

Q: "API credentials not configured"?
A: Run translator.checkConfig() and follow setup instructions

Q: Getting 429 errors?
A: You've hit rate limits. Plugin will auto-retry. Consider upgrading tier.

Q: Some text not translated?
A: Check if it matches translation rules (code context, comments, etc.)

EXAMPLES
--------
Run the examples:

node ncore/utils/stream_translator/example.js
node ncore/utils/stream_translator/test_stream.js

Or import in your code:

const examples = require('#@ncore/utils/stream_translator/example.js');
await examples.exampleBasicUsage();
await examples.exampleCodeTranslation();

ADVANCED USAGE
--------------

Custom Translation Stream:
```javascript
const { Readable } = require('stream');

class MyTranslationStream extends Readable {
    constructor(sessionId) {
        super();
        this.sessionId = sessionId;
        setInterval(() => {
            const output = translator.getStreamOutput(this.sessionId);
            if (output) this.push(output + '\n');
        }, 100);
    }

    _read() {}
}

const stream = new MyTranslationStream('session-1');
stream.pipe(process.stdout);
```

See test_stream.js for a complete TranslationStream implementation.

CONFIGURATION OPTIONS
---------------------
All options can be set via environment variables or config file:

Environment Variables:
- AZURE_TRANSLATOR_ENDPOINT (default: api.cognitive.microsofttranslator.com)
- AZURE_TRANSLATOR_KEY (required)
- AZURE_TRANSLATOR_REGION (default: global)
- AZURE_SUBSCRIPTION_ID (optional)
- AZURE_RESOURCE_GROUP (optional)

Config File (gconfig.stream_translator):
{
    "azure": {
        "endpoint": "api.cognitive.microsofttranslator.com",
        "apiKey": "your-key",
        "region": "global",
        "defaultTargetLanguage": "zh-Hans",
        "timeout": 10000,
        "retryCount": 3,
        "retryDelay": 1000
    },
    "enableCache": true,
    "enableLanguageDetection": true,
    "maxCacheSize": 10000,
    "batchSize": 25
}

LICENSE & SUPPORT
-----------------
Part of the core_node project
For issues and questions, refer to project documentation

CHANGELOG
---------
v1.0.0 - Initial release
- Stream-based translation
- Azure Translator integration
- Code and comment detection
- Session management
- Real-time streaming output
