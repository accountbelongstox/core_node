<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Utils\SystemArchiveManager;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * AppQyV1 dictionary import/promotion pipeline (moved out of the main-layer
 * App\Services\UserSyncService god class — Phase 6 layering fix).
 *
 * Owns the two-stage dictionary bootstrap:
 *   Stage 1: load words/translations into the per-language STAGING tables
 *            (md sources, output.txt word list, split-7z translation JSON).
 *   Stage 2: promote staging rows into the formal tts_cache_{lang} tables
 *            (idempotent, additive, insertOrIgnore by md5 + enrichment).
 */
class AppQyV1DictionaryImportService
{
    public static function importMultilingualWordsFromMd(): array
    {
        $results = [
            'total_files' => 0,
            'total_words' => 0,
            'imported' => 0,
            'errors' => [],
        ];

        $model = new AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();
        $dataDir = base_path('init_data/AppQyV1/Multilingual_basic_data/Inspection_table');

        if (!is_dir($dataDir)) {
            $results['errors'][] = "Directory not found: {$dataDir}";
            return $results;
        }

        $mdFiles = glob("{$dataDir}/*.md");
        $results['total_files'] = count($mdFiles);

        // Gate on the lo staging table (this importer targets lo/ja/vi).
        $loStagingTable = AppQyV1TableMaps::getDictionaryStagingTableName('lo');
        $existingCount = $dbConnection->table($loStagingTable)->count();
        if ($existingCount > 0) {
            $results['skipped'] = true;
            $results['reason'] = 'already_staged';
            $results['message'] = "Staging already has {$existingCount} records, skipping import";
            return $results;
        }

        $laoData = [];
        $japaneseData = [];
        $vietnameseData = [];

        foreach ($mdFiles as $file) {
            $content = file_get_contents($file);
            $lines = explode("\n", $content);

            foreach ($lines as $line) {
                $line = trim($line);

                if (empty($line) || strpos($line, '| #') === 0 || strpos($line, '|---') === 0 || strpos($line, '# ') === 0) {
                    continue;
                }

                if (strpos($line, '|') !== 0) {
                    continue;
                }

                $parts = array_map('trim', explode('|', $line));
                array_shift($parts);
                array_pop($parts);

                if (count($parts) < 10) {
                    continue;
                }

                $wordId = intval($parts[0]);
                if ($wordId <= 0) {
                    continue;
                }

                $english = $parts[1];
                $lao = $parts[2];
                $laoPronunciation = $parts[3];
                $japanese = $parts[4];
                $japanesePronunciation = $parts[5];
                $vietnamese = $parts[6];
                $vietnamesePronunciation = $parts[7];
                $meaningEn = $parts[8];
                $meaningZh = $parts[9];

                $now = now();


                // Fold legacy pronunciation/meaning_* into the unified schema:
                // phonetic <- pronunciation, translations <- {en,zh} JSON.
                $foldedTranslations = json_encode(['en' => $meaningEn, 'zh' => $meaningZh], JSON_UNESCAPED_UNICODE);
                // PHP bool (not 1/0): target column is BOOLEAN on pgsql.
                $foldedHasTranslation = (!empty($meaningZh) || !empty($meaningEn));

                $laoData[] = [
                    'content' => $lao,
                    'md5' => md5($lao),
                    'phonetic' => $laoPronunciation,
                    'translations' => $foldedTranslations,
                    'has_translation' => $foldedHasTranslation,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $japaneseData[] = [
                    'content' => $japanese,
                    'md5' => md5($japanese),
                    'phonetic' => $japanesePronunciation,
                    'translations' => $foldedTranslations,
                    'has_translation' => $foldedHasTranslation,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $vietnameseData[] = [
                    'content' => $vietnamese,
                    'md5' => md5($vietnamese),
                    'phonetic' => $vietnamesePronunciation,
                    'translations' => $foldedTranslations,
                    'has_translation' => $foldedHasTranslation,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $results['total_words']++;
            }
        }

        try {
            $chunkSize = 500;

            foreach (array_chunk($laoData, $chunkSize) as $chunk) {
                $loStaging = AppQyV1TableMaps::getDictionaryStagingTableName('lo');
                $dbConnection->table($loStaging)->insert($chunk);
            }

            foreach (array_chunk($japaneseData, $chunkSize) as $chunk) {
                $jaStaging = AppQyV1TableMaps::getDictionaryStagingTableName('ja');
                $dbConnection->table($jaStaging)->insert($chunk);
            }

            foreach (array_chunk($vietnameseData, $chunkSize) as $chunk) {
                $viStaging = AppQyV1TableMaps::getDictionaryStagingTableName('vi');
                $dbConnection->table($viStaging)->insert($chunk);
            }

            $results['imported'] = $results['total_words'];

            // Stage 2: promote lo/ja/vi staging into the formal tts_cache_{lang}
            // tables immediately. This importer runs every sys:init (it is not
            // inside the skip-gated dictionary Step 2), so promotion must also
            // run here or freshly staged lo/ja/vi rows would never reach formal.
            $results['promote'] = [
                'lo' => self::promoteStagingToFormal('lo'),
                'ja' => self::promoteStagingToFormal('ja'),
                'vi' => self::promoteStagingToFormal('vi'),
            ];

        } catch (\Exception $e) {
            Log::error("[AppQyV1DictionaryImport] Failed to import multilingual words: " . $e->getMessage());
            $results['errors'][] = $e->getMessage();
        }

        return $results;
    }

    public static function initializeDictionaryStep2(): array
    {
        $results = [
            'step1_rename_7z' => [],
            'step2_extract_json' => [],
            'step3_import_words' => [],
            'step4_update_translations' => [],
        ];

        try {
            $results['step1_rename_7z'] = self::process7zFiles();
            $results['step3_import_words'] = self::importDictionaryWords();
            $results['step4_update_translations'] = self::importTranslationsFromJson();
            // Stage 2: promote every language's staging rows into the formal
            // canonical tts_cache_{lang} tables (idempotent, additive).
            $results['step5_promote'] = self::promoteAllStaging();

        } catch (\Exception $e) {
            Log::error("[DictionaryInit] Failed: " . $e->getMessage());
            $results['error'] = $e->getMessage();
        }

        return $results;
    }

    /**
     * Stage 2: copy rows from a language's staging table into its formal
     * tts_cache_{lang} table. Idempotent and additive: inserts rows whose md5
     * is absent from the formal table, and enriches existing formal rows that
     * still lack a translation/audio when staging has richer data. Never
     * deletes formal rows.
     */
    public static function promoteStagingToFormal(string $langCode): array
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $schema = Schema::connection($connection);

        $staging = AppQyV1TableMaps::getDictionaryStagingTableName($langCode);
        $formal = AppQyV1TableMaps::getDictionaryTableName($langCode);

        if (!$schema->hasTable($staging) || !$schema->hasTable($formal)) {
            return ['lang' => $langCode, 'skipped' => true, 'reason' => 'missing_table', 'message' => "{$langCode}: staging or formal table missing"];
        }

        $model = new AppQyV1LangDictionaryModel();
        $db = $model->getConnection();

        $inserted = 0;
        $enriched = 0;
        $processed = 0;
        $chunkNo = 0;
        $stagingTotal = (int) $db->table($staging)->count();
        $now = now();

        // IDEMPOTENCY FAST-PATH (avoids re-scanning the whole staging table on every
        // sys:init re-run -- e.g. EN's 233k rows). When the staging set is already
        // fully promoted + enriched there is nothing to do; detect that with two
        // cheap INDEXED queries instead of the PHP chunk loop below:
        //   (a) insert pending  = any staging md5 absent from formal;
        //   (b) enrich pending  = any matched row whose formal copy still lacks a
        //       field the staging row provides -- mirrors the per-row predicate in
        //       the loop EXACTLY (translation / phonetic / us / uk / image_files).
        // If neither, skip the scan. md5 is UNIQUE-indexed on formal, so both are
        // fast even when they must confirm "no work".
        if ($stagingTotal > 0) {
            $insertPending = $db->table("{$staging} as s")
                ->whereNotExists(function ($q) use ($db, $formal) {
                    $q->select($db->raw('1'))->from("{$formal} as f")->whereColumn('f.md5', 's.md5');
                })->exists();

            $enrichPending = false;
            if (!$insertPending) {
                // Mirror the loop's PHP semantics EXACTLY so the gate never wrongly
                // skips: the loop uses empty() (null, '' AND '0' are all "empty") and
                // (int)$x===0 (null/''/0 -> 0). So the FORMAL-side "lacks it" check must
                // include NULL and '0', and the STAGING-side "has it" must exclude '0'.
                $enrichPending = $db->table("{$staging} as s")
                    ->join("{$formal} as f", 'f.md5', '=', 's.md5')
                    ->where(function ($w) {
                        $w->where(function ($x) {
                            $x->where(function ($y) { $y->where('f.has_translation', false)->orWhereNull('f.has_translation'); })
                                ->where('s.has_translation', true);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.phonetic')->orWhereIn('f.phonetic', ['', '0']); })
                                ->whereNotNull('s.phonetic')->whereNotIn('s.phonetic', ['', '0']);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.us_phonetic')->orWhereIn('f.us_phonetic', ['', '0']); })
                                ->whereNotNull('s.us_phonetic')->whereNotIn('s.us_phonetic', ['', '0']);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.uk_phonetic')->orWhereIn('f.uk_phonetic', ['', '0']); })
                                ->whereNotNull('s.uk_phonetic')->whereNotIn('s.uk_phonetic', ['', '0']);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.image_files')->orWhereIn('f.image_files', ['', '0']); })
                                ->whereNotNull('s.image_files')->whereNotIn('s.image_files', ['', '0']);
                        });
                    })->exists();
            }

            if (!$insertPending && !$enrichPending) {
                if (PHP_SAPI === 'cli') {
                    echo "      [Step2 promote staging->formal:{$langCode}] up-to-date ({$stagingTotal} staged rows already in formal table) -> skip\n";
                    flush();
                }
                return ['lang' => $langCode, 'skipped' => true, 'reason' => 'already_promoted', 'staging' => $stagingTotal, 'message' => "{$langCode}: {$stagingTotal} staged rows already promoted"];
            }
        }

        // Per-chunk set-based promotion (formal.md5 is UNIQUE):
        //   1 SELECT (whereIn the chunk md5s) + 1 batch insertOrIgnore for
        //   absent rows + at most a small number of enrich UPDATEs (only rows
        //   that genuinely gained a translation/phonetic). Replaces the prior
        //   per-row SELECT+INSERT (~2 queries/row) which was O(rows) and made
        //   re-init very slow on large tables (e.g. EN 100k+).
        $db->table($staging)->orderBy('id')->chunk(1000, function ($rows) use ($db, $formal, &$inserted, &$enriched, &$processed, &$chunkNo, $stagingTotal, $now, $langCode) {
            $chunkMd5s = [];
            foreach ($rows as $row) {
                $chunkMd5s[] = $row->md5;
            }
            if (empty($chunkMd5s)) {
                return;
            }

            $existingByMd5 = [];
            foreach ($db->table($formal)->whereIn('md5', $chunkMd5s)->get(['id', 'md5', 'has_translation', 'phonetic', 'us_phonetic', 'uk_phonetic', 'image_files']) as $ex) {
                $existingByMd5[$ex->md5] = $ex;
            }

            $insertBatch = [];
            $seenInBatch = [];
            foreach ($rows as $row) {
                if (!isset($existingByMd5[$row->md5])) {
                    // Dedup within the staging chunk itself (md5 is not unique
                    // in staging); insertOrIgnore also guards against races.
                    if (isset($seenInBatch[$row->md5])) {
                        continue;
                    }
                    $seenInBatch[$row->md5] = true;
                    $insertBatch[] = [
                        'content' => $row->content,
                        'md5' => $row->md5,
                        'translations' => $row->translations,
                        'has_translation' => $row->has_translation,
                        'phonetic' => $row->phonetic,
                        'us_phonetic' => isset($row->us_phonetic) ? $row->us_phonetic : null,
                        'uk_phonetic' => isset($row->uk_phonetic) ? $row->uk_phonetic : null,
                        'tts_files' => isset($row->tts_files) ? $row->tts_files : null,
                        'image_files' => isset($row->image_files) ? $row->image_files : null,
                        'has_audio' => isset($row->has_audio) ? $row->has_audio : false,
                        'query_count' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                    continue;
                }

                $existing = $existingByMd5[$row->md5];
                $update = [];
                $existingHasTranslation = isset($existing->has_translation) ? (int) $existing->has_translation : 0;
                if ($existingHasTranslation === 0 && (int) $row->has_translation === 1) {
                    $update['translations'] = $row->translations;
                    $update['has_translation'] = 1;
                }
                if (empty($existing->phonetic) && !empty($row->phonetic)) {
                    $update['phonetic'] = $row->phonetic;
                }
                if (empty($existing->us_phonetic) && isset($row->us_phonetic) && !empty($row->us_phonetic)) {
                    $update['us_phonetic'] = $row->us_phonetic;
                }
                if (empty($existing->uk_phonetic) && isset($row->uk_phonetic) && !empty($row->uk_phonetic)) {
                    $update['uk_phonetic'] = $row->uk_phonetic;
                }
                if (empty($existing->image_files) && isset($row->image_files) && !empty($row->image_files)) {
                    $update['image_files'] = $row->image_files;
                }
                if (!empty($update)) {
                    $update['updated_at'] = $now;
                    $db->table($formal)->where('id', $existing->id)->update($update);
                    $enriched++;
                }
            }

            if (!empty($insertBatch)) {
                $db->table($formal)->insertOrIgnore($insertBatch);
                $inserted += count($insertBatch);
            }

            // Real-time progress so promotion never looks "stuck" on large tables
            // (e.g. EN 100k+). Show the ROWS-PROCESSED counter -- inserted/enriched
            // stay 0 on an idempotent re-run, so they alone look frozen. Throttled
            // newline output (every 10 chunks) so it is visible in captured logs too
            // (a bare \r does not advance when stdout is redirected to a file).
            $processed += count($rows);
            $chunkNo++;
            if (PHP_SAPI === 'cli' && ($chunkNo % 10 === 0)) {
                echo "      [Step2 promote staging->formal:{$langCode}] staging->formal {$processed}/{$stagingTotal} (inserted into formal {$inserted}, enriched existing {$enriched})...\n";
                flush();
            }
        });

        if (PHP_SAPI === 'cli') {
            echo "      [Step2 promote staging->formal:{$langCode}] staging->formal {$processed}/{$stagingTotal} (inserted into formal {$inserted}, enriched existing {$enriched}) (done)\n";
            flush();
        }

        // Promotion changed row count and/or translation coverage -> invalidate
        // the cached dashboard dictionary metrics for this language.
        if ($inserted > 0 || $enriched > 0) {
            AppQyV1LangDictionaryModel::forgetMetricsCache($langCode);
        }

        return ['lang' => $langCode, 'inserted' => $inserted, 'enriched' => $enriched];
    }

    /**
     * Stage 2 for every supported language.
     */
    public static function promoteAllStaging(): array
    {
        $results = [];
        $languages = AppQyV1TableMaps::getSupportedLanguages();
        foreach ($languages as $langCode) {
            $results[$langCode] = self::promoteStagingToFormal($langCode);
        }
        return $results;
    }

    private static function importTranslationsFromJson(): array
    {
        $jsonFile = \App\Providers\PathMapper::getLaravelTmpDir() . '/dictionary_import/extracted/olddb.txt';
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $delimiter = '------------------------------TokenLine-----------------------------';

        if (!file_exists($jsonFile)) {
            return ['error' => 'JSON file not found: ' . $jsonFile];
        }

        // Idempotency short-circuit: if the EN staging table already holds translated
        // rows, the (expensive, ~200k per-row) upsert ran on a prior init -> skip it
        // and let promoteStagingToFormal (idempotent insertOrIgnore) finish. Without
        // this, a run interrupted before promotion re-imports everything because the
        // handle() gate keys on the FORMAL table's translation count, not staging.
        try {
            $enStaging = AppQyV1TableMaps::getDictionaryStagingTableName('en');
            $model = new AppQyV1LangDictionaryModel();
            $db = $model->getConnection();
            if (Schema::connection($db->getName())->hasTable($enStaging)
                && $db->table($enStaging)->where('has_translation', true)->exists()) {
                return [
                    'skipped' => true,
                    'reason' => 'already_imported',
                    'message' => 'EN staging already has translated rows; skipping JSON re-import',
                ];
            }
        } catch (\Throwable $e) {
            // If the probe fails, fall through and import normally.
        }

        $handle = fopen($jsonFile, 'r');
        if (!$handle) {
            return ['error' => 'Failed to open JSON file'];
        }

        $buffer = '';
        $processed = 0;
        $updated = 0;
        $inserted = 0;
        $errors = 0;
        $batch = [];
        $batchSize = 100;

        while (!feof($handle)) {
            $chunk = fread($handle, 65536);
            $buffer .= $chunk;

            while (($pos = strpos($buffer, $delimiter)) !== false) {
                $item = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + strlen($delimiter));

                if (empty($item)) continue;

                $data = json_decode($item, true);
                if (!$data || !isset($data['content'])) {
                    $errors++;
                    continue;
                }

                $word = $data['content'];
                $usPhonetic = $data['us_phonetic'] ?? null;
                $ukPhonetic = $data['uk_phonetic'] ?? null;

                $translation = $data['translation'] ?? [];

                if (isset($translation['synonyms_type'])) {
                    $translation['synonyms_type'] = array_map(function($v) {
                        return strip_tags(html_entity_decode($v));
                    }, $translation['synonyms_type']);
                }

                if (isset($translation['advanced_translate_type'])) {
                    $translation['advanced_translate_type'] = array_map(function($v) {
                        return strip_tags(html_entity_decode($v));
                    }, $translation['advanced_translate_type']);
                }

                unset($translation['voice_files']);
                unset($translation['phonetic_symbol']);

                $sampleImages = [];
                if (isset($data['sample_images'])) {
                    foreach ($data['sample_images'] as $img) {
                        if (isset($img['save_filename'])) {
                            $sampleImages[] = $img['save_filename'];
                        }
                    }
                }

                $batch[] = [
                    'content' => $word,
                    'md5' => md5($word),
                    'us_phonetic' => $usPhonetic,
                    'uk_phonetic' => $ukPhonetic,
                    'translations' => json_encode($translation, JSON_UNESCAPED_UNICODE),
                    'image_files' => json_encode($sampleImages, JSON_UNESCAPED_UNICODE),
                    'has_translation' => !empty($translation),
                ];

                $processed++;

                if (count($batch) >= $batchSize) {
                    $result = self::upsertTranslationBatch($connection, $batch);
                    $updated += $result['updated'];
                    $inserted += $result['inserted'];
                    $batch = [];
                    // Real-time progress (throttled newline; visible in captured logs).
                    if (PHP_SAPI === 'cli' && $processed % 10000 === 0) {
                        echo "      [Step2 load->staging:translations] enriching staging table: processed {$processed} (updated {$updated}, inserted {$inserted}; still staging, not formal)...\n";
                        flush();
                    }
                }
            }
        }

        if (!empty($batch)) {
            $result = self::upsertTranslationBatch($connection, $batch);
            $updated += $result['updated'];
            $inserted += $result['inserted'];
        }

        fclose($handle);

        if (PHP_SAPI === 'cli') {
            echo "      [Step2 load->staging:translations] enriched staging table: processed {$processed} (updated {$updated}, inserted {$inserted}) (done; promote step moves them to formal)\n";
            flush();
        }

        return [
            'processed' => $processed,
            'updated' => $updated,
            'inserted' => $inserted,
            'errors' => $errors,
        ];
    }

    private static function upsertTranslationBatch(string $connection, array $batch): array
    {
        $updated = 0;
        $inserted = 0;
        $now = now();
        $model = new AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();

        foreach ($batch as $item) {
            // Stage 1: translations are written into the EN staging table;
            // promoteStagingToFormal('en') merges them into the formal table.
            $enDictTable = AppQyV1TableMaps::getDictionaryStagingTableName('en');
            $existing = $dbConnection
                ->table($enDictTable)
                ->where('content', $item['content'])
                ->where('md5', $item['md5'])
                ->first();

            if ($existing) {
                $shouldUpdate = false;
                if (!isset($existing->has_translation) || (int) $existing->has_translation === 0) {
                    $shouldUpdate = true;
                } elseif (empty($existing->translations)) {
                    $shouldUpdate = true;
                }

                if ($shouldUpdate) {
                    $dbConnection
                        ->table($enDictTable)
                        ->where('id', $existing->id)
                        ->update([
                            'us_phonetic' => $item['us_phonetic'],
                            'uk_phonetic' => $item['uk_phonetic'],
                            'translations' => $item['translations'],
                            'image_files' => $item['image_files'],
                            'has_translation' => $item['has_translation'],
                            'updated_at' => $now,
                        ]);
                    $updated++;
                }
            } else {
                $dbConnection
                    ->table($enDictTable)
                    ->insert([
                        'content' => $item['content'],
                        'md5' => $item['md5'],
                        'us_phonetic' => $item['us_phonetic'],
                        'uk_phonetic' => $item['uk_phonetic'],
                        'translations' => $item['translations'],
                        'image_files' => $item['image_files'],
                        'has_translation' => $item['has_translation'],
                        'query_count' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                $inserted++;
            }
        }

        return ['updated' => $updated, 'inserted' => $inserted];
    }

    private static function process7zFiles(): array
    {
        $translateDir = base_path('init_data/AppQyV1/VoiceStaticServer/translate');
        $tmpDir = \App\Providers\PathMapper::getLaravelTmpDir() . '/dictionary_import';
        $extractDir = "{$tmpDir}/extracted";
        $jsonFile = "{$extractDir}/olddb.txt";

        if (file_exists($jsonFile)) {
            return [
                'skipped' => true,
                'reason' => 'already_extracted',
                'message' => 'JSON already extracted',
                'json_file' => $jsonFile,
                'json_size' => filesize($jsonFile),
            ];
        }

        // The translation source ships as a split 7z archive; extraction needs an
        // external 7z binary (p7zip). PHP has no native 7z reader, so if the
        // binary is missing we must FAIL LOUDLY here -- previously this fell
        // through to a hardcoded `7z` exec that silently failed, dropping every
        // translation and leaving the dictionary at has_translation=0.
        $sevenZipBin = SystemArchiveManager::executable();
        if ($sevenZipBin === null) {
            $msg = '7z binary not found (p7zip). Dictionary translations cannot be extracted. '
                . 'Install it: Debian/Ubuntu/WSL -> sudo apt-get install -y p7zip-full '
                . '(or run scripts/shells/linux/debian/install_shells/44_install_p7zip.sh).';
            Log::error('[DictionaryInit] ' . $msg);
            return [
                'error' => $msg,
                'missing_dependency' => '7z',
            ];
        }

        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0755, true);
        }

        $jsFiles = glob("{$translateDir}/*.js");
        $results = [
            'total_files' => count($jsFiles),
            'renamed' => 0,
            'extracted' => 0,
            'errors' => [],
        ];

        foreach ($jsFiles as $jsFile) {
            $basename = basename($jsFile);

            preg_match('/olddb\.7z\.(\d+)\.expected_ext_marker\.j7son\.js/', $basename, $matches);
            if (!$matches) {
                $results['errors'][] = "Skipped: {$basename} (invalid format)";
                continue;
            }

            $partNumber = $matches[1];
            $newFilename = "olddb.7z.{$partNumber}";
            $newPath = "{$tmpDir}/{$newFilename}";

            if (copy($jsFile, $newPath)) {
                $results['renamed']++;
            } else {
                $results['errors'][] = "Failed to copy: {$basename}";
            }
        }

        if ($results['renamed'] > 0) {
            $combinedFile = "{$tmpDir}/olddb.7z";

            // Concatenate the split parts in PHP (portable; no shell `cat`
            // dependency, works on Windows too). Parts are zero-padded
            // (olddb.7z.001..NNN) so a natural sort yields the correct order.
            $parts = glob("{$tmpDir}/olddb.7z.*");
            if ($parts === false) {
                $parts = [];
            }
            natsort($parts);

            $combined = false;
            $out = fopen($combinedFile, 'wb');
            if ($out !== false) {
                $combined = true;
                foreach ($parts as $part) {
                    $in = fopen($part, 'rb');
                    if ($in === false) {
                        $combined = false;
                        $results['errors'][] = "Failed to read part: " . basename($part);
                        break;
                    }
                    stream_copy_to_stream($in, $out);
                    fclose($in);
                }
                fclose($out);
            } else {
                $results['errors'][] = "Failed to open combined archive for writing: {$combinedFile}";
            }

            if ($combined && file_exists($combinedFile)) {
                if (!is_dir($extractDir)) {
                    mkdir($extractDir, 0755, true);
                }

                try {
                    SystemArchiveManager::extract7z($combinedFile, $extractDir);
                    $results['extracted'] = 1;
                    $results['extract_dir'] = $extractDir;

                    if (file_exists($jsonFile)) {
                        $results['json_file'] = $jsonFile;
                        $results['json_size'] = filesize($jsonFile);
                    }
                } catch (\Throwable $exception) {
                    $results['errors'][] = 'Failed to extract: ' . $exception->getMessage();
                }
            } else {
                $results['errors'][] = "Failed to combine parts into {$combinedFile}";
            }
        }

        return $results;
    }

    private static function importDictionaryWords(): array
    {
        $outputFile = base_path('init_data/AppQyV1/VoiceStaticServer/dictionary/output.txt');
        $model = new AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();

        if (!file_exists($outputFile)) {
            return ['error' => 'output.txt not found'];
        }

        // Stage 1: import into the staging table. Idempotency: gate on ANY staged
        // rows ("> 0"), matching importMultilingualWordsFromMd. The staging md5 is a
        // non-unique index, so a plain insert here would duplicate rows if a prior
        // run was interrupted after staging some (but < the old magic 50000) words;
        // gating on > 0 closes that window. promoteStagingToFormal still dedups by
        // md5 (insertOrIgnore) on the way into the formal table.
        $enStagingTable = AppQyV1TableMaps::getDictionaryStagingTableName('en');
        $existingCount = $dbConnection->table($enStagingTable)->count();
        if ($existingCount > 0) {
            return [
                'skipped' => true,
                'reason' => 'already_staged',
                'message' => "Already staged {$existingCount} words, skipping",
            ];
        }

        $handle = fopen($outputFile, 'r');
        if (!$handle) {
            return ['error' => 'Failed to open output.txt'];
        }

        $batch = [];
        $imported = 0;
        $now = now();

        while (($line = fgets($handle)) !== false) {
            $word = trim($line);
            if (empty($word)) {
                continue;
            }

            $batch[] = [
                'content' => $word,
                'md5' => md5($word),
                'us_phonetic' => null,
                'uk_phonetic' => null,
                'translations' => null,
                'image_files' => null,
                'has_translation' => false,
                'query_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($batch) >= 1000) {
                // Use model connection for query builder (Stage-1 staging)
                $dbConnection->table($enStagingTable)->insert($batch);
                $imported += count($batch);
                $batch = [];
                // Real-time progress (throttled newline; visible in captured logs).
                if (PHP_SAPI === 'cli' && ($imported % 10000 === 0)) {
                    echo "      [Step2 load->staging:words] loaded {$imported} words into staging table (not yet in formal)...\n";
                    flush();
                }
            }
        }

        if (!empty($batch)) {
            // Use model connection for query builder (Stage-1 staging)
            $dbConnection->table($enStagingTable)->insert($batch);
            $imported += count($batch);
        }

        fclose($handle);

        if (PHP_SAPI === 'cli') {
            echo "      [Step2 load->staging:words] loaded {$imported} words into staging table (done; promote step moves them to formal)\n";
            flush();
        }

        return [
            'imported' => $imported,
            'total_words' => $imported,
        ];
    }
}
