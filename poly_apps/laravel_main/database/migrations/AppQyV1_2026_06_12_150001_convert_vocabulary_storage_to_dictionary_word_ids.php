<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;

/**
 * Vocabulary storage consolidation - Wave A, step 2 (data conversion).
 *
 * Makes the per-language dictionary tables (app_qy_v1_tts_cache_{lang}) the
 * ONLY word store:
 *  a. Each vocabulary_libraries row gets word_ids built from its
 *     vocabulary_words rows (word_index order, deduped by normalized
 *     lowercase text, resolved/created in tts_cache_{lang} by md5(content)).
 *  b. vocabulary_covers rows are folded into the cover_* columns added by
 *     AppQyV1_2026_06_12_150000.
 *  c. vocabulary_collections (deleted_at NULL) are merged into
 *     vocabulary_libraries. Collections that parallel an existing library
 *     (collection_name == library.source, same language) are only MAPPED,
 *     not duplicated. Others become new library rows with word_ids built
 *     from their vocabulary_items.
 *  d. group_words.word_id and user_word_progress.word_id (both historically
 *     vocabulary_items.id, despite the old migration comments claiming
 *     vocabulary_words) are re-pointed to dictionary ids; language_code is
 *     backfilled from the item. Collisions created by the remap are deduped
 *     (group_words: keep lowest id; progress: keep greatest
 *     (review_count, read_count, proficiency)).
 *  e. Everything is verified BEFORE commit; any mismatch throws and rolls
 *     the whole conversion back. Table drops live in ..._150002 only.
 *
 * Whole conversion runs in ONE transaction on the app connection.
 * NOTE: the remap uses a two-phase sign flip (word_id = -dict_id, then
 * negate) so chunked updates can never transiently violate
 * unique(group_id, word_id) / unique(user_id, word_id, group_id). This is
 * valid on pgsql/sqlite (plain signed BIGINT); the project runs PostgreSQL.
 */
return new class extends Migration
{
    private const CHUNK = 1000;
    private const READ_CHUNK = 5000;

    protected $connection;
    protected $appKey;
    protected $prefix;

    private array $stats = [
        'libraries_converted' => 0,
        'libraries_skipped_existing_word_ids' => 0,
        'dictionary_rows_created' => 0,
        'covers_folded' => 0,
        'collections_mapped_to_existing' => 0,
        'collections_new_libraries' => 0,
        'group_words_remapped' => 0,
        'group_words_collisions_deleted' => 0,
        'progress_remapped' => 0,
        'progress_collisions_deleted' => 0,
        'documents_remapped' => 0,
        'selected_libraries_remapped' => 0,
    ];

    /** library id => number of source vocabulary_words rows (for verification) */
    private array $librarySourceCounts = [];

    /** collection id => library id */
    private array $collectionToLibrary = [];

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->prefix = AppTablePrefixServiceProvider::getPrefix($this->appKey);
    }

    private function t(string $suffix): string
    {
        return $this->prefix . '_' . $suffix;
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (!$schema->hasColumn($this->t('vocabulary_libraries'), 'word_ids')) {
            throw new RuntimeException('word_ids column missing - run AppQyV1_2026_06_12_150000 first');
        }

        if (!$schema->hasTable($this->t('vocabulary_words'))
            || !$schema->hasTable($this->t('vocabulary_items'))
            || !$schema->hasTable($this->t('vocabulary_collections'))) {
            echo "[convert] legacy tables already dropped - nothing to convert\n";
            return;
        }

        $db = DB::connection($this->connection);

        $pendingLibraries = $db->table($this->t('vocabulary_libraries'))->whereNull('word_ids')->count();
        $pendingRemap = $db->table($this->t('group_words') . ' as gw')
            ->join($this->t('vocabulary_items') . ' as vi', 'vi.id', '=', 'gw.word_id')
            ->count();
        if ($pendingLibraries === 0 && $pendingRemap === 0) {
            echo "[convert] conversion already applied (word_ids populated, no item-joined group_words) - skipping\n";
            return;
        }

        $db->transaction(function () use ($db) {
            $this->convertLibraries($db);
            $this->foldCovers($db);
            $this->mergeCollections($db);
            $this->remapWordReferences($db);
            $this->remapStoredCollectionIds($db);
            $this->verify($db);
        });

        echo "[convert] summary:\n";
        foreach ($this->stats as $key => $value) {
            echo "  {$key}: {$value}\n";
        }
        echo "  collection_to_library_map: " . json_encode($this->collectionToLibrary) . "\n";
    }

    public function down(): void
    {
        // Data conversion is one-way by design: the legacy tables stay intact
        // until AppQyV1_2026_06_12_150002, so no destructive rollback here.
    }

    // ------------------------------------------------------------------ a.

    private function convertLibraries($db): void
    {
        $libraries = $db->table($this->t('vocabulary_libraries'))->orderBy('id')->get();

        foreach ($libraries as $library) {
            $sourceCount = $db->table($this->t('vocabulary_words'))
                ->where('library_id', $library->id)
                ->count();
            $this->librarySourceCounts[(int) $library->id] = $sourceCount;

            if ($library->word_ids !== null) {
                $this->stats['libraries_skipped_existing_word_ids']++;
                continue;
            }

            $langCode = AppQyV1VocabularyLibraryModel::languageNameToCode((string) $library->language);
            if ($langCode === null) {
                throw new RuntimeException("Library {$library->id} has unmapped language '{$library->language}'");
            }

            $orderedWords = [];
            $seen = [];
            $db->table($this->t('vocabulary_words'))
                ->where('library_id', $library->id)
                ->orderBy('word_index')
                ->orderBy('id')
                ->chunk(self::READ_CHUNK, function ($rows) use (&$orderedWords, &$seen) {
                    foreach ($rows as $row) {
                        $word = trim((string) $row->word);
                        if ($word === '') {
                            continue;
                        }
                        $normalized = mb_strtolower($word);
                        if (isset($seen[$normalized])) {
                            continue;
                        }
                        $seen[$normalized] = true;
                        $orderedWords[] = $word;
                    }
                });

            $wordIds = $this->resolveOrCreateDictionaryIds($db, $langCode, $orderedWords);

            $db->table($this->t('vocabulary_libraries'))
                ->where('id', $library->id)
                ->update([
                    'word_ids' => json_encode($wordIds),
                    'total_words' => count($wordIds),
                    'updated_at' => now(),
                ]);

            $this->stats['libraries_converted']++;
            echo "[convert] library {$library->id} '{$library->name}': {$sourceCount} source rows -> " . count($wordIds) . " word_ids\n";
        }
    }

    /**
     * Resolve ordered original-cased words to dictionary ids in
     * tts_cache_{lang}; create minimal rows (content + md5, translation/TTS
     * pipelines fill the rest later) for words missing from the dictionary.
     * Returns distinct ids preserving the input order. Batched lookups only.
     */
    private function resolveOrCreateDictionaryIds($db, string $langCode, array $words): array
    {
        if (empty($words)) {
            return [];
        }

        $dictTable = AppQyV1TableMaps::getDictionaryTableName($langCode);

        $md5List = [];
        foreach ($words as $word) {
            $md5List[] = md5($word);
        }

        $md5ToId = [];
        foreach (array_chunk($md5List, self::CHUNK) as $chunk) {
            foreach ($db->table($dictTable)->whereIn('md5', $chunk)->get(['id', 'md5']) as $row) {
                $md5ToId[$row->md5] = (int) $row->id;
            }
        }

        $missing = [];
        foreach ($words as $i => $word) {
            $md5 = $md5List[$i];
            if (!isset($md5ToId[$md5]) && !isset($missing[$md5])) {
                $missing[$md5] = $word;
            }
        }

        if (!empty($missing)) {
            $now = now();
            $rows = [];
            foreach ($missing as $md5 => $word) {
                $rows[] = [
                    'content' => $word,
                    'md5' => $md5,
                    'has_translation' => false,
                    'has_audio' => false,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                $db->table($dictTable)->insert($chunk);
            }
            foreach (array_chunk(array_keys($missing), self::CHUNK) as $chunk) {
                foreach ($db->table($dictTable)->whereIn('md5', $chunk)->get(['id', 'md5']) as $row) {
                    $md5ToId[$row->md5] = (int) $row->id;
                }
            }
            $this->stats['dictionary_rows_created'] += count($missing);
        }

        $ids = [];
        $emitted = [];
        foreach ($md5List as $md5) {
            if (!isset($md5ToId[$md5])) {
                throw new RuntimeException("Dictionary id unresolved for md5 {$md5} ({$dictTable})");
            }
            $id = $md5ToId[$md5];
            if (isset($emitted[$id])) {
                continue;
            }
            $emitted[$id] = true;
            $ids[] = $id;
        }

        return $ids;
    }

    // ------------------------------------------------------------------ b.

    private function foldCovers($db): void
    {
        if (!Schema::connection($this->connection)->hasTable($this->t('vocabulary_covers'))) {
            return;
        }

        foreach ($db->table($this->t('vocabulary_covers'))->orderBy('library_id')->get() as $cover) {
            $library = $db->table($this->t('vocabulary_libraries'))->where('id', $cover->library_id)->first(['id', 'cover_filename']);
            if (!$library) {
                echo "[convert] cover {$cover->id} references missing library {$cover->library_id} - skipped\n";
                continue;
            }
            if ($library->cover_filename !== null) {
                continue;
            }

            $db->table($this->t('vocabulary_libraries'))
                ->where('id', $cover->library_id)
                ->update([
                    'cover_filename' => $cover->cover_filename,
                    'cover_status' => $cover->status,
                    'cover_prompt' => $cover->prompt,
                    'cover_priority' => (int) $cover->priority,
                    'cover_attempts' => (int) $cover->attempts,
                    'cover_error_message' => $cover->error_message,
                    'cover_width' => (int) $cover->width,
                    'cover_height' => (int) $cover->height,
                    'cover_last_requested_at' => $cover->last_requested_at,
                    'cover_last_generated_at' => $cover->last_generated_at,
                    'cover_started_at' => $cover->started_at,
                    'cover_finished_at' => $cover->finished_at,
                    'updated_at' => now(),
                ]);
            $this->stats['covers_folded']++;
        }
    }

    // ------------------------------------------------------------------ c.

    private function mergeCollections($db): void
    {
        $libTable = $this->t('vocabulary_libraries');

        $collections = $db->table($this->t('vocabulary_collections'))
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get();

        foreach ($collections as $collection) {
            $langName = AppQyV1VocabularyLibraryModel::languageCodeToName((string) $collection->lang_code);
            if ($langName === null) {
                throw new RuntimeException("Collection {$collection->id} has unmapped lang_code '{$collection->lang_code}'");
            }

            // Match 1: the 8 system collections were seeded from the same
            // init_data .txt files as the libraries - collection_name equals
            // library.source (verified live: english_coca_20000 etc.).
            $existing = $db->table($libTable)
                ->where('source', $collection->collection_name)
                ->where('language', $langName)
                ->first(['id']);

            // Match 2: same display name + language.
            if (!$existing) {
                $existing = $db->table($libTable)
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower((string) $collection->collection_name)])
                    ->where('language', $langName)
                    ->first(['id']);
            }

            // Match 3: idempotent re-run - a library this migration created
            // from this collection on a previous (partial) pass.
            if (!$existing) {
                $existing = $db->table($libTable)
                    ->where('source', 'collection:' . $collection->id)
                    ->first(['id']);
            }

            if ($existing) {
                $this->collectionToLibrary[(int) $collection->id] = (int) $existing->id;
                $this->stats['collections_mapped_to_existing']++;
                continue;
            }

            $langCode = strtolower((string) $collection->lang_code);
            $orderedWords = [];
            $seen = [];
            $db->table($this->t('vocabulary_items'))
                ->where('collection_id', $collection->id)
                ->orderBy('word_index')
                ->orderBy('id')
                ->chunk(self::READ_CHUNK, function ($rows) use (&$orderedWords, &$seen) {
                    foreach ($rows as $row) {
                        $word = trim((string) $row->word_content);
                        if ($word === '') {
                            continue;
                        }
                        $normalized = mb_strtolower($word);
                        if (isset($seen[$normalized])) {
                            continue;
                        }
                        $seen[$normalized] = true;
                        $orderedWords[] = $word;
                    }
                });

            $wordIds = $this->resolveOrCreateDictionaryIds($db, $langCode, $orderedWords);

            $now = now();
            $libraryId = $db->table($libTable)->insertGetId([
                'name' => $collection->collection_name,
                'description' => $collection->description,
                'language' => $langName,
                'total_words' => count($wordIds),
                'is_public' => (bool) $collection->is_public,
                'owner_user_id' => $collection->owner_id,
                'source' => 'collection:' . $collection->id,
                'category' => 'general',
                'word_ids' => json_encode($wordIds),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->collectionToLibrary[(int) $collection->id] = (int) $libraryId;
            $this->librarySourceCounts[(int) $libraryId] = count($orderedWords);
            $this->stats['collections_new_libraries']++;
            echo "[convert] collection {$collection->id} '{$collection->collection_name}' -> NEW library {$libraryId} (" . count($wordIds) . " word_ids)\n";
        }
    }

    // ------------------------------------------------------------------ d.

    private function remapWordReferences($db): void
    {
        $gwTable = $this->t('group_words');
        $upTable = $this->t('user_word_progress');

        $referencedItemIds = [];
        foreach ($db->table($gwTable)->distinct()->pluck('word_id') as $id) {
            $referencedItemIds[(int) $id] = true;
        }
        foreach ($db->table($upTable)->distinct()->pluck('word_id') as $id) {
            $referencedItemIds[(int) $id] = true;
        }
        $referencedItemIds = array_keys($referencedItemIds);

        if (empty($referencedItemIds)) {
            echo "[convert] no group_words/user_word_progress rows to remap\n";
            return;
        }

        // item id => [lang_code, md5, content]
        $itemInfo = [];
        foreach (array_chunk($referencedItemIds, self::READ_CHUNK) as $chunk) {
            foreach ($db->table($this->t('vocabulary_items'))->whereIn('id', $chunk)->get(['id', 'lang_code', 'word_md5', 'word_content']) as $row) {
                $itemInfo[(int) $row->id] = [strtolower((string) $row->lang_code), (string) $row->word_md5, (string) $row->word_content];
            }
        }

        $unresolved = array_diff($referencedItemIds, array_keys($itemInfo));
        if (!empty($unresolved)) {
            throw new RuntimeException(
                'Aborting remap: ' . count($unresolved) . ' referenced word_id values have no vocabulary_items row (sample: '
                . implode(',', array_slice($unresolved, 0, 10)) . '). Either data is corrupt or the remap already ran.'
            );
        }

        // Per-language batched md5 -> dictionary id resolution (creates
        // minimal dictionary rows for orphans).
        $byLang = [];
        foreach ($itemInfo as $itemId => [$lang, $md5, $content]) {
            $byLang[$lang][$md5] = $content;
        }

        $dictIdByLangMd5 = [];
        foreach ($byLang as $lang => $md5ToContent) {
            $dictTable = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!Schema::connection($this->connection)->hasTable($dictTable)) {
                throw new RuntimeException("Dictionary table {$dictTable} missing for language '{$lang}'");
            }
            $md5s = array_keys($md5ToContent);
            foreach (array_chunk($md5s, self::CHUNK) as $chunk) {
                foreach ($db->table($dictTable)->whereIn('md5', $chunk)->get(['id', 'md5']) as $row) {
                    $dictIdByLangMd5[$lang][$row->md5] = (int) $row->id;
                }
            }

            $missingRows = [];
            $now = now();
            foreach ($md5ToContent as $md5 => $content) {
                if (!isset($dictIdByLangMd5[$lang][$md5])) {
                    $missingRows[] = [
                        'content' => $content,
                        'md5' => $md5,
                        'has_translation' => false,
                        'has_audio' => false,
                        'query_count' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
            if (!empty($missingRows)) {
                foreach (array_chunk($missingRows, 500) as $chunk) {
                    $db->table($dictTable)->insert($chunk);
                }
                $missingMd5s = array_column($missingRows, 'md5');
                foreach (array_chunk($missingMd5s, self::CHUNK) as $chunk) {
                    foreach ($db->table($dictTable)->whereIn('md5', $chunk)->get(['id', 'md5']) as $row) {
                        $dictIdByLangMd5[$lang][$row->md5] = (int) $row->id;
                    }
                }
                $this->stats['dictionary_rows_created'] += count($missingRows);
            }
        }

        // item id => [dict id, lang]
        $itemToDict = [];
        foreach ($itemInfo as $itemId => [$lang, $md5, $content]) {
            if (!isset($dictIdByLangMd5[$lang][$md5])) {
                throw new RuntimeException("Dictionary id unresolved for item {$itemId} (lang {$lang}, md5 {$md5})");
            }
            $itemToDict[$itemId] = [$dictIdByLangMd5[$lang][$md5], $lang];
        }
        unset($itemInfo, $byLang, $dictIdByLangMd5);

        // ---- group_words: dedupe then two-phase remap
        $rows = [];
        $db->table($gwTable)->orderBy('id')->chunk(self::READ_CHUNK, function ($chunk) use (&$rows) {
            foreach ($chunk as $row) {
                $rows[] = [(int) $row->id, (int) $row->group_id, (int) $row->word_id];
            }
        });

        $keep = [];
        $deleteIds = [];
        $updates = [];
        foreach ($rows as [$id, $groupId, $wordId]) {
            [$dictId, $lang] = $itemToDict[$wordId];
            $key = $groupId . ':' . $dictId;
            if (isset($keep[$key])) {
                $deleteIds[] = $id;
                continue;
            }
            $keep[$key] = $id;
            $updates[$id] = [$dictId, $lang];
        }
        unset($rows, $keep);

        $this->deleteByIds($db, $gwTable, $deleteIds);
        $this->stats['group_words_collisions_deleted'] = count($deleteIds);
        $this->applyTwoPhaseRemap($db, $gwTable, $updates);
        $this->stats['group_words_remapped'] = count($updates);
        unset($updates, $deleteIds);

        // ---- user_word_progress: keep greatest (review_count, read_count,
        // proficiency) per (user_id, dict word_id, group_id), then remap.
        $rows = [];
        $db->table($upTable)->orderBy('id')->chunk(self::READ_CHUNK, function ($chunk) use (&$rows) {
            foreach ($chunk as $row) {
                $rows[] = [
                    (int) $row->id,
                    (int) $row->user_id,
                    $row->group_id === null ? 'n' : (string) $row->group_id,
                    (int) $row->word_id,
                    (int) $row->review_count,
                    (int) $row->read_count,
                    (float) $row->proficiency,
                ];
            }
        });

        $best = [];
        foreach ($rows as [$id, $userId, $groupKey, $wordId, $reviewCount, $readCount, $proficiency]) {
            [$dictId, $lang] = $itemToDict[$wordId];
            $key = $userId . ':' . $groupKey . ':' . $dictId;
            $candidate = [$reviewCount, $readCount, $proficiency, -$id, $id, $dictId, $lang];
            if (!isset($best[$key])) {
                $best[$key] = $candidate;
                continue;
            }
            // Lexicographic compare on (review_count, read_count, proficiency,
            // -id): ties resolve to the OLDEST row deterministically.
            if (($candidate <=> $best[$key]) > 0) {
                $best[$key] = $candidate;
            }
        }

        $keepIds = [];
        $updates = [];
        foreach ($best as $candidate) {
            $keepIds[$candidate[4]] = true;
            $updates[$candidate[4]] = [$candidate[5], $candidate[6]];
        }
        $deleteIds = [];
        foreach ($rows as $row) {
            if (!isset($keepIds[$row[0]])) {
                $deleteIds[] = $row[0];
            }
        }
        unset($rows, $best, $keepIds);

        $this->deleteByIds($db, $upTable, $deleteIds);
        $this->stats['progress_collisions_deleted'] = count($deleteIds);
        $this->applyTwoPhaseRemap($db, $upTable, $updates);
        $this->stats['progress_remapped'] = count($updates);
    }

    private function deleteByIds($db, string $table, array $ids): void
    {
        foreach (array_chunk($ids, self::CHUNK) as $chunk) {
            $db->table($table)->whereIn('id', $chunk)->delete();
        }
    }

    /**
     * Phase 1: word_id = -dict_id (+ language_code backfill) in chunks of
     * 500 via a single CASE update per chunk (no per-row queries). Negative
     * placeholders can never collide with not-yet-remapped positive item ids,
     * so the unique indexes stay satisfied mid-flight.
     * Phase 2: one statement flips every negative to its final positive id.
     *
     * @param array<int, array{0:int,1:string}> $updates row id => [dict id, lang]
     */
    private function applyTwoPhaseRemap($db, string $table, array $updates): void
    {
        $pairs = [];
        foreach ($updates as $rowId => [$dictId, $lang]) {
            $pairs[] = [$rowId, $dictId, $lang];
        }

        foreach (array_chunk($pairs, 500) as $chunk) {
            $wordCase = 'CASE "id"';
            $langCase = 'CASE "id"';
            $bindings = [];
            $ids = [];
            foreach ($chunk as [$rowId, $dictId, $lang]) {
                $wordCase .= ' WHEN ? THEN ?';
                $bindings[] = $rowId;
                $bindings[] = -$dictId;
                $ids[] = $rowId;
            }
            $wordCase .= ' ELSE "word_id" END';
            foreach ($chunk as [$rowId, $dictId, $lang]) {
                $langCase .= ' WHEN ? THEN ?';
                $bindings[] = $rowId;
                $bindings[] = $lang;
            }
            $langCase .= ' ELSE "language_code" END';

            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $sql = 'UPDATE "' . $table . '" SET "word_id" = ' . $wordCase
                . ', "language_code" = ' . $langCase
                . ' WHERE "id" IN (' . $placeholders . ')';
            $db->statement($sql, array_merge($bindings, $ids));
        }

        $db->statement('UPDATE "' . $table . '" SET "word_id" = -"word_id" WHERE "word_id" < 0');
    }

    // ------------------------------------------------------------------ map consumers

    private function remapStoredCollectionIds($db): void
    {
        $schema = Schema::connection($this->connection);

        // uploaded_documents.collection_id was written by the upload flow with
        // vocabulary_collections ids - remap to the merged library ids.
        $docTable = $this->t('uploaded_documents');
        if ($schema->hasTable($docTable)) {
            foreach ($this->collectionToLibrary as $collectionId => $libraryId) {
                if ($collectionId === $libraryId) {
                    continue;
                }
                $this->stats['documents_remapped'] += $db->table($docTable)
                    ->where('collection_id', $collectionId)
                    ->update(['collection_id' => $libraryId, 'updated_at' => now()]);
            }
        }

        // user_selected_libraries.collection_id is historically AMBIGUOUS
        // (LearningController wrote collection ids, RecommendationController
        // wrote library ids). Live data: 0 rows, and the system collection ->
        // library map is the identity, so this remap is effectively a no-op;
        // it only fires for ids that are unambiguous (mapped target differs
        // and the raw value is a known collection id).
        $selTable = $this->t('user_selected_libraries');
        if ($schema->hasTable($selTable)) {
            foreach ($this->collectionToLibrary as $collectionId => $libraryId) {
                if ($collectionId === $libraryId) {
                    continue;
                }
                $this->stats['selected_libraries_remapped'] += $db->table($selTable)
                    ->where('collection_id', $collectionId)
                    ->update(['collection_id' => $libraryId, 'updated_at' => now()]);
            }
        }
    }

    // ------------------------------------------------------------------ e.

    private function verify($db): void
    {
        $libTable = $this->t('vocabulary_libraries');
        $gwTable = $this->t('group_words');
        $upTable = $this->t('user_word_progress');

        // Every library that had source words must have non-empty word_ids,
        // and every id inside word_ids must exist in its language dictionary.
        foreach ($db->table($libTable)->orderBy('id')->get(['id', 'name', 'language', 'word_ids']) as $library) {
            $sourceCount = 0;
            if (isset($this->librarySourceCounts[(int) $library->id])) {
                $sourceCount = $this->librarySourceCounts[(int) $library->id];
            }
            $wordIds = json_decode((string) $library->word_ids, true);
            if (!is_array($wordIds)) {
                throw new RuntimeException("Verify failed: library {$library->id} word_ids not an array after conversion");
            }
            if ($sourceCount > 0 && count($wordIds) === 0) {
                throw new RuntimeException("Verify failed: library {$library->id} had {$sourceCount} source words but empty word_ids");
            }

            $langCode = AppQyV1VocabularyLibraryModel::languageNameToCode((string) $library->language);
            $dictTable = AppQyV1TableMaps::getDictionaryTableName($langCode);
            $found = 0;
            foreach (array_chunk($wordIds, self::CHUNK) as $chunk) {
                $found += $db->table($dictTable)->whereIn('id', $chunk)->count();
            }
            if ($found !== count($wordIds)) {
                throw new RuntimeException("Verify failed: library {$library->id} word_ids " . count($wordIds) . " but only {$found} resolve in {$dictTable}");
            }
        }

        // No leftover negative placeholders.
        foreach ([$gwTable, $upTable] as $table) {
            $negatives = $db->table($table)->where('word_id', '<', 0)->count();
            if ($negatives > 0) {
                throw new RuntimeException("Verify failed: {$table} still has {$negatives} negative word_id placeholders");
            }
        }

        // Every remapped word_id must exist in its language dictionary.
        foreach ([$gwTable, $upTable] as $table) {
            $missingLang = $db->table($table)->whereNull('language_code')->count();
            if ($missingLang > 0) {
                throw new RuntimeException("Verify failed: {$table} has {$missingLang} rows without language_code after remap");
            }
            $langs = $db->table($table)->distinct()->pluck('language_code');
            foreach ($langs as $lang) {
                $dictTable = AppQyV1TableMaps::getDictionaryTableName(strtolower((string) $lang));
                $dangling = $db->table($table . ' as r')
                    ->leftJoin($dictTable . ' as d', 'd.id', '=', 'r.word_id')
                    ->where('r.language_code', $lang)
                    ->whereNull('d.id')
                    ->count();
                if ($dangling > 0) {
                    throw new RuntimeException("Verify failed: {$table} has {$dangling} word_id values missing from {$dictTable}");
                }
            }
        }

        // Every live collection must be mapped.
        $liveCollections = $db->table($this->t('vocabulary_collections'))->whereNull('deleted_at')->count();
        if ($liveCollections !== count($this->collectionToLibrary)) {
            throw new RuntimeException('Verify failed: ' . count($this->collectionToLibrary) . " collections mapped but {$liveCollections} live collections exist");
        }

        echo "[convert] verification passed\n";
    }
};
