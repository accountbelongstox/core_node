<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangChapterModel as LangChapter;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MediaSegmentModel as MediaSegment;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MoviePoster\MoviePosterStore;
use App\Support\SentenceSegmenter;
use Illuminate\Support\Facades\Log;

/**
 * Idempotent v3 media ingestion with per-language sentence storage.
 * Existing values are preserved and only missing fields are filled.
 */
class MediaIngestService
{
    public const MODEL_VERSION = 3;

    /** Slots written per set-based chunk (bounds memory and statement size). */
    private const SLOT_CHUNK_SIZE = 500;
    private const SENTENCE_UPSERT_BATCH = 500;

    /** Source types whose text may carry glued verse numbers (contract verses option). */
    private const VERSE_SOURCE_TYPES = ['book', 'document'];

    /** Positional-link columns stored per slot occurrence. */
    private const SLOT_LINK_COLUMNS = ['seg_index', 'sub_idx', 'start_sec', 'end_sec', 'metadata'];

    public function __construct(private readonly MediaIngestPayload $payload)
    {
    }

    /**
     * Ingest a full media payload idempotently.
     *
     * The payload carries a chapter -> slot correspondence tree
     * (`chapters[]` + `slots[]`, model_version 3, the only shape pycore,
     * mcp-chrome and the Laravel importers send).
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
        $chapters = $payload['chapters'] ?? [];
        $slots = $payload['slots'] ?? [];

        $sourceKey = $sourceData['source_key'] ?? null;
        if (empty($sourceKey)) {
            throw new \InvalidArgumentException('source.source_key is required');
        }

        return SourceSentence::runInTransaction(function () use ($sourceType, $sourceKey, $sourceData, $segments, $chapters, $slots) {
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

            $posterResult = $this->applyPosterFromSource($sourceType, $sourceKey, $sourceData);

            return [
                'source_type' => $sourceType,
                'model_version' => self::MODEL_VERSION,
                'source_key' => $sourceKey,
                'source' => $sourceResult,
                'poster' => $posterResult,
                'segments' => $segmentResult,
                'chapters' => $chapterResult,
                'sentences' => $slotResult['sentences'],
                'source_sentences' => $slotResult['source_sentences'],
            ];
        });
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
                ? Subtitle::findBySourceKey($sourceKey)
                : Book::findBySourceKey($sourceKey);

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
        $incoming = $this->payload->pick($data, $allowed);

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

        $source = Subtitle::findBySourceKey($sourceKey);

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Subtitle::createRecord($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->payload->fillMissing($source, $incoming);
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
        $source->saveRecord();

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
        $incoming = $this->payload->pick($data, $allowed);
        if (isset($incoming['language'])) {
            $incoming['language'] = AppQyV1TableMaps::normalizeLangCode((string) $incoming['language']);
        }

        $source = Book::findBySourceKey($sourceKey);

        if (!$source) {
            $incoming['source_key'] = $sourceKey;
            $incoming['synced_at'] = now();
            Book::createRecord($incoming);
            return ['created' => true, 'filled' => false];
        }

        $changed = $this->payload->fillMissing($source, $incoming);
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
        $source->saveRecord();

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

                $existing = LangChapter::findForSourceIndex(
                    $langCode,
                    $sourceType,
                    $sourceKey,
                    $chapterIndex
                );

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
                    $row->saveRecord();
                    $created++;
                    continue;
                }

                $changed = false;
                if ($titleStr !== null && $this->payload->isEmpty($existing->getAttribute('title'))) {
                    $existing->setAttribute('title', $titleStr);
                    $changed = true;
                }
                if ($this->payload->isEmpty($existing->getAttribute('corr_id'))) {
                    $existing->setAttribute('corr_id', $corrId);
                    $changed = true;
                }
                if ($sentenceCount > 0 && (int) $existing->getAttribute('sentence_count') === 0) {
                    $existing->setAttribute('sentence_count', $sentenceCount);
                    $changed = true;
                }
                if ($metadata !== null && $this->payload->isEmpty($existing->getAttribute('metadata'))) {
                    $existing->setAttribute('metadata', $metadata);
                    $changed = true;
                }
                if ($changed) {
                    $existing->saveRecord();
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
     * Writes one source's slots (and their per-language sentences) through the
     * same set-based path as ingest(), in one transaction. Used by the verse
     * re-segmentation repair, which rebuilds a source's slots.
     *
     * @return array{sentences:array,source_sentences:array}
     */
    public function ingestSlots(string $sourceType, string $sourceKey, string $primaryLanguage, array $slots): array
    {
        return SourceSentence::runInTransaction(
            fn (): array => $this->ingestSlotsV3($sourceType, $sourceKey, ['language' => $primaryLanguage], $slots, false)
        );
    }

    /**
     * v3: Process the ordered correspondence slots set-based, one bounded
     * chunk at a time (a chunk never spans chapters and never repeats a slot
     * position). For each slot:
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
    private function ingestSlotsV3(string $sourceType, string $sourceKey, array $sourceData, array $slots, bool $countOccurrences = true): array
    {
        $totals = [
            'sentences' => ['created' => 0, 'filled' => 0, 'deduped' => 0],
            'source_sentences' => ['created' => 0, 'filled' => 0],
        ];
        $defaultPrimary = isset($sourceData['language']) ? $this->payload->normalizeLanguage((string) $sourceData['language']) : '';
        $chunk = [];
        $chunkKeys = [];
        $chunkChapter = null;

        foreach ($slots as $slot) {
            if (!is_array($slot)) {
                continue;
            }
            $plan = $this->planSlot($sourceType, $sourceKey, $defaultPrimary, $slot);
            $key = $plan['grain'] . ':' . $plan['seq'];
            if ($chunk !== [] && (
                count($chunk) >= self::SLOT_CHUNK_SIZE
                || $plan['chapter_index'] !== $chunkChapter
                || isset($chunkKeys[$key])
            )) {
                $totals = $this->addSlotTotals($totals, $this->flushSlotChunk($sourceType, $sourceKey, $chunk, $countOccurrences));
                $chunk = [];
                $chunkKeys = [];
            }
            $chunk[] = $plan;
            $chunkKeys[$key] = true;
            $chunkChapter = $plan['chapter_index'];
        }
        if ($chunk !== []) {
            $totals = $this->addSlotTotals($totals, $this->flushSlotChunk($sourceType, $sourceKey, $chunk, $countOccurrences));
        }

        return $totals;
    }

    /**
     * One slot's identity, positional link columns and per-language sentences.
     *
     * @return array{grain:string,seq:int,chapter_index:int,primary_language:string,corr_id:string,link:array,lang_content_ids:array<string,?string>,sentences:array<int,array{0:string,1:string,2:string}>}
     */
    private function planSlot(string $sourceType, string $sourceKey, string $defaultPrimary, array $slot): array
    {
        $grain = isset($slot['grain']) ? (string) $slot['grain'] : 'sentence';
        $seq = isset($slot['seq']) ? (int) $slot['seq'] : 0;
        $primaryLanguage = isset($slot['primary_language']) && !$this->payload->isEmpty($slot['primary_language'])
            ? $this->payload->normalizeLanguage((string) $slot['primary_language'])
            : $defaultPrimary;
        // Stable correspondence id per slot (recomputed if absent).
        $corrId = isset($slot['corr_id']) && !$this->payload->isEmpty($slot['corr_id'])
            ? (string) $slot['corr_id']
            : self::computeCorrId($sourceKey, $grain, $seq);
        $langs = isset($slot['langs']) && is_array($slot['langs']) ? $slot['langs'] : [];
        $langContentIds = [];
        $sentences = [];
        $rawText = '';
        $link = $this->payload->pick($slot, self::SLOT_LINK_COLUMNS);

        foreach ($langs as $lang => $text) {
            $langCode = $this->payload->normalizeLanguage((string) $lang);
            $textStr = is_string($text) ? $text : (is_scalar($text) ? (string) $text : '');
            if (in_array($sourceType, self::VERSE_SOURCE_TYPES, true) && SentenceSegmenter::hasVerseMarker($textStr)) {
                // A producer that still glues verse numbers to the text: the
                // numbers become slot structure and never reach the stored text
                // or its content_id (splitting is the producer's job).
                [$textStr, $link] = $this->withoutVerseMarkers($textStr, $link, $sourceKey, $seq);
            }
            if ($rawText === '' && !$this->payload->isEmpty($textStr)) {
                $rawText = $textStr;
            }
            if ($langCode === '' || !AppQyV1TableMaps::isLanguageSupported($langCode)) {
                continue;
            }
            if ($this->payload->isEmpty($textStr)) {
                // Slot exists but this language is empty (留空).
                $langContentIds[$langCode] = null;
                continue;
            }
            $langContentIds[$langCode] = self::computeContentId($textStr);
            $sentences[] = [$langCode, $langContentIds[$langCode], $textStr];
        }

        // Defense-in-depth: if EVERY language was dropped (e.g. an unsupported
        // code like "other") but the slot DID carry text, store it under a
        // supported fallback rather than leaving the line empty.
        if ($sentences === [] && $rawText !== '') {
            $fallbackLang = ($primaryLanguage !== '' && AppQyV1TableMaps::isLanguageSupported($primaryLanguage))
                ? $primaryLanguage : 'en';
            $langContentIds[$fallbackLang] = self::computeContentId($rawText);
            $sentences[] = [$fallbackLang, $langContentIds[$fallbackLang], $rawText];
            Log::warning('[MediaIngest] slot had only unsupported language codes; stored text under fallback', [
                'source_key' => $sourceKey, 'grain' => $grain, 'seq' => $seq,
                'dropped_langs' => array_keys($langs), 'fallback' => $fallbackLang,
            ]);
        }

        return [
            'grain' => $grain,
            'seq' => $seq,
            'chapter_index' => isset($slot['chapter_index']) ? (int) $slot['chapter_index'] : 0,
            'primary_language' => $primaryLanguage,
            'corr_id' => $corrId,
            'link' => $link,
            'lang_content_ids' => $langContentIds,
            'sentences' => $sentences,
        ];
    }

    /**
     * The text with its verse markers removed, and the first verse recorded in
     * the slot metadata (kept when the producer already set one).
     *
     * @return array{0:string,1:array}
     */
    private function withoutVerseMarkers(string $text, array $link, string $sourceKey, int $seq): array
    {
        $pieces = SentenceSegmenter::splitVerses($text);
        $verses = array_values(array_filter(array_column($pieces, 'verse'), static fn ($verse): bool => $verse !== null));
        $metadata = is_array($link['metadata'] ?? null) ? $link['metadata'] : [];

        if ($verses !== [] && !isset($metadata['verse'])) {
            $metadata['verse'] = $verses[0];
            $link['metadata'] = $metadata;
        }
        if (count(array_unique($verses)) > 1) {
            Log::warning('[MediaIngest] slot merges several verses; the producer must split them', [
                'source_key' => $sourceKey, 'seq' => $seq, 'verses' => $verses,
            ]);
        }

        return [implode(' ', array_column($pieces, 'text')), $link];
    }

    private function addSlotTotals(array $totals, array $chunk): array
    {
        foreach ($chunk as $table => $counts) {
            foreach ($counts as $name => $count) {
                $totals[$table][$name] += $count;
            }
        }

        return $totals;
    }

    /** Writes one chunk of slot plans: sentences per language, then the slot rows. */
    private function flushSlotChunk(string $sourceType, string $sourceKey, array $plans, bool $countOccurrences): array
    {
        $byLanguage = [];
        foreach ($plans as $plan) {
            foreach ($plan['sentences'] as [$langCode, $contentId, $text]) {
                $byLanguage[$langCode][] = [$contentId, $text, $plan['corr_id']];
            }
        }
        $sentences = ['created' => 0, 'filled' => 0, 'deduped' => 0];
        foreach ($byLanguage as $langCode => $occurrences) {
            foreach ($this->upsertLangSentences($langCode, $occurrences, $countOccurrences) as $name => $count) {
                $sentences[$name] += $count;
            }
        }

        return [
            'sentences' => $sentences,
            'source_sentences' => $this->upsertSlotLinks($sourceType, $sourceKey, $plans),
        ];
    }

    /**
     * Upserts sentence occurrences into the per-language table
     * {prefix}_sentences_{lang} by content_id in one statement per batch
     * (fill-missing, never clobber). A new content_id inserts with
     * occurrence_count = its occurrences and the first occurrence's corr_id;
     * an existing row adds its occurrences and backfills sentence_id/corr_id
     * only when empty. text/AI/audio are never clobbered. Without
     * $countOccurrences (a source rebuilt from its own slots) existing rows keep
     * their occurrence_count.
     *
     * @param array<int,array{0:string,1:string,2:string}> $occurrences [content_id, text, corr_id] in slot order
     * @return array ['created' => int, 'filled' => int, 'deduped' => int]
     */
    private function upsertLangSentences(string $langCode, array $occurrences, bool $countOccurrences = true): array
    {
        $model = LangSentence::for($langCode);
        $table = $model->getTable();
        $quotedTable = $model->getConnection()->getQueryGrammar()->wrapTable($table);
        $now = now();
        $rows = [];
        $stats = ['created' => 0, 'filled' => 0, 'deduped' => 0];

        foreach ($occurrences as [$contentId, $text, $corrId]) {
            if (isset($rows[$contentId])) {
                $rows[$contentId]['occurrence_count']++;
                continue;
            }
            $rows[$contentId] = [
                'content_id' => $contentId,
                'sentence_id' => self::computeSentenceId($text, $langCode),
                'corr_id' => $corrId,
                'text' => $text,
                'language' => $langCode,
                'occurrence_count' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        $existing = LangSentence::onLang($langCode)
            ->whereIn('content_id', array_keys($rows))
            ->get(['content_id', 'sentence_id', 'corr_id'])
            ->keyBy('content_id');
        foreach ($rows as $contentId => $row) {
            $current = $existing->get($contentId);
            if ($current === null) {
                $stats['created']++;
                $stats['deduped'] += $row['occurrence_count'] - 1;
                continue;
            }
            $stats['deduped'] += $row['occurrence_count'];
            if ($this->payload->isEmpty($current->getAttribute('sentence_id')) || $this->payload->isEmpty($current->getAttribute('corr_id'))) {
                $stats['filled']++;
            }
        }
        foreach (array_chunk(array_values($rows), self::SENTENCE_UPSERT_BATCH) as $batch) {
            $model->getConnection()->table($table)->upsert($batch, ['content_id'], ($countOccurrences ? [
                'occurrence_count' => $model->getConnection()->raw($quotedTable . '.occurrence_count + excluded.occurrence_count'),
            ] : []) + [
                'sentence_id' => $model->getConnection()->raw("COALESCE(NULLIF(btrim({$quotedTable}.sentence_id), ''), excluded.sentence_id)"),
                'corr_id' => $model->getConnection()->raw("COALESCE(NULLIF(btrim({$quotedTable}.corr_id), ''), excluded.corr_id)"),
                'updated_at' => $model->getConnection()->raw('excluded.updated_at'),
            ]);
        }

        return $stats;
    }

    /**
     * Upserts the language-independent slot rows of one chunk: new positions
     * in one insert per batch, existing ones fill-missing (saved only when
     * something changed).
     *
     * @return array ['created' => int, 'filled' => int]
     */
    private function upsertSlotLinks(string $sourceType, string $sourceKey, array $plans): array
    {
        $existing = [];
        $inserts = [];
        $now = now();
        $stats = ['created' => 0, 'filled' => 0];
        $seqsByGrain = [];

        foreach ($plans as $plan) {
            $seqsByGrain[$plan['grain']][] = $plan['seq'];
        }
        foreach ($seqsByGrain as $grain => $seqs) {
            foreach (SourceSentence::slotsAt($sourceType, $sourceKey, (string) $grain, $seqs) as $link) {
                $existing[$grain . ':' . (int) $link->seq] = $link;
            }
        }
        foreach ($plans as $plan) {
            $link = $existing[$plan['grain'] . ':' . $plan['seq']] ?? null;
            $incoming = $plan['link'];
            if ($link === null) {
                // No sentence_id on source_sentences (Books v3.1 §3.3): the
                // per-language link is carried entirely by lang_content_ids.
                $inserts[] = array_merge(array_fill_keys(self::SLOT_LINK_COLUMNS, null), $incoming, [
                    'source_type' => $sourceType,
                    'source_key' => $sourceKey,
                    'grain' => $plan['grain'],
                    'seq' => $plan['seq'],
                    'chapter_index' => $plan['chapter_index'],
                    'corr_id' => $plan['corr_id'],
                    'primary_language' => $plan['primary_language'] !== '' ? $plan['primary_language'] : null,
                    'lang_content_ids' => json_encode($plan['lang_content_ids']),
                    'metadata' => isset($incoming['metadata']) ? json_encode($incoming['metadata']) : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                continue;
            }
            // Fill-missing: never clobber existing values. Always refresh the
            // correspondence map so newly-checked languages are recorded
            // (lang_content_ids is a structured slot anchor, not enrich data).
            if ($this->payload->isEmpty($link->getAttribute('corr_id'))) {
                $incoming['corr_id'] = $plan['corr_id'];
            }
            if ($this->payload->isEmpty($link->getAttribute('primary_language')) && $plan['primary_language'] !== '') {
                $incoming['primary_language'] = $plan['primary_language'];
            }
            if ($this->payload->isEmpty($link->getAttribute('chapter_index')) && $plan['chapter_index'] !== 0) {
                $incoming['chapter_index'] = $plan['chapter_index'];
            }
            $changed = $this->payload->fillMissing($link, $incoming);
            $changed = $this->mergeLangContentIds($link, $plan['lang_content_ids']) || $changed;
            if ($changed) {
                $link->saveRecord();
                $stats['filled']++;
            }
        }
        foreach (array_chunk($inserts, self::SENTENCE_UPSERT_BATCH) as $batch) {
            SourceSentence::insertLinks($batch);
            $stats['created'] += count($batch);
        }

        return $stats;
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
            $incoming = $this->payload->pick($segment, $allowed);

            $existing = MediaSegment::findForSourceIndex($sourceKey, $segIndex);

            if (!$existing) {
                $incoming['source_key'] = $sourceKey;
                $incoming['seg_index'] = $segIndex;
                MediaSegment::createRecord($incoming);
                $created++;
                continue;
            }

            if ($this->payload->fillMissing($existing, $incoming)) {
                $existing->saveRecord();
                $filled++;
            }
        }

        return ['created' => $created, 'filled' => $filled];
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
