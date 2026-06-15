<?php

namespace App\Services;

use App\Models\Subtitle;
use App\Models\Book;
use App\Models\Sentence;
use App\Models\SourceSentence;
use App\Models\MediaSegment;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Providers\AppTablePrefixServiceProvider;
use App\Constants\AppKeys;

/**
 * Media Ingest Service
 *
 * Idempotent ingestion of pycore media data into the five dedicated tables:
 *   - subtitles        (source_type = 'subtitle')  keyed on source_key
 *   - books            (source_type = 'book')      keyed on source_key
 *   - sentences        SHARED library keyed on sentence_id = sha1(normalize(text) + '|' + language)
 *   - source_sentences positional link keyed on (source_type, source_key, grain, seq)
 *   - media_segments   (subtitle only)             keyed on (source_key, seg_index)
 *
 * THE CRITICAL IDEMPOTENCY RULE: FILL-MISSING, NEVER CLOBBER.
 * mergeFill() only writes an incoming column when the incoming value is
 * non-empty AND the existing column is currently empty/null. An empty or
 * missing incoming value can never overwrite an existing non-empty DB value.
 * New rows insert fully; existing rows are only enriched, never regressed.
 *
 * Duplicate sentences (same sentence_id) are NOT re-written: text and the AI
 * detail fields (explanation/ai_commentary/grammar/special_usage/audio) are
 * never clobbered; occurrence_count is bumped; only missing fields are filled.
 */
class MediaIngestService
{
    /**
     * Ingest a full media payload idempotently.
     *
     * Routes on source_type ('subtitle'|'book'):
     *   - subtitle: upsert Subtitle + media_segments + sentences/source_sentences
     *   - book:     upsert Book + sentences/source_sentences (no video segments)
     *
     * @param array $payload [
     *   'source_type' => 'subtitle'|'book',
     *   'source'      => [...],
     *   'segments'    => [...] (subtitle only),
     *   'sentences'   => [{grain,seq,text,language,seg_index,sub_idx,start_sec,end_sec}],
     * ]
     * @return array Summary of created/filled/deduped counts per table.
     */
    public function ingest(array $payload): array
    {
        $sourceType = $payload['source_type'] ?? null;
        if (!in_array($sourceType, ['subtitle', 'book'], true)) {
            throw new \InvalidArgumentException("source_type must be 'subtitle' or 'book'");
        }

        $sourceData = $payload['source'] ?? [];
        $segments = $payload['segments'] ?? [];
        $sentences = $payload['sentences'] ?? [];
        $words = $payload['words'] ?? [];
        $modelVersion = isset($payload['model_version']) ? (int) $payload['model_version'] : 1;

        $sourceKey = $sourceData['source_key'] ?? null;
        if (empty($sourceKey)) {
            throw new \InvalidArgumentException('source.source_key is required');
        }

        // Books Sentence/Word Model v2: pycore does ALL processing locally and
        // submits ONCE. Sentences arrive punctuation-stripped + keyed on
        // content_id (md5(normalize(strip_punctuation(text)))); the book carries
        // sentence_seq / word_ids; distinct words arrive per language. Routed to
        // its own path so the legacy v1 subtitle/book ingest stays untouched.
        if ($sourceType === 'book' && $modelVersion >= 2) {
            return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use ($sourceKey, $sourceData, $sentences, $words) {
                $sourceResult = $this->ingestBookV2Source($sourceKey, $sourceData);
                $sentenceResult = $this->ingestSentencesV2('book', $sourceKey, $sentences);
                $wordResult = $this->ingestWordsV2($words);

                return [
                    'source_type' => 'book',
                    'model_version' => 2,
                    'source_key' => $sourceKey,
                    'source' => $sourceResult,
                    'sentences' => $sentenceResult['sentences'],
                    'source_sentences' => $sentenceResult['source_sentences'],
                    'words' => $wordResult,
                ];
            });
        }

        // ONE transaction for the whole payload. A feature-length movie carries
        // thousands of sentence/link rows; without this every create()/save()
        // auto-commits (one fsync each), which took minutes per source on
        // SQLite and blocked the single-worker server (client read timeouts).
        // Batched into a single commit the same ingest completes in seconds.
        // Semantics are unchanged: same row-by-row mergeFill, all-or-nothing
        // is safe because ingest is idempotent and re-runnable.
        // Models live on the AppQyV1 connection — the transaction must open there,
        // not on the default connection, or the writes are not actually covered.
        return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use ($sourceType, $sourceKey, $sourceData, $segments, $sentences) {
            $sourceResult = $sourceType === 'subtitle'
                ? $this->ingestSubtitle($sourceKey, $sourceData)
                : $this->ingestBook($sourceKey, $sourceData);

            $segmentResult = $sourceType === 'subtitle'
                ? $this->ingestSegments($sourceKey, $segments)
                : ['created' => 0, 'filled' => 0];

            $sentenceResult = $this->ingestSentences($sourceType, $sourceKey, $sentences);

            return [
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'source' => $sourceResult,
                'segments' => $segmentResult,
                'sentences' => $sentenceResult['sentences'],
                'source_sentences' => $sentenceResult['source_sentences'],
            ];
        });
    }

    /**
     * Upsert the subtitle source row on source_key (fill-missing, never clobber).
     *
     * @return array ['created' => bool, 'filled' => bool]
     */
    private function ingestSubtitle(string $sourceKey, array $data): array
    {
        $allowed = [
            'title', 'original_name', 'ascii_name', 'language', 'duration_sec',
            'rel_path', 'output_dir', 'full_content', 'files',
            'subtitle_count', 'segment_count', 'sentence_count', 'metadata',
        ];
        $incoming = $this->pick($data, $allowed);

        $source = Subtitle::where('source_key', $sourceKey)->first();

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Subtitle::create($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->mergeFill($source, $incoming);
        $source->synced_at = now();
        $source->save();

        return ['created' => false, 'filled' => $changed];
    }

    /**
     * Upsert the book source row on source_key (fill-missing, never clobber).
     *
     * @return array ['created' => bool, 'filled' => bool]
     */
    private function ingestBook(string $sourceKey, array $data): array
    {
        $allowed = [
            'title', 'original_name', 'ascii_name', 'language',
            'full_content', 'audio', 'sentence_count', 'metadata',
        ];
        $incoming = $this->pick($data, $allowed);

        $source = Book::where('source_key', $sourceKey)->first();

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Book::create($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->mergeFill($source, $incoming);
        $source->synced_at = now();
        $source->save();

        return ['created' => false, 'filled' => $changed];
    }

    /**
     * v2: Upsert the book source row on source_key (fill-missing, never clobber).
     *
     * Adds the v2 columns content_id / sentence_seq / word_ids on top of the v1
     * book fields. Stored as today: full_content, title, metadata, etc.
     *
     * @return array ['created' => bool, 'filled' => bool]
     */
    private function ingestBookV2Source(string $sourceKey, array $data): array
    {
        $allowed = [
            'content_id', 'title', 'original_name', 'ascii_name', 'language',
            'full_content', 'audio', 'sentence_seq', 'word_ids',
            'sentence_count', 'metadata',
        ];
        $incoming = $this->pick($data, $allowed);

        $source = Book::where('source_key', $sourceKey)->first();

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Book::create($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->mergeFill($source, $incoming);
        $source->synced_at = now();
        $source->save();

        return ['created' => false, 'filled' => $changed];
    }

    /**
     * v2: Upsert the SHARED sentence library on content_id, AND the positional
     * source_sentences link. Both via the no-clobber mergeFill.
     *
     * v2 differences vs v1:
     *   - Dedup key is content_id = md5(normalize(strip_punctuation(text))) — sent
     *     by pycore; falls back to the same formula here if absent. No language in
     *     the hash, so identical stripped text dedupes across languages.
     *   - The stored `text` is the punctuation-stripped normalized sentence (pycore
     *     already stripped it).
     *   - `audio` is left NULL on first insert; the pycore-generated audio is
     *     filled later by the TTS pipeline (see commented stub below).
     *   - The legacy sentence_id = sha1(normalize(text)+'|'+language) is still set
     *     so v1 readers / source_sentences keep working.
     *
     * @return array [
     *   'sentences'        => ['created' => int, 'filled' => int, 'deduped' => int],
     *   'source_sentences' => ['created' => int, 'filled' => int],
     * ]
     */
    private function ingestSentencesV2(string $sourceType, string $sourceKey, array $sentences): array
    {
        $sCreated = 0;
        $sFilled = 0;
        $sDeduped = 0;
        $linkCreated = 0;
        $linkFilled = 0;

        // Optional fields the worker may provide on first insert. AI detail
        // fields stay mergeFill-protected on every subsequent pass. `audio` is
        // intentionally NOT picked here: it is filled later by the TTS pipeline.
        $sentenceAllowed = [
            'explanation', 'ai_commentary', 'grammar', 'special_usage', 'metadata',
        ];
        $linkAllowed = [
            'seg_index', 'sub_idx', 'start_sec', 'end_sec', 'metadata',
        ];

        foreach ($sentences as $sentence) {
            $text = isset($sentence['text']) ? (string) $sentence['text'] : '';
            $language = isset($sentence['language']) ? (string) $sentence['language'] : '';
            if ($this->isEmptyValue($text)) {
                continue;
            }

            // content_id is the v2 dedup key (pycore-provided; recomputed if missing).
            $contentId = isset($sentence['content_id']) && !$this->isEmptyValue($sentence['content_id'])
                ? (string) $sentence['content_id']
                : self::computeContentId($text);

            // Legacy key kept so existing v1 readers / links keep working.
            $sentenceId = self::computeSentenceId($text, $language);

            // ---- Shared sentence library ----
            // Dedupe by content_id (v2 key); fall back to the legacy sentence_id
            // so a pre-v2 / cross-path row (content_id NULL, e.g. a punctuation-free
            // subtitle cue whose stripped text equals this book sentence) RECONCILES
            // instead of colliding on the sentence_id unique constraint.
            $sentenceRow = Sentence::where('content_id', $contentId)->first();
            if (!$sentenceRow) {
                $sentenceRow = Sentence::where('sentence_id', $sentenceId)->first();
            }

            if (!$sentenceRow) {
                $incoming = $this->pick($sentence, $sentenceAllowed);
                $incoming['content_id'] = $contentId;
                $incoming['sentence_id'] = $sentenceId;
                $incoming['text'] = $text;
                $incoming['language'] = $language !== '' ? $language : 'english';
                $incoming['occurrence_count'] = 1;
                // audio left NULL on insert; the pycore-generated sentence audio is
                // filled later by the TTS pipeline, e.g.:
                //   $incoming['audio'] = $sentence['audio'] ?? null;
                Sentence::create($incoming);
                $sCreated++;
            } else {
                // Duplicate (by content_id OR sentence_id): never overwrite
                // text/AI/audio; bump occurrence_count; fill only currently-empty
                // optional fields; backfill content_id / sentence_id when a matched
                // pre-v2 row lacks them (so future v2 lookups hit content_id).
                $sDeduped++;
                $incoming = $this->pick($sentence, $sentenceAllowed);
                if ($this->isEmptyValue($sentenceRow->getAttribute('content_id'))) {
                    $incoming['content_id'] = $contentId;
                }
                if ($this->isEmptyValue($sentenceRow->getAttribute('sentence_id'))) {
                    $incoming['sentence_id'] = $sentenceId;
                }
                $changed = $this->mergeFill($sentenceRow, $incoming);
                $sentenceRow->occurrence_count = (int) $sentenceRow->occurrence_count + 1;
                $sentenceRow->save();
                if ($changed) {
                    $sFilled++;
                }
            }

            // ---- Positional link (one row per source occurrence/grain/seq) ----
            $grain = isset($sentence['grain']) ? (string) $sentence['grain'] : 'sentence';
            $seq = isset($sentence['seq']) ? (int) $sentence['seq'] : 0;

            $linkIncoming = $this->pick($sentence, $linkAllowed);

            $existingLink = SourceSentence::where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where('grain', $grain)
                ->where('seq', $seq)
                ->first();

            if (!$existingLink) {
                $linkIncoming['source_type'] = $sourceType;
                $linkIncoming['source_key'] = $sourceKey;
                $linkIncoming['sentence_id'] = $sentenceId;
                $linkIncoming['grain'] = $grain;
                $linkIncoming['seq'] = $seq;
                SourceSentence::create($linkIncoming);
                $linkCreated++;
            } else {
                if ($this->isEmptyValue($existingLink->getAttribute('sentence_id'))) {
                    $linkIncoming['sentence_id'] = $sentenceId;
                }
                if ($this->mergeFill($existingLink, $linkIncoming)) {
                    $existingLink->save();
                    $linkFilled++;
                }
            }
        }

        return [
            'sentences' => ['created' => $sCreated, 'filled' => $sFilled, 'deduped' => $sDeduped],
            'source_sentences' => ['created' => $linkCreated, 'filled' => $linkFilled],
        ];
    }

    /**
     * v2: Upsert each distinct word into its per-language TTS-cache dictionary
     * (app_qy_v1_tts_cache_<lang>) via AppQyV1LangDictionaryModel::createOrFind
     * (md5-keyed). Existing rows are returned untouched — audio/translation are
     * NEVER overwritten; the TTS pipeline fills audio later.
     *
     * @param array $words { "<lang>": [ {content_id, content}, ... ] }
     * @return array ['languages' => int, 'created' => int, 'existing' => int]
     */
    private function ingestWordsV2(array $words): array
    {
        $languages = 0;
        $created = 0;
        $existing = 0;

        foreach ($words as $lang => $items) {
            if (!is_array($items)) {
                continue;
            }
            $langCode = $this->normalizeLangCode((string) $lang);
            if ($langCode === '') {
                continue;
            }
            $languages++;

            foreach ($items as $item) {
                $content = '';
                if (is_array($item)) {
                    $content = isset($item['content']) ? (string) $item['content'] : '';
                } else {
                    $content = (string) $item;
                }
                if ($this->isEmptyValue($content)) {
                    continue;
                }

                // md5-keyed: returns the existing row when present (no clobber),
                // else inserts a bare word row (audio filled later by TTS).
                $before = AppQyV1LangDictionaryModel::findByContent($langCode, $content);
                AppQyV1LangDictionaryModel::createOrFind($langCode, $content);
                if ($before) {
                    $existing++;
                } else {
                    $created++;
                }
            }
        }

        return [
            'languages' => $languages,
            'created' => $created,
            'existing' => $existing,
        ];
    }

    /**
     * Normalize a language key to the 2/3-letter code used by the per-language
     * dictionary tables (app_qy_v1_tts_cache_<code>). pycore sends codes already
     * ('en','zh'); full language names are mapped for safety (matches the
     * AppQyV1TableMaps name->code aliases).
     */
    private function normalizeLangCode(string $lang): string
    {
        $lang = strtolower(trim($lang));
        if ($lang === '') {
            return '';
        }

        $nameToCode = [
            'english' => 'en',
            'japanese' => 'ja',
            'korean' => 'ko',
            'vietnamese' => 'vi',
            'lao' => 'lo',
            'chinese' => 'zh',
        ];

        return $nameToCode[$lang] ?? $lang;
    }

    /**
     * Upsert segments on (source_key, seg_index) (fill-missing, never clobber).
     *
     * @return array ['created' => int, 'filled' => int]
     */
    private function ingestSegments(string $sourceKey, array $segments): array
    {
        $created = 0;
        $filled = 0;
        $allowed = [
            'start_sec', 'end_sec', 'mp4', 'full_mp4', 'mp3', 'sub_idx_start', 'sub_idx_end',
            'subtitle_count', 'clip_status', 'metadata',
        ];

        foreach ($segments as $segment) {
            if (!isset($segment['seg_index'])) {
                continue;
            }
            $segIndex = (int) $segment['seg_index'];
            $incoming = $this->pick($segment, $allowed);

            $existing = MediaSegment::where('source_key', $sourceKey)
                ->where('seg_index', $segIndex)
                ->first();

            if (!$existing) {
                $incoming['source_key'] = $sourceKey;
                $incoming['seg_index'] = $segIndex;
                MediaSegment::create($incoming);
                $created++;
                continue;
            }

            if ($this->mergeFill($existing, $incoming)) {
                $existing->save();
                $filled++;
            }
        }

        return ['created' => $created, 'filled' => $filled];
    }

    /**
     * Upsert the SHARED sentence library on sentence_id (computed server-side),
     * AND the positional source_sentences link on (source_type, source_key,
     * grain, seq). Both via the no-clobber mergeFill.
     *
     * @return array [
     *   'sentences'        => ['created' => int, 'filled' => int, 'deduped' => int],
     *   'source_sentences' => ['created' => int, 'filled' => int],
     * ]
     */
    private function ingestSentences(string $sourceType, string $sourceKey, array $sentences): array
    {
        $sCreated = 0;
        $sFilled = 0;
        $sDeduped = 0;
        $linkCreated = 0;
        $linkFilled = 0;

        // Shared-library fields the worker may provide on first insert. The AI
        // detail fields (explanation/ai_commentary/grammar/special_usage/audio)
        // are filled LATER and are mergeFill-protected on every subsequent pass.
        $sentenceAllowed = [
            'explanation', 'ai_commentary', 'grammar', 'special_usage', 'audio', 'metadata',
        ];
        // Positional link fields stored per source occurrence.
        $linkAllowed = [
            'seg_index', 'sub_idx', 'start_sec', 'end_sec', 'metadata',
        ];

        foreach ($sentences as $sentence) {
            $text = isset($sentence['text']) ? (string) $sentence['text'] : '';
            $language = isset($sentence['language']) ? (string) $sentence['language'] : '';
            if ($this->isEmptyValue($text)) {
                continue;
            }

            $sentenceId = self::computeSentenceId($text, $language);

            // ---- Shared sentence library (dedupe on sentence_id) ----
            $sentenceRow = Sentence::where('sentence_id', $sentenceId)->first();

            if (!$sentenceRow) {
                $incoming = $this->pick($sentence, $sentenceAllowed);
                $incoming['sentence_id'] = $sentenceId;
                $incoming['text'] = $text;
                $incoming['language'] = $language !== '' ? $language : 'english';
                $incoming['occurrence_count'] = 1;
                Sentence::create($incoming);
                $sCreated++;
            } else {
                // Duplicate: never overwrite text or AI fields; bump occurrence_count;
                // fill only currently-empty optional fields.
                $sDeduped++;
                $incoming = $this->pick($sentence, $sentenceAllowed);
                $changed = $this->mergeFill($sentenceRow, $incoming);
                $sentenceRow->occurrence_count = (int) $sentenceRow->occurrence_count + 1;
                $sentenceRow->save();
                if ($changed) {
                    $sFilled++;
                }
            }

            // ---- Positional link (one row per source occurrence/grain/seq) ----
            $grain = isset($sentence['grain']) ? (string) $sentence['grain'] : 'cue';
            $seq = isset($sentence['seq']) ? (int) $sentence['seq'] : 0;

            $linkIncoming = $this->pick($sentence, $linkAllowed);

            $existingLink = SourceSentence::where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where('grain', $grain)
                ->where('seq', $seq)
                ->first();

            if (!$existingLink) {
                $linkIncoming['source_type'] = $sourceType;
                $linkIncoming['source_key'] = $sourceKey;
                $linkIncoming['sentence_id'] = $sentenceId;
                $linkIncoming['grain'] = $grain;
                $linkIncoming['seq'] = $seq;
                SourceSentence::create($linkIncoming);
                $linkCreated++;
            } else {
                // Fill missing positional fields; never clobber. sentence_id is
                // filled only if the existing link somehow lacks it.
                if ($this->isEmptyValue($existingLink->getAttribute('sentence_id'))) {
                    $linkIncoming['sentence_id'] = $sentenceId;
                }
                if ($this->mergeFill($existingLink, $linkIncoming)) {
                    $existingLink->save();
                    $linkFilled++;
                }
            }
        }

        return [
            'sentences' => ['created' => $sCreated, 'filled' => $sFilled, 'deduped' => $sDeduped],
            'source_sentences' => ['created' => $linkCreated, 'filled' => $linkFilled],
        ];
    }

    /**
     * THE NO-CLOBBER MERGE.
     *
     * For each incoming column, set the value ONLY IF the incoming value is
     * non-empty AND the existing column is currently empty/null. An incoming
     * empty/missing value never overwrites an existing non-empty DB value.
     *
     * @param Model $model    The existing row to enrich.
     * @param array $incoming Incoming column => value pairs.
     * @return bool True if any field was filled.
     */
    private function mergeFill(Model $model, array $incoming): bool
    {
        $changed = false;

        foreach ($incoming as $column => $value) {
            // Skip empty/missing incoming values - never clobber with nothing.
            if ($this->isEmptyValue($value)) {
                continue;
            }

            // Only fill when the existing value is currently empty/null.
            $current = $model->getAttribute($column);
            if (!$this->isEmptyValue($current)) {
                continue;
            }

            $model->setAttribute($column, $value);
            $changed = true;
        }

        return $changed;
    }

    /**
     * Empty test: null, '', empty array, or 0 (treated as empty for the
     * fill-missing rule so a real value can later replace a default 0).
     */
    private function isEmptyValue($value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value) && trim($value) === '') {
            return true;
        }
        if (is_array($value) && count($value) === 0) {
            return true;
        }
        if (is_int($value) && $value === 0) {
            return true;
        }
        if (is_float($value) && $value === 0.0) {
            return true;
        }
        return false;
    }

    /**
     * Pick only the allowed keys from an incoming array.
     */
    private function pick(array $data, array $allowed): array
    {
        $result = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $data)) {
                $result[$key] = $data[$key];
            }
        }
        return $result;
    }

    /**
     * Compute the dedup key: sha1(normalize(text) + '|' + language).
     * Normalization: trim + collapse internal whitespace + lowercase.
     *
     * Public static so other ingestion paths into the shared sentence library
     * (e.g. vocabulary document extract-sentences) dedupe with the SAME key.
     */
    public static function computeSentenceId(string $text, string $language): string
    {
        $normalized = mb_strtolower(trim($text));
        $normalized = preg_replace('/\s+/u', ' ', $normalized);
        return sha1($normalized . '|' . mb_strtolower(trim($language)));
    }

    /**
     * Compute the v2 sentence content_id = md5(normalize(strip_punctuation(text))).
     *
     * Mirrors pycore/pyfoundations/punctuation_markers.py:
     *   - strip_punctuation: every Unicode punctuation (P*) / symbol (S*) char is
     *     replaced with a space (letters/digits/whitespace kept).
     *   - normalize: casefold (lowercase) + collapse all whitespace to single
     *     spaces + trim. NO language in the hash, so identical stripped text
     *     dedupes across languages.
     *
     * pycore normally sends content_id; this is the fallback / verifier so a
     * payload missing it still dedupes identically.
     */
    public static function computeContentId(string $text): string
    {
        $stripped = self::stripPunctuation($text);
        $normalized = mb_strtolower($stripped);
        $normalized = trim(preg_replace('/\s+/u', ' ', $normalized));
        return md5($normalized);
    }

    /**
     * Remove ALL punctuation/symbol characters, keeping letters/digits/space.
     * Unicode general categories P* (punctuation) and S* (symbol) become a
     * space; whitespace is preserved (collapsed by the caller). Mirrors
     * punctuation_markers.strip_punctuation().
     */
    public static function stripPunctuation(string $text): string
    {
        if ($text === '') {
            return '';
        }
        // \p{P} = punctuation, \p{S} = symbol (Unicode-aware). Replace with space.
        $out = preg_replace('/[\p{P}\p{S}]/u', ' ', $text);
        return $out === null ? $text : $out;
    }
}
