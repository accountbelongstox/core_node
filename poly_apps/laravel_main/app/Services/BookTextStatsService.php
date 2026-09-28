<?php

namespace App\Services;

/**
 * Book Text Stats Service
 *
 * Pure text analysis for the dashboard Books pipeline. Given a document's
 * extracted plain text it produces BOTH:
 *
 *   1. Display stats (char/word/sentence counts, language breakdown, top words).
 *   2. The structured data the v2 ingest needs:
 *        - distinct sentences [{content_id, text(stripped), language, seq}]
 *        - sentence_seq tokens [{s:content_id} | {m:marker_code}]
 *        - words {lang: [{content_id, content}]}
 *        - the book content_id
 *      plus full drill-down lists (words by freq, sentences in order, unique
 *      sentences, languages).
 *
 * SEMANTICS mirror pycore:
 *   - content_id = md5(normalize(strip_punctuation(text))) WITHOUT language —
 *     computed via MediaIngestService::computeContentId so book sentences dedupe
 *     against subtitle/document sentences in the shared library.
 *   - Sentences split on terminal punctuation (the canonical marker set:
 *     . ! ? 。 ！ ？ … ；) and on blank-line paragraph breaks.
 *   - Words: Latin runs (apostrophe/hyphen kept internally); each CJK Han char
 *     counts as its own word.
 *   - Language detected per token by Unicode script.
 *
 * No DB access here (the ingest layer owns persistence); this is deterministic
 * and side-effect free so the upload endpoint can cache its output.
 */
class BookTextStatsService
{
    /** Top-N most frequent words surfaced in the display stats. */
    private const TOP_WORDS_LIMIT = 50;

    /** Terminal punctuation chars -> marker code (mirror of punctuation_markers.py). */
    private const TERMINAL_MARKERS = [
        '.' => 'period',
        '。' => 'period_fw',
        '!' => 'excl',
        '！' => 'excl_fw',
        '?' => 'ques',
        '？' => 'ques_fw',
        '…' => 'ellipsis',
        '；' => 'semicolon_fw',
    ];

    /**
     * Analyze a document's text. $language is the optional caller-provided
     * language name/code; when blank the primary detected language is used.
     *
     * @return array {
     *   stats: [...display counts + languages + top_words...],
     *   content_id: string,           // book-level content id
     *   primary_language: string,     // full language name (english/chinese/...)
     *   sentences: [{content_id,text,language,seq,grain}],  // DISTINCT, ingest-ready
     *   sentence_seq: [{s:content_id}|{m:marker_code}],
     *   words: { '<lang>': [{content_id, content}] },       // distinct per language
     *   lists: { words, sentences, unique_sentences, languages },  // drill-down
     * }
     */
    public function analyze(string $text, string $language = ''): array
    {
        $text = (string) $text;

        // ---- Character-level counts ----
        $charCount = mb_strlen($text);
        $charCountNoSpace = mb_strlen(preg_replace('/\s+/u', '', $text));
        $lineCount = $text === '' ? 0 : count(preg_split('/\n/u', $text));
        $paragraphCount = $this->countParagraphs($text);

        // ---- Words (ordered, with frequencies) ----
        $wordTokens = $this->tokenizeWords($text);
        $wordCount = count($wordTokens);

        $wordFreq = [];
        $wordLang = [];
        foreach ($wordTokens as $token) {
            $w = $token['word'];
            if (!isset($wordFreq[$w])) {
                $wordFreq[$w] = 0;
                $wordLang[$w] = $token['language'];
            }
            $wordFreq[$w]++;
        }
        $uniqueWordCount = count($wordFreq);

        // Drill-down word list: distinct words, frequency desc then alpha.
        arsort($wordFreq);
        $wordsList = [];
        foreach ($wordFreq as $w => $count) {
            $wordsList[] = [
                'word' => $w,
                'count' => $count,
                'language' => $wordLang[$w],
            ];
        }

        $topWords = array_slice(array_map(function ($row) {
            return ['word' => $row['word'], 'count' => $row['count']];
        }, $wordsList), 0, self::TOP_WORDS_LIMIT);

        // ---- Sentences + reconstruction sequence ----
        $segmented = $this->segmentWithMarkers($text);

        $sentenceObjects = [];        // ordered, one per occurrence (raw)
        $sentenceSeq = [];            // {s:content_id} | {m:marker_code}
        $distinctSentences = [];      // content_id => ingest row
        $orderedSentenceTexts = [];   // drill-down: stripped text in order
        $primaryLanguageFromCaller = $this->normalizeLanguageCode($language);

        $seq = 0;
        foreach ($segmented as $token) {
            if ($token['kind'] === 'marker') {
                $sentenceSeq[] = ['m' => $token['code']];
                continue;
            }

            $raw = $token['text'];
            // Stored text keeps ORIGINAL CASE (punctuation stripped, whitespace
            // collapsed) — same as pycore — so the reconstruction read endpoint
            // returns properly-cased sentences. content_id still lowercases
            // internally (computeContentId) so dedup stays case-insensitive.
            $stored = $this->collapseSpaces(MediaIngestService::stripPunctuation($raw));
            if ($stored === '') {
                continue;
            }

            $contentId = MediaIngestService::computeContentId($raw);
            $sentLang = $this->detectLanguageCode($raw);

            $orderedSentenceTexts[] = $stored;
            $sentenceSeq[] = ['s' => $contentId];

            $sentenceObjects[] = [
                'content_id' => $contentId,
                'text' => $stored,
                'language' => $sentLang,
            ];

            if (!isset($distinctSentences[$contentId])) {
                $distinctSentences[$contentId] = [
                    'content_id' => $contentId,
                    'text' => $stored,
                    'language' => $sentLang,
                    'seq' => $seq,
                    'grain' => 'sentence',
                ];
                $seq++;
            }
        }

        $sentenceCount = count($sentenceObjects);
        $uniqueSentenceCount = count($distinctSentences);

        // ---- Language breakdown (by character script over the whole text) ----
        $languages = $this->languageBreakdown($text);
        $primaryLanguage = $primaryLanguageFromCaller;
        if ($primaryLanguage === '') {
            $primaryLanguage = $this->primaryLanguageCode($languages);
        }

        // Per-language distinct word map for ingest ({lang: [{content_id, content}]}).
        $wordsByLang = [];
        foreach ($wordsList as $row) {
            $langName = $row['language'];
            if ($langName === '') {
                $langName = $primaryLanguage;
            }
            if (!isset($wordsByLang[$langName])) {
                $wordsByLang[$langName] = [];
            }
            $wordsByLang[$langName][] = [
                'content_id' => md5($row['word']),
                'content' => $row['word'],
            ];
        }

        // Book-level content id over the whole stripped/normalized text.
        $bookContentId = MediaIngestService::computeContentId($text);

        $stats = [
            'char_count' => $charCount,
            'char_count_no_space' => $charCountNoSpace,
            'word_count' => $wordCount,
            'unique_word_count' => $uniqueWordCount,
            'sentence_count' => $sentenceCount,
            'unique_sentence_count' => $uniqueSentenceCount,
            'line_count' => $lineCount,
            'paragraph_count' => $paragraphCount,
            'primary_language' => $primaryLanguage,
            'languages' => $languages,
            'top_words' => $topWords,
        ];

        // Drill-down: unique sentences (in first-seen order).
        $uniqueSentenceList = array_values(array_map(function ($row) {
            return [
                'content_id' => $row['content_id'],
                'text' => $row['text'],
                'language' => $row['language'],
            ];
        }, $distinctSentences));

        // Drill-down: every sentence occurrence in order.
        $sentenceList = [];
        foreach ($sentenceObjects as $idx => $row) {
            $sentenceList[] = [
                'index' => $idx,
                'content_id' => $row['content_id'],
                'text' => $row['text'],
                'language' => $row['language'],
            ];
        }

        return [
            'stats' => $stats,
            'content_id' => $bookContentId,
            'primary_language' => $primaryLanguage,
            'sentences' => array_values($distinctSentences),
            'sentence_seq' => $sentenceSeq,
            'words' => $wordsByLang,
            'lists' => [
                'words' => $wordsList,
                'sentences' => $sentenceList,
                'unique_sentences' => $uniqueSentenceList,
                'languages' => $languages,
            ],
        ];
    }

    /**
     * Books v3: segment text into chapters and ordered per-chapter slots
     * (BOOKS_FEATURE_SPECIFICATION.md §7/§8). Mirrors pycore's chapter heuristics.
     *
     * Returns:
     *   chapters: [{chapter_index, title, text, sentence_count}]
     *   slots:    [{chapter_index, grain, seq, text, language, content_id}]
     *             — BOTH grains preserved: 'cue' (one source line/paragraph) and
     *               'sentence' (lines merged then re-split on terminal punctuation).
     *               seq is per-grain (a running counter for each grain across the
     *               whole document, chapter order preserved).
     *
     * No DB access; deterministic + cacheable like analyze().
     *
     * @return array{chapters:array<int,array>, slots:array<int,array>}
     */
    public function analyzeChapters(string $text, string $language = ''): array
    {
        $text = (string) $text;
        $primaryLanguage = $this->normalizeLanguageCode($language);
        if ($primaryLanguage === '') {
            $primaryLanguage = $this->primaryLanguageCode($this->languageBreakdown($text));
        }

        $chapterTexts = $this->segmentChapters($text);

        $chapters = [];
        $slots = [];
        $cueSeq = 0;
        $sentenceSeq = 0;

        foreach ($chapterTexts as $chapter) {
            $chapterIndex = (int) $chapter['chapter_index'];
            $chapterBody = (string) $chapter['text'];

            $chapterSentenceCount = 0;

            // ---- Grain 'cue': one source line / paragraph ----
            foreach ($this->splitCues($chapterBody) as $cueRaw) {
                $stored = $this->collapseSpaces(MediaIngestService::stripPunctuation($cueRaw));
                if ($stored === '') {
                    continue;
                }
                $slots[] = [
                    'chapter_index' => $chapterIndex,
                    'grain' => 'cue',
                    'seq' => $cueSeq,
                    'text' => $stored,
                    'language' => $this->detectLanguageCode($cueRaw),
                    'content_id' => MediaIngestService::computeContentId($cueRaw),
                ];
                $cueSeq++;
            }

            // ---- Grain 'sentence': merge lines then re-split on terminal punct ----
            foreach ($this->segmentWithMarkers($chapterBody) as $token) {
                if ($token['kind'] !== 'sentence') {
                    continue;
                }
                $raw = $token['text'];
                $stored = $this->collapseSpaces(MediaIngestService::stripPunctuation($raw));
                if ($stored === '') {
                    continue;
                }
                $slots[] = [
                    'chapter_index' => $chapterIndex,
                    'grain' => 'sentence',
                    'seq' => $sentenceSeq,
                    'text' => $stored,
                    'language' => $this->detectLanguageCode($raw),
                    'content_id' => MediaIngestService::computeContentId($raw),
                ];
                $sentenceSeq++;
                $chapterSentenceCount++;
            }

            $chapters[] = [
                'chapter_index' => $chapterIndex,
                'title' => (string) $chapter['title'],
                'text' => $chapterBody,
                'sentence_count' => $chapterSentenceCount,
            ];
        }

        return [
            'chapters' => $chapters,
            'slots' => $slots,
        ];
    }

    /**
     * Detect chapters in plain text using heading heuristics that mirror
     * pycore's book_processor.segment_chapters (BOOKS_FEATURE_SPECIFICATION.md §8):
     *   - ^(Chapter|CHAPTER)\s+[\dIVXLC]+
     *   - ^第\s*[0-9一二三四五六七八九十百千]+\s*[章回]
     *   - markdown headings (#, ##)
     *   - standalone short ALL-CAPS or numbered lines
     * FALLBACK: a single chapter {chapter_index:0, title:"Chapter 1", text:<all>}.
     *
     * @return array<int, array{chapter_index:int, title:string, text:string}>
     */
    private function segmentChapters(string $text): array
    {
        if (trim($text) === '') {
            return [[
                'chapter_index' => 0,
                'title' => 'Chapter 1',
                'text' => $text,
            ]];
        }

        $lines = preg_split('/\r\n|\r|\n/u', $text);
        if (!is_array($lines)) {
            $lines = [$text];
        }

        $boundaries = [];   // [lineIndex => title]
        foreach ($lines as $idx => $line) {
            $title = $this->headingTitle((string) $line);
            if ($title !== null) {
                $boundaries[$idx] = $title;
            }
        }

        // No heading detected anywhere -> single fallback chapter.
        if (empty($boundaries)) {
            return [[
                'chapter_index' => 0,
                'title' => 'Chapter 1',
                'text' => $text,
            ]];
        }

        $chapters = [];
        $boundaryLineNumbers = array_keys($boundaries);
        sort($boundaryLineNumbers);

        // Any text BEFORE the first heading becomes a leading "Preface" chapter
        // so no content is lost.
        $firstBoundary = $boundaryLineNumbers[0];
        $chapterIndex = 0;
        if ($firstBoundary > 0) {
            $preBody = trim(implode("\n", array_slice($lines, 0, $firstBoundary)));
            if ($preBody !== '') {
                $chapters[] = [
                    'chapter_index' => $chapterIndex,
                    'title' => 'Preface',
                    'text' => $preBody,
                ];
                $chapterIndex++;
            }
        }

        $count = count($boundaryLineNumbers);
        for ($b = 0; $b < $count; $b++) {
            $startLine = $boundaryLineNumbers[$b];
            $endLine = ($b + 1 < $count) ? $boundaryLineNumbers[$b + 1] : count($lines);

            // Body excludes the heading line itself; the heading is the title.
            $bodyLines = array_slice($lines, $startLine + 1, $endLine - $startLine - 1);
            $body = trim(implode("\n", $bodyLines));

            $chapters[] = [
                'chapter_index' => $chapterIndex,
                'title' => $boundaries[$startLine],
                'text' => $body,
            ];
            $chapterIndex++;
        }

        if (empty($chapters)) {
            return [[
                'chapter_index' => 0,
                'title' => 'Chapter 1',
                'text' => $text,
            ]];
        }

        return $chapters;
    }

    /**
     * Return the chapter title when $line is a chapter heading, else null.
     * Mirrors the pycore heading regex set.
     */
    private function headingTitle(string $line): ?string
    {
        $trimmed = trim($line);
        if ($trimmed === '') {
            return null;
        }

        // Markdown headings: # / ## ... (level 1-2 treated as chapter heads).
        if (preg_match('/^#{1,2}\s+(.+)$/u', $trimmed, $m)) {
            return trim($m[1]);
        }

        // English "Chapter N" (arabic or roman numerals).
        if (preg_match('/^(?:Chapter|CHAPTER)\s+[\dIVXLC]+\b.*$/u', $trimmed)) {
            return $trimmed;
        }

        // CJK "第 N 章 / 回".
        if (preg_match('/^第\s*[0-9一二三四五六七八九十百千]+\s*[章回].*$/u', $trimmed)) {
            return $trimmed;
        }

        // Standalone short numbered line, e.g. "1.", "12 -", "I.".
        if (preg_match('/^(?:[\dIVXLC]+)[\.\):\-\s].{0,60}$/u', $trimmed) && mb_strlen($trimmed) <= 64) {
            return $trimmed;
        }

        // Standalone short ALL-CAPS line (a likely section/chapter heading).
        if (mb_strlen($trimmed) >= 2 && mb_strlen($trimmed) <= 48) {
            $letters = preg_replace('/[^\p{L}]/u', '', $trimmed);
            if ($letters !== '' && mb_strtoupper($letters) === $letters
                && preg_match('/\p{Lu}/u', $letters)) {
                return $trimmed;
            }
        }

        return null;
    }

    /**
     * Split a chapter body into 'cue' grains: one cue per non-empty line, with
     * blank-line-separated paragraphs collapsed to single cues when the block is
     * a single wrapped paragraph. We keep it simple + robust: a cue is one
     * non-empty source line (a paragraph/line), preserving the prior "cue" grain
     * semantics (one source line/paragraph).
     *
     * @return array<int, string>
     */
    private function splitCues(string $text): array
    {
        if (trim($text) === '') {
            return [];
        }
        $lines = preg_split('/\r\n|\r|\n/u', $text);
        if (!is_array($lines)) {
            return [];
        }
        $cues = [];
        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line !== '') {
                $cues[] = $line;
            }
        }
        return $cues;
    }

    /**
     * Tokenize into ordered words. Latin/other-script runs are maximal runs of
     * letters/digits with internal apostrophe or hyphen kept; each CJK Han char
     * is its own one-character word (matching pycore's per-Han tokenization).
     *
     * @return array<int, array{word:string, language:string}>
     */
    private function tokenizeWords(string $text): array
    {
        if ($text === '') {
            return [];
        }

        $tokens = [];
        // A "word" is: a single Han char, OR a run of letters/digits that may
        // contain internal ' or - (not leading/trailing).
        $pattern = '/\p{Han}|[\p{L}\p{N}]+(?:[\'\x{2019}\-][\p{L}\p{N}]+)*/u';
        if (preg_match_all($pattern, $text, $matches)) {
            foreach ($matches[0] as $raw) {
                $word = mb_strtolower($raw);
                if ($word === '') {
                    continue;
                }
                $tokens[] = [
                    'word' => $word,
                    'language' => $this->detectLanguageCode($raw),
                ];
            }
        }

        return $tokens;
    }

    /**
     * Split text into an ordered reconstruction sequence of sentence + marker
     * tokens. Mirrors punctuation_markers.segment_with_markers: a sentence runs
     * up to (excluding) a terminal char; that char becomes the next marker; a
     * blank line emits a paragraph marker.
     *
     * @return array<int, array{kind:string, text?:string, code?:string}>
     */
    private function segmentWithMarkers(string $text): array
    {
        if (trim($text) === '') {
            return [];
        }

        $tokens = [];
        $buf = '';
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($chars)) {
            return [];
        }

        $n = count($chars);
        $i = 0;
        while ($i < $n) {
            $ch = $chars[$i];
            if (isset(self::TERMINAL_MARKERS[$ch])) {
                $raw = trim($buf);
                $buf = '';
                if ($raw !== '') {
                    $tokens[] = ['kind' => 'sentence', 'text' => $raw];
                }
                $tokens[] = ['kind' => 'marker', 'code' => self::TERMINAL_MARKERS[$ch]];

                // Consume following whitespace; a blank line -> paragraph marker.
                $j = $i + 1;
                $newlines = 0;
                while ($j < $n && preg_match('/\s/u', $chars[$j])) {
                    if ($chars[$j] === "\n") {
                        $newlines++;
                    }
                    $j++;
                }
                if ($newlines >= 2) {
                    $tokens[] = ['kind' => 'marker', 'code' => 'paragraph'];
                }
                $i = $j;
                continue;
            }
            $buf .= $ch;
            $i++;
        }

        $raw = trim($buf);
        if ($raw !== '') {
            $tokens[] = ['kind' => 'sentence', 'text' => $raw];
        }

        return $tokens;
    }

    /**
     * Per-script character breakdown over the whole text. Counts letters by
     * Unicode script, returns the ratio of each over total counted letters.
     *
     * @return array<int, array{script:string, code:string, chars:int, ratio:float}>
     */
    private function languageBreakdown(string $text): array
    {
        $scriptCounts = [];
        $total = 0;

        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (is_array($chars)) {
            foreach ($chars as $ch) {
                $script = $this->scriptOf($ch);
                if ($script === '') {
                    continue;
                }
                if (!isset($scriptCounts[$script])) {
                    $scriptCounts[$script] = 0;
                }
                $scriptCounts[$script]++;
                $total++;
            }
        }

        arsort($scriptCounts);

        $result = [];
        foreach ($scriptCounts as $script => $count) {
            $ratio = $total > 0 ? round($count / $total, 4) : 0.0;
            $result[] = [
                'script' => $script,
                'code' => $this->scriptToLanguageCode($script),
                'chars' => $count,
                'ratio' => $ratio,
            ];
        }

        return $result;
    }

    /**
     * Detect the dominant language CODE for a piece of text (en/zh/ja/ko/ru/...).
     * Codes (not names) so the shared library agrees with pycore + the per-language
     * tts_cache_<code> tables. Empty string when there are no letters.
     */
    private function detectLanguageCode(string $text): string
    {
        $scriptCounts = [];
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (is_array($chars)) {
            foreach ($chars as $ch) {
                $script = $this->scriptOf($ch);
                if ($script === '') {
                    continue;
                }
                if (!isset($scriptCounts[$script])) {
                    $scriptCounts[$script] = 0;
                }
                $scriptCounts[$script]++;
            }
        }

        if (empty($scriptCounts)) {
            return '';
        }

        arsort($scriptCounts);
        $dominant = array_key_first($scriptCounts);

        return $this->scriptToLanguageCode($dominant);
    }

    /**
     * Unicode script bucket for a single character. Returns '' for digits,
     * whitespace, punctuation and symbols (they do not vote for a language).
     */
    private function scriptOf(string $ch): string
    {
        if (preg_match('/\p{Han}/u', $ch)) {
            return 'han';
        }
        if (preg_match('/\p{Hiragana}|\p{Katakana}/u', $ch)) {
            return 'kana';
        }
        if (preg_match('/\p{Hangul}/u', $ch)) {
            return 'hangul';
        }
        if (preg_match('/\p{Cyrillic}/u', $ch)) {
            return 'cyrillic';
        }
        if (preg_match('/\p{Greek}/u', $ch)) {
            return 'greek';
        }
        if (preg_match('/\p{Arabic}/u', $ch)) {
            return 'arabic';
        }
        if (preg_match('/\p{Hebrew}/u', $ch)) {
            return 'hebrew';
        }
        if (preg_match('/\p{Thai}/u', $ch)) {
            return 'thai';
        }
        if (preg_match('/\p{L}/u', $ch)) {
            return 'latin';
        }
        return '';
    }

    /** Script bucket -> 2-letter language code. */
    private function scriptToLanguageCode(string $script): string
    {
        $map = [
            'han' => 'zh',
            'kana' => 'ja',
            'hangul' => 'ko',
            'cyrillic' => 'ru',
            'greek' => 'el',
            'arabic' => 'ar',
            'hebrew' => 'he',
            'thai' => 'th',
            'latin' => 'en',
        ];
        if (isset($map[$script])) {
            return $map[$script];
        }
        return 'en';
    }

    /** Pick the primary language CODE from a language breakdown list. */
    private function primaryLanguageCode(array $languages): string
    {
        if (empty($languages)) {
            return 'en';
        }
        $top = $languages[0];
        return $this->scriptToLanguageCode($top['script']);
    }

    /**
     * Normalize a caller-provided language to a 2-letter CODE. Accepts a full
     * name or a code; returns '' when blank so the caller falls back to detection.
     */
    private function normalizeLanguageCode(string $language): string
    {
        $language = strtolower(trim($language));
        if ($language === '') {
            return '';
        }

        $nameToCode = [
            'english' => 'en',
            'chinese' => 'zh',
            'japanese' => 'ja',
            'korean' => 'ko',
            'russian' => 'ru',
            'greek' => 'el',
            'arabic' => 'ar',
            'hebrew' => 'he',
            'thai' => 'th',
        ];
        if (isset($nameToCode[$language])) {
            return $nameToCode[$language];
        }

        return $language;
    }

    /**
     * Collapse internal whitespace + trim, PRESERVING case. Used for the stored
     * sentence text (the case-folded form is only used to derive content_id).
     */
    private function collapseSpaces(string $text): string
    {
        $collapsed = preg_replace('/\s+/u', ' ', $text);
        return trim((string) $collapsed);
    }

    /** Count paragraphs: non-empty blocks separated by blank lines. */
    private function countParagraphs(string $text): int
    {
        if (trim($text) === '') {
            return 0;
        }
        $blocks = preg_split('/\n\s*\n/u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($blocks)) {
            return 0;
        }
        $count = 0;
        foreach ($blocks as $block) {
            if (trim($block) !== '') {
                $count++;
            }
        }
        return $count;
    }
}
