Edge-TTS Setup Instructions
============================

The TTS (Text-to-Speech) system requires edge-tts to be installed.

Installation:
------------

1. Install edge-tts using pip:
   
   pip install edge-tts
   
   OR if you prefer pipx:
   
   pipx install edge-tts

2. Verify installation:
   
   python3 -m edge_tts --help
   
   You should see the help output without errors.

3. Test voice generation:
   
   python3 -m edge_tts --text "Hello world" --voice en-US-JennyNeural --write-media test.mp3
   
   This should create a test.mp3 file.

Directory Structure:
-------------------

The TTS system automatically creates the following structure in Laravel data directory:

/tts_data/
├── audio/                    # Generated audio files
│   ├── en/                   # English audio
│   │   ├── sentence/         # Sentence-level audio
│   │   ├── word/             # Word-level audio
│   │   └── letter/           # Letter-level audio
│   ├── zh/                   # Chinese audio
│   ├── ja/                   # Japanese audio
│   └── ...                   # Other languages
└── json_db/                  # JSON cache database
    ├── en/
    │   ├── sentence.json     # Sentence cache
    │   ├── word.json         # Word cache
    └── letter.json        # Letter cache

Features:
--------

1. Automatic Caching:
   - Generated audio is cached by language, type (sentence/word/letter), and text
   - JSON database tracks all generated audio with metadata
   - Automatic pruning when cache exceeds 1000 items per file

2. Supported Languages:
   - English (en)
   - Chinese Simplified (zh)
   - Japanese (ja)
   - Korean (ko)
   - Spanish (es)
   - French (fr)
   - German (de)
   - Russian (ru)
   - Arabic (ar)
   - Portuguese (pt)
   - Italian (it)
   - Dutch (nl)
   - Polish (pl)
   - Turkish (tr)
   - Vietnamese (vi)
   - Thai (th)
   - Indonesian (id)

3. API Endpoints:
   - POST /tts/generate - Generate single audio
   - POST /tts/batch-generate - Generate multiple audio files
   - POST /tts/check - Check if audio is ready
   - POST /tts/batch-check - Check multiple audio files
   - GET /tts/audio/{language}/{type}/{filename} - Serve audio file
   - GET /tts/voices - Get available voices
   - GET /tts/cache/stats - Get cache statistics
   - POST /tts/cache/clear - Clear cache

4. Frontend Integration:
   - ITTools.TTS.generateAudio(text, language, type)
   - ITTools.TTS.playAudio(text, language, type)
   - ITTools.TTS.createAudioButton(text, language, type)
   - Automatic polling for pending audio generation
   - Event-driven audio ready notifications

Usage Example:
-------------

// Generate and play audio
ITTools.TTS.playAudio("Hello world", "en", "sentence");

// Create audio button
const btn = ITTools.TTS.createAudioButton("こんにちは", "ja", "sentence");
document.body.appendChild(btn);

// Batch generation
const items = [
    {text: "Hello", language: "en", type: "word"},
    {text: "World", language: "en", type: "word"}
];
ITTools.TTS.batchGenerate(items);

Troubleshooting:
---------------

1. If audio generation fails:
   - Check if python3 is installed: which python3
   - Check if edge-tts is installed: python3 -m edge_tts --help
   - Check Laravel logs for detailed error messages
   - Verify write permissions on Laravel data directory

2. If audio doesn't play:
   - Check browser console for errors
   - Verify audio file was generated: check /tts_data/audio/
   - Try accessing audio URL directly in browser

3. Performance:
   - Letter audio is cached permanently (limited set)
   - Word audio benefits from cache over time
   - Sentence audio generates on demand but caches for reuse
   - Cache is automatically pruned at 1000 items per file
