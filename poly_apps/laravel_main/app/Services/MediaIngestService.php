<?php

namespace App\Services;

use App\Models\Subtitle;
use App\Models\Book;
use App\Models\LangSentence;
use App\Models\LangChapter;
use App\Models\SourceSentence;
use App\Models\MediaSegment;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Providers\AppTablePrefixServiceProvider;
use App\Constants\AppKeys;
use App\Services\MoviePoster\MoviePosterStore;
use Illuminate\Support\Facades\Log;

/**
 * Media Ingest Service (Books v3.1 unified per-language model).
 *
 * Idempotent ingestion of pycore media data. ALL ingest versions are folded into
 * ONE per-language model (BOOKS_FEATURE_SPECIFICATION.md §3.4):
 *   - subtitles        (source_type = 'subtitle')  keyed on source_key
 *   - books            (source_type = 'book')      keyed on source_key
 *   - sentences_{lang}  per-language sentence store keyed on content_id
 *   - chapters_{lang}   per-language chapter store  (source_type,source_key,chapter_index)
 *   - source_sentences  language-independent positional slot (lang_content_ids)
 *   - media_segments    (subtitle only)            keyed on (source_key, seg_index)
 *
 * Every `language` value is a CODE (§2). The shared {prefix}_sentences and single
 * {prefix}_chapters tables are removed; v1 (subtitle list) and v2 (book) payloads
 * are converted to the v3 chapter -> slot shape on the way in.
 *
 * THE CRITICAL IDEMPOTENCY RULE: FILL-MISSING, NEVER CLOBBER. mergeFill() only
 * writes an incoming column when the incoming value is non-empty AND the existing
 * column is currently empty/null. Duplicate sentences (same content_id) are not
 * re-written: text + AI detail fields are never clobbered; occurrence_count is
 * bumped; only missing fields are filled.
 */
class MediaIngestService
{
    /**
     * Ingest a full media payload idempotently.
     *
     * v3 (model_version>=3): payload carries a chapter -> slot correspondence tree
     * (`chapters[]` + `slots[]`). v1/v2 payloads (a flat `sentences[]` list, with
     * an optional `words` map for books) are converted to the same v3 shape so a
     * single per-language code path persists everything.
     *
     * @param array $payload
     * @return array Summary of created/filled/deduped counts per table.
     */
    public function ingest(array $payload): array
    {
        $sourceType = $payload['source_type'] ?? null;
        // ONE shared multi-language sentence library (§1.1): every source type maps
        // its sentences through this single per-language v3 path.
        if (!in_array($sourceType, ['subtitle', 'book', 'document', 'article'], true)) {
            throw new \InvalidArgumentException("source_type must be one of: subtitle, book, document, article");
        }

        $sourceData = $payload['source'] ?? [];
        $segments = $payload['segments'] ?? [];
        $sentences = $payload['sentences'] ?? [];
        $words = $payload['words'] ?? [];
        $chapters = $payload['chapters'] ?? [];
        $slots = $payload['slots'] ?? [];
        $modelVersion = isset($payload['model_version']) ? (int) $payload['model_version'] : 1;

        $sourceKey = $sourceData['source_key'] ?? null;
        if (empty($sourceKey)) {
            throw new \InvalidArgumentException('source.source_key is required');
        }

        // Fold v1/v2 (flat sentences[]) into the v3 chapter -> slot shape so there
        // is exactly one per-language persistence path. v3 payloads pass through.
        if ($modelVersion < 3) {
            [$chapters, $slots] = $this->convertLegacyToV3($sourceType, $sourceKey, $sourceData, $sentences);
        }

        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

        return DB::connection($connection)->transaction(function () use ($sourceType, $sourceKey, $sourceData, $segments, $chapters, $slots, $words, $modelVersion) {
            // Per-type source-row upsert. book/subtitle own a dedicated source
            // table; document/article keep their body in their OWN store
            // (AppQyV1UploadedDocumentModel / the articles table), so there is no
            // dedicated source-row step here — they ONLY map sentences into the
            // shared per-language library through the same v3 path below.
            switch ($sourceType) {
                case 'subtitle':
                    $sourceResult = $this->ingestSubtitle($sourceKey, $sourceData);
                    break;
                case 'book':
                    $sourceResult = $this->ingestBookSource($sourceKey, $sourceData);
                    break;
                default:
                    // document | article: source-of-truth body lives elsewhere.
                    $sourceResult = ['created' => false, 'filled' => false, 'external_source' => true];
                    break;
            }

            $segmentResult = $sourceType === 'subtitle'
                ? $this->ingestSegments($sourceKey, $segments)
                : ['created' => 0, 'filled' => 0];

            $chapterResult = $this->ingestChapters($sourceType, $sourceKey, $sourceData, $chapters);
            $slotResult = $this->ingestSlotsV3($sourceType, $sourceKey, $sourceData, $slots);

            // Book word dictionaries (v2/v3): per-language tts_cache upsert.
            $wordResult = (is_array($words) && count($words) > 0)
                ? $this->ingestWordsV2($words)
                : ['languages' => 0, 'created' => 0, 'existing' => 0];

            $posterResult = $this->applyPosterFromSource($sourceType, $sourceKey, $sourceData);

            return [
                'source_type' => $sourceType,
                'model_version' => max(3, $modelVersion),
                'source_key' => $sourceKey,
                'source' => $sourceResult,
                'poster' => $posterResult,
                'segments' => $segmentResult,
                'chapters' => $chapterResult,
                'sentences' => $slotResult['sentences'],
                'source_sentences' => $slotResult['source_sentences'],
                'words' => $wordResult,
            ];
        });
    }

    /**
     * Convert a legacy v1/v2 flat sentences[] list into the v3 chapter -> slot
     * shape. Each legacy sentence becomes one slot whose `langs` map fills only
     * the sentence's own (normalized) language code. A single default chapter
     * (chapter_index 0) is emitted with the source primary-language title.
     *
     * @param array<int, array> $sentences
     * @return array{0: array<int, array>, 1: array<int, array>} [chapters, slots]
     */
    private function convertLegacyToV3(string $sourceType, string $sourceKey, array $sourceData, array $sentences): array
    {
        $primary = isset($sourceData['language'])
            ? AppQyV1TableMaps::normalizeLangCode((string) $sourceData['language'])
            : '';

        $slots = [];
        $maxChapterIndex = 0;
        foreach ($sentences as $sentence) {
            if (!is_array($sentence)) {
                continue;
            }
            $text = isset($sentence['text']) ? (string) $sentence['text'] : '';
            if ($this->isEmptyValue($text)) {
                continue;
            }
            $lang = isset($sentence['language']) && $sentence['language'] !== ''
                ? AppQyV1TableMaps::normalizeLangCode((string) $sentence['language'])
                : $primary;
            if ($lang === '') {
                $lang = 'en';
            }

            $grain = isset($sentence['grain']) ? (string) $sentence['grain'] : ($sourceType === 'subtitle' ? 'cue' : 'sentence');
            $seq = isset($sentence['seq']) ? (int) $sentence['seq'] : 0;
            $chapterIndex = isset($sentence['chapter_index']) ? (int) $sentence['chapter_index'] : 0;
            if ($chapterIndex > $maxChapterIndex) {
                $maxChapterIndex = $chapterIndex;
            }

            $slots[] = [
                'chapter_index' => $chapterIndex,
                'grain' => $grain,
                'seq' => $seq,
                'primary_language' => $primary !== '' ? $primary : $lang,
                'langs' => [$lang => $text],
                'seg_index' => $sentence['seg_index'] ?? null,
                'sub_idx' => $sentence['sub_idx'] ?? null,
                'start_sec' => $sentence['start_sec'] ?? null,
                'end_sec' => $sentence['end_sec'] ?? null,
            ];
        }

        // Single default chapter spanning the source (chapter_index 0). For a
        // multi-chapter legacy payload (chapter_index set on slots) emit one
        // default-titled chapter per distinct index seen.
        $chapters = [];
        for ($i = 0; $i <= $maxChapterIndex; $i++) {
            $title = $i === 0 ? 'Chapter 1' : ('Chapter ' . ($i + 1));
            $chapters[] = [
                'chapter_index' => $i,
                'titles' => $primary !== '' ? [$primary => $title] : ['en' => $title],
            ];
        }

        return [$chapters, $slots];
    }

    /**
     * Decode and store an optional pycore ingest poster payload
     * (source.poster) for the just-upserted Book / Subtitle row.
     *
     * Movie/TV Poster Pipeline (docs/MOVIE_POSTER_PIPELINE.md §4):
     * pycore is the primary fetcher and ships poster bytes inside source.poster
     * (provider/source_id/mime/image_base64/meta). When present we decode +
     * save the local file and set the poster_* columns (fill-missing — a row
     * already poster_status='ready' is left untouched). When absent the row
     * keeps its default poster_status='pending' so the PHP on-demand fetch can
     * backfill later. Never throws — a poster failure must not fail the ingest.
     *
     * @return array{status:string,applied?:bool,already_done?:bool,error?:string}
     */
    private function applyPosterFromSource(string $sourceType, string $sourceKey, array $data): array
    {
        $poster = $data['poster'] ?? null;
        if (!is_array($poster) || count($poster) === 0) {
            return ['status' => 'pending', 'applied' => false];
        }

        try {
            $model = $sourceType === 'subtitle'
                ? Subtitle::where('source_key', $sourceKey)->first()
                : Book::where('source_key', $sourceKey)->first();

            if (!$model) {
                return ['status' => 'pending', 'applied' => false, 'error' => 'source row not found'];
            }

            $store = app(MoviePosterStore::class);
            $result = $store->applyIngestPayload($model, $poster);

            return [
                'status' => $result['status'] ?? 'pending',
                'applied' => (bool) ($result['ok'] ?? false),
                'already_done' => (bool) ($result['already_done'] ?? false),
                'error' => $result['error'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('[MediaIngest] Poster ingest failed', [
                'source_key' => $sourceKey,
                'error' => $e->getMessage(),
            ]);
            return ['status' => 'pending', 'applied' => false, 'error' => $e->getMessage()];
        }
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

        // Normalize the primary language to a code (§2).
        if (isset($incoming['language'])) {
            $incoming['language'] = AppQyV1TableMaps::normalizeLangCode((string) $incoming['language']);
        }

        // Books/Subtitles v3.1 §12.2: persist the checked correspondence
        // languages (codes, deduped, primary auto-included) when the payload
        // carries them. Only set when non-empty so mergeFill never clobbers.
        if (array_key_exists('selected_languages', $data)) {
            $selected = $this->selectedLanguages($data);
            if (!empty($selected)) {
                $incoming['selected_languages'] = $selected;
            }
        }

        $source = Subtitle::where('source_key', $sourceKey)->first();

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Subtitle::create($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->mergeFill($source, $incoming);
        // `title` is pycore-authoritative (the canonical ENGLISH display title — CJK
        // filenames are translated upstream). Refresh it on re-sync even when already
        // present, so legacy raw-CJK titles update to English. Other columns remain
        // fill-missing via mergeFill.
        if (!empty($incoming['title']) && $source->getAttribute('title') !== $incoming['title']
            && preg_match('/[A-Za-z]/', (string) $incoming['title'])) {
            // Only refresh to a title that carries Latin letters (a real translated
            // English title) — a transient translation failure falls back to the
            // cleaned CJK, which must NOT downgrade an already-English title.
            $source->setAttribute('title', $incoming['title']);
            $changed = true;
        }
        $source->synced_at = now();
        $source->save();

        return ['created' => false, 'filled' => $changed];
    }

    /**
     * Upsert the book source row on source_key (fill-missing, never clobber).
     * Accepts both the base book columns and the v2/v3 columns
     * content_id / sentence_seq / word_ids. The `language` value is normalized
     * to a code (§2).
     *
     * @return array ['created' => bool, 'filled' => bool]
     */
    private function ingestBookSource(string $sourceKey, array $data): array
    {
        $allowed = [
            'content_id', 'title', 'original_name', 'ascii_name', 'language',
            'full_content', 'audio', 'sentence_seq', 'word_ids',
            'sentence_count', 'metadata',
        ];
        $incoming = $this->pick($data, $allowed);
        if (isset($incoming['language'])) {
            $incoming['language'] = AppQyV1TableMaps::normalizeLangCode((string) $incoming['language']);
        }

        $source = Book::where('source_key', $sourceKey)->first();

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Book::create($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->mergeFill($source, $incoming);
        // `title` is pycore-authoritative (canonical ENGLISH display title); refresh
        // on re-sync even when present so legacy raw-CJK titles update. Others stay
        // fill-missing.
        if (!empty($incoming['title']) && $source->getAttribute('title') !== $incoming['title']
            && preg_match('/[A-Za-z]/', (string) $incoming['title'])) {
            // Only refresh to a title that carries Latin letters (a real translated
            // English title) — a transient translation failure falls back to the
            // cleaned CJK, which must NOT downgrade an already-English title.
            $source->setAttribute('title', $incoming['title']);
            $changed = true;
        }
        $source->synced_at = now();
        $source->save();

        return ['created' => false, 'filled' => $changed];
    }

    /**
     * Upsert per-language chapter rows (Books v3.1 §3.2/§7). Each incoming
     * chapter carries a `titles: {code: title|null}` map; for EVERY selected
     * language we upsert a row into {prefix}_chapters_{lang} on
     * (source_type, source_key, chapter_index), with the per-language title (or
     * null/留空) and corr_id = sha1(source_key . '|chapter|' . chapter_index).
     * Fill-missing, never clobber. Chapters arrive only in the first chunk.
     *
     * @return array ['created' => int, 'filled' => int]
     */
    private function ingestChapters(string $sourceType, string $sourceKey, array $sourceData, array $chapters): array
    {
        $created = 0;
        $filled = 0;

        $selected = $this->selectedLanguages($sourceData);

        foreach ($chapters as $chapter) {
            if (!is_array($chapter)) {
                continue;
            }
            $chapterIndex = isset($chapter['chapter_index']) ? (int) $chapter['chapter_index'] : 0;
            $sentenceCount = isset($chapter['sentence_count']) ? (int) $chapter['sentence_count'] : 0;
            $metadata = isset($chapter['metadata']) && is_array($chapter['metadata']) ? $chapter['metadata'] : null;
            $corrId = self::computeChapterCorrId($sourceKey, $chapterIndex);

            // Per-language title map (codes). Legacy single 'title' folds into the
            // source primary language.
            $titles = [];
            if (isset($chapter['titles']) && is_array($chapter['titles'])) {
                foreach ($chapter['titles'] as $code => $title) {
                    $titles[AppQyV1TableMaps::normalizeLangCode((string) $code)] = $title;
                }
            } elseif (isset($chapter['title'])) {
                $primary = isset($sourceData['language']) ? AppQyV1TableMaps::normalizeLangCode((string) $sourceData['language']) : 'en';
                $titles[$primary !== '' ? $primary : 'en'] = $chapter['title'];
            }

            // Upsert a row for EVERY selected language; languages without a title
            // get a null-title row (留空) so the chapter slot still exists.
            foreach ($selected as $langCode) {
                if ($langCode === '' || !AppQyV1TableMaps::isLanguageSupported($langCode)) {
                    continue;
                }
                $title = array_key_exists($langCode, $titles) ? $titles[$langCode] : null;
                $titleStr = (is_string($title) && trim($title) !== '') ? $title : null;

                $existing = LangChapter::onLang($langCode)
                    ->where('source_type', $sourceType)
                    ->where('source_key', $sourceKey)
                    ->where('chapter_index', $chapterIndex)
                    ->first();

                if (!$existing) {
                    $row = LangChapter::for($langCode);
                    $row->fill([
                        'source_type' => $sourceType,
                        'source_key' => $sourceKey,
                        'chapter_index' => $chapterIndex,
                        'language' => $langCode,
                        'title' => $titleStr,
                        'corr_id' => $corrId,
                        'sentence_count' => $sentenceCount,
                        'metadata' => $metadata,
                    ]);
                    $row->save();
                    $created++;
                    continue;
                }

                $changed = false;
                if ($titleStr !== null && $this->isEmptyValue($existing->getAttribute('title'))) {
                    $existing->setAttribute('title', $titleStr);
                    $changed = true;
                }
                if ($this->isEmptyValue($existing->getAttribute('corr_id'))) {
                    $existing->setAttribute('corr_id', $corrId);
                    $changed = true;
                }
                if ($sentenceCount > 0 && (int) $existing->getAttribute('sentence_count') === 0) {
                    $existing->setAttribute('sentence_count', $sentenceCount);
                    $changed = true;
                }
                if ($metadata !== null && $this->isEmptyValue($existing->getAttribute('metadata'))) {
                    $existing->setAttribute('metadata', $metadata);
                    $changed = true;
                }
                if ($changed) {
                    $existing->save();
                    $filled++;
                }
            }
        }

        return ['created' => $created, 'filled' => $filled];
    }

    /**
     * The selected correspondence languages (codes) for a source: the payload's
     * source.selected_languages when present, always including the normalized
     * primary language; falls back to just the primary (or 'en').
     *
     * @return array<int, string>
     */
    private function selectedLanguages(array $sourceData): array
    {
        $out = [];
        $primary = isset($sourceData['language']) ? AppQyV1TableMaps::normalizeLangCode((string) $sourceData['language']) : '';
        if ($primary !== '') {
            $out[] = $primary;
        }
        $sel = isset($sourceData['selected_languages']) && is_array($sourceData['selected_languages'])
            ? $sourceData['selected_languages']
            : [];
        foreach ($sel as $lang) {
            $code = AppQyV1TableMaps::normalizeLangCode((string) $lang);
            if ($code !== '' && !in_array($code, $out, true)) {
                $out[] = $code;
            }
        }
        if (empty($out)) {
            $out[] = 'en';
        }
        return $out;
    }

    /**
     * v3: Process the ordered correspondence slots. For each slot:
     *   - for every language with non-null text: upsert the per-language
     *     sentence table {prefix}_sentences_{lang} by content_id (fill-missing,
     *     never clobber, bump occurrence_count) and record content_id;
     *   - empty/missing languages stay null in lang_content_ids (留空);
     *   - upsert the language-independent source_sentences slot row carrying
     *     chapter_index / corr_id / primary_language / lang_content_ids.
     *
     * @return array [
     *   'sentences'        => ['created' => int, 'filled' => int, 'deduped' => int],
     *   'source_sentences' => ['created' => int, 'filled' => int],
     * ]
     */
    private function ingestSlotsV3(string $sourceType, string $sourceKey, array $sourceData, array $slots): array
    {
        $sCreated = 0;
        $sFilled = 0;
        $sDeduped = 0;
        $linkCreated = 0;
        $linkFilled = 0;

        $defaultPrimary = isset($sourceData['language']) ? $this->normalizeLangCode((string) $sourceData['language']) : '';

        // Positional-link columns stored per slot occurrence.
        $linkAllowed = ['seg_index', 'sub_idx', 'start_sec', 'end_sec', 'metadata'];

        foreach ($slots as $slot) {
            if (!is_array($slot)) {
                continue;
            }

            $grain = isset($slot['grain']) ? (string) $slot['grain'] : 'sentence';
            $seq = isset($slot['seq']) ? (int) $slot['seq'] : 0;
            $chapterIndex = isset($slot['chapter_index']) ? (int) $slot['chapter_index'] : 0;
            $primaryLanguage = isset($slot['primary_language']) && !$this->isEmptyValue($slot['primary_language'])
                ? $this->normalizeLangCode((string) $slot['primary_language'])
                : $defaultPrimary;

            // Stable correspondence id per slot (recomputed if absent).
            $corrId = isset($slot['corr_id']) && !$this->isEmptyValue($slot['corr_id'])
                ? (string) $slot['corr_id']
                : self::computeCorrId($sourceKey, $grain, $seq);

            $langs = isset($slot['langs']) && is_array($slot['langs']) ? $slot['langs'] : [];

            // Per-language content map for this slot; null = empty correspondence.
            $langContentIds = [];
            foreach ($langs as $lang => $text) {
                $langCode = $this->normalizeLangCode((string) $lang);
                if ($langCode === '' || !AppQyV1TableMaps::isLanguageSupported($langCode)) {
                    continue;
                }

                $textStr = is_string($text) ? $text : (is_scalar($text) ? (string) $text : '');
                if ($this->isEmptyValue($textStr)) {
                    // Slot exists but this language is empty (留空).
                    $langContentIds[$langCode] = null;
                    continue;
                }

                $contentId = self::computeContentId($textStr);
                $langContentIds[$langCode] = $contentId;

                $stat = $this->upsertLangSentence($langCode, $contentId, $textStr, $corrId);
                $sCreated += $stat['created'];
                $sFilled += $stat['filled'];
                $sDeduped += $stat['deduped'];
            }

            // Defense-in-depth: if EVERY language was dropped (e.g. upstream sent an
            // unsupported code like "other" from a script the source-side guesser
            // couldn't map) but the slot DID carry text, store it under a supported
            // fallback rather than leaving the line empty. Without this, a single bad
            // language code silently renders the line as a timestamp with no text.
            $hasContent = false;
            foreach ($langContentIds as $cid) {
                if ($cid !== null) { $hasContent = true; break; }
            }
            if (!$hasContent) {
                $rawText = '';
                foreach ($langs as $candidate) {
                    $cand = is_string($candidate) ? $candidate : (is_scalar($candidate) ? (string) $candidate : '');
                    if (!$this->isEmptyValue($cand)) { $rawText = $cand; break; }
                }
                if ($rawText !== '') {
                    $fallbackLang = ($primaryLanguage !== '' && AppQyV1TableMaps::isLanguageSupported($primaryLanguage))
                        ? $primaryLanguage : 'en';
                    $contentId = self::computeContentId($rawText);
                    $langContentIds[$fallbackLang] = $contentId;
                    $stat = $this->upsertLangSentence($fallbackLang, $contentId, $rawText, $corrId);
                    $sCreated += $stat['created'];
                    $sFilled += $stat['filled'];
                    $sDeduped += $stat['deduped'];
                    Log::warning('[MediaIngest] slot had only unsupported language codes; stored text under fallback', [
                        'source_key' => $sourceKey, 'grain' => $grain, 'seq' => $seq,
                        'dropped_langs' => array_keys($langs), 'fallback' => $fallbackLang,
                    ]);
                }
            }

            // ---- Language-independent positional slot row ----
            $linkIncoming = $this->pick($slot, $linkAllowed);

            $existingLink = SourceSentence::where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where('grain', $grain)
                ->where('seq', $seq)
                ->first();

            if (!$existingLink) {
                $linkIncoming['source_type'] = $sourceType;
                $linkIncoming['source_key'] = $sourceKey;
                // No sentence_id on source_sentences (Books v3.1 §3.3): the
                // per-language link is carried entirely by lang_content_ids.
                $linkIncoming['grain'] = $grain;
                $linkIncoming['seq'] = $seq;
                $linkIncoming['chapter_index'] = $chapterIndex;
                $linkIncoming['corr_id'] = $corrId;
                $linkIncoming['primary_language'] = $primaryLanguage !== '' ? $primaryLanguage : null;
                $linkIncoming['lang_content_ids'] = $langContentIds;
                SourceSentence::create($linkIncoming);
                $linkCreated++;
            } else {
                // Fill-missing: never clobber existing values. Always refresh the
                // correspondence map so newly-checked languages are recorded
                // (lang_content_ids is a structured slot anchor, not enrich data).
                if ($this->isEmptyValue($existingLink->getAttribute('corr_id'))) {
                    $linkIncoming['corr_id'] = $corrId;
                }
                if ($this->isEmptyValue($existingLink->getAttribute('primary_language')) && $primaryLanguage !== '') {
                    $linkIncoming['primary_language'] = $primaryLanguage;
                }
                if ($this->isEmptyValue($existingLink->getAttribute('chapter_index')) && $chapterIndex !== 0) {
                    $linkIncoming['chapter_index'] = $chapterIndex;
                }
                $changed = $this->mergeFill($existingLink, $linkIncoming);
                $changed = $this->mergeLangContentIds($existingLink, $langContentIds) || $changed;
                if ($changed) {
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
     * Upsert one sentence into the per-language table {prefix}_sentences_{lang}
     * by content_id (fill-missing, never clobber). New rows insert with
     * occurrence_count=1; existing rows bump occurrence_count and backfill
     * corr_id only when currently empty. text/AI/audio are never clobbered.
     *
     * @return array ['created' => int, 'filled' => int, 'deduped' => int]
     */
    private function upsertLangSentence(string $langCode, string $contentId, string $text, string $corrId): array
    {
        $created = 0;
        $filled = 0;
        $deduped = 0;

        $sentenceId = self::computeSentenceId($text, $langCode);

        $row = LangSentence::onLang($langCode)->where('content_id', $contentId)->first();

        if (!$row) {
            $model = LangSentence::for($langCode);
            $model->fill([
                'content_id' => $contentId,
                'sentence_id' => $sentenceId,
                'corr_id' => $corrId,
                'text' => $text,
                'language' => $langCode,
                'occurrence_count' => 1,
            ]);
            $model->save();
            $created++;
            return ['created' => $created, 'filled' => $filled, 'deduped' => $deduped];
        }

        // Duplicate: never overwrite text/AI/audio; bump occurrence_count; fill
        // only currently-empty anchors (sentence_id / corr_id).
        $deduped++;
        $changed = false;
        if ($this->isEmptyValue($row->getAttribute('sentence_id'))) {
            $row->setAttribute('sentence_id', $sentenceId);
            $changed = true;
        }
        if ($this->isEmptyValue($row->getAttribute('corr_id'))) {
            $row->setAttribute('corr_id', $corrId);
            $changed = true;
        }
        $row->occurrence_count = (int) $row->occurrence_count + 1;
        $row->save();
        if ($changed) {
            $filled++;
        }

        return ['created' => $created, 'filled' => $filled, 'deduped' => $deduped];
    }

    /**
     * Merge a slot's per-language content map into an existing source_sentences
     * row WITHOUT clobbering already-recorded (non-null) language ids; newly
     * checked languages are added. Returns true if the stored map changed.
     */
    private function mergeLangContentIds(SourceSentence $link, array $incoming): bool
    {
        $current = $link->getAttribute('lang_content_ids');
        if (!is_array($current)) {
            $current = [];
        }

        $changed = false;
        foreach ($incoming as $lang => $contentId) {
            $haveExisting = array_key_exists($lang, $current) && !empty($current[$lang]);
            if ($haveExisting) {
                continue;
            }
            // Record a newly-resolved id, or add the slot/null placeholder so the
            // FE renders a blank for a newly-checked-but-empty language.
            if (!array_key_exists($lang, $current) || $current[$lang] !== $contentId) {
                $current[$lang] = $contentId;
                $changed = true;
            }
        }

        if ($changed) {
            $link->setAttribute('lang_content_ids', $current);
        }
        return $changed;
    }

    /**
     * v2/v3: Upsert each distinct word into its per-language TTS-cache dictionary
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
     * Normalize a language key to the canonical 2/3-letter code (delegates to
     * the single source of truth, AppQyV1TableMaps::normalizeLangCode — §2).
     */
    private function normalizeLangCode(string $lang): string
    {
        return AppQyV1TableMaps::normalizeLangCode($lang);
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
     * Compute the v3 correspondence group id for a slot:
     *   corr_id = sha1(source_key . '|' . grain . '|' . seq)  (stable per slot).
     * All per-language rows for one slot share this id so the FE can render
     * every checked language side by side (BOOKS_FEATURE_SPECIFICATION.md §5).
     * pycore normally sends corr_id; this is the fallback / verifier.
     */
    public static function computeCorrId(string $sourceKey, string $grain, int $seq): string
    {
        return sha1($sourceKey . '|' . $grain . '|' . $seq);
    }

    /**
     * Compute the cross-language chapter correspondence id:
     *   corr_id = sha1(source_key . '|chapter|' . chapter_index)
     * (BOOKS_FEATURE_SPECIFICATION.md §3.2/§7). The same chapter_index across the
     * per-language chapter tables shares this id.
     */
    public static function computeChapterCorrId(string $sourceKey, int $chapterIndex): string
    {
        return sha1($sourceKey . '|chapter|' . $chapterIndex);
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
