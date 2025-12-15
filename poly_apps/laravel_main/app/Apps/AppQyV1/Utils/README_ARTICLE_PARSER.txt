AppQyV1ArticleTextParser - Article to Words/Sentences Parser
=============================================================

Source: Based on __misc__/_pycore/com_up/translate.py methods:
  - count_document_words()
  - analyze_doc_to_sentence()
  - get_docsentencemd5()

Usage Examples:
--------------

1. Parse Complete Article:

$text = "Your article text here...";
$result = AppQyV1ArticleTextParser::parseArticle($text, 'english');

Returns:
[
    'article_text' => '...',
    'language' => 'english',
    'sentences' => ['sentence1', 'sentence2', ...],
    'sentences_with_md5' => [
        ['sentence' => 'text', 'md5' => 'hash'],
        ...
    ],
    'words' => ['word1', 'word2', ...],
    'word_frequency' => ['word' => count, ...],
    'total_sentences' => 10,
    'total_words' => 100,
    'unique_words' => 50
]

2. Extract Words Only:

$result = AppQyV1ArticleTextParser::extractWords($text);

Returns:
[
    'words' => ['unique', 'words', 'array'],
    'word_frequency' => ['word' => 5, 'another' => 3],
    'exclude_words' => ['非英文', 'words'],
    'total_words' => 100
]

3. Extract Sentences Only:

$result = AppQyV1ArticleTextParser::extractSentences($text);

Returns:
[
    'sentences' => ['sentence1', 'sentence2'],
    'sentences_with_md5' => [
        ['sentence' => 'text', 'md5' => 'hash']
    ],
    'exclude_sentences' => ['invalid sentences']
]

Word Extraction Rules:
---------------------
- Split Pattern: /[^a-zA-Z'\-_]+/
- Supported Delimiters: space, comma, period, ?, !, etc.
- Preserves: letters, apostrophe ('), hyphen (-), underscore (_)
- Examples:
  * "don't" → "don't" (preserved)
  * "self-driving" → "self-driving" (preserved)
  * "file_name" → "file_name" (preserved)
  * "hello, world!" → ["hello", "world"]

Sentence Extraction Rules:
--------------------------
- Split by punctuation: . , ; ? 。？；，
- Filters out:
  * Sentences > 1000 characters
  * Sentences containing Chinese characters
  * Sentences with ≤1 letter
  * Sentences without spaces
  * Sentences with number/letter ratio > 20%
  * List items (e.g., "1. item")

Integration with Task System:
----------------------------
This parser is designed to work with:
- Global Task System (app/Http/Controllers/TaskController.php)
- Edge TTS Service (app/Services/EdgeTTS/EdgeTTSService.php)
- TTS Cache Manager (app/Services/EdgeTTS/TTSCacheManager.php)

Typical Workflow:
1. User submits article text
2. Parse with AppQyV1ArticleTextParser::parseArticle()
3. Create global task for TTS generation
4. Generate audio for sentences and words asynchronously
5. Cache results in Redis/File cache
6. Return task ID to frontend
7. Frontend polls task status until complete
