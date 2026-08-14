<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * One-way, idempotent decommission of the intermediate app_qy_v1_tts_queue
 * table — run from sys:init (after migrations have added the tts_* state
 * columns to the canonical tables).
 *
 * What it does, in order:
 *   1. Salvage: copy every piece of DURABLE state the queue still uniquely
 *      holds into its canonical home, fill-missing only (never clobber):
 *        - completed WORD tasks   → tts_cache_{lang}: tts_files entry +
 *          has_audio when the row still lacks audio;
 *        - completed ARTICLE tasks→ articles: audio_files + has_audio when
 *          the article still lacks audio (this write-back never happened in
 *          the old pipeline — the queue was the only holder);
 *        - pending/failed WORD tasks → tts_cache_{lang}: tts_status/priority/
 *          attempts/error so in-flight intent survives the cutover.
 *   2. Reconcile: cheap flag-consistency fixes on the canonical tables
 *      (has_audio=true with empty tts_files → reset to false + pending).
 *   3. Drop the tts_queue table (the space win).
 *
 * Re-runs are no-ops once the table is gone; every step is fill-missing, so a
 * crash mid-way is safe to re-run.
 */
class AppQyV1TTSQueueDecommission
{
    public static function run(): array
    {
        $appKey = AppKeys::APPQYV1;
        $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
        $conn = DB::connection($connectionName);
        $schema = Schema::connection($connectionName);

        $queueTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_queue');

        $result = [
            'queue_table_present' => false,
            'words_salvaged' => 0,
            'articles_salvaged' => 0,
            'pending_migrated' => 0,
            'flags_reconciled' => 0,
            'dropped' => false,
        ];

        // ---- 2. Reconcile canonical flags (runs every init, queue or not) ----
        $result['flags_reconciled'] = self::reconcileCanonicalFlags($conn, $schema);

        if (!$schema->hasTable($queueTable)) {
            return $result; // Already decommissioned — reconcile-only run.
        }
        $result['queue_table_present'] = true;

        // ---- 1a. Completed WORD tasks → tts_cache_{lang} (fill-missing) ----
        $conn->table($queueTable)
            ->where('task_type', 'word')
            ->where('status', 'completed')
            ->whereNotNull('audio_path')
            ->orderBy('id')
            ->chunk(500, function ($rows) use ($conn, $schema, &$result) {
                foreach ($rows as $row) {
                    $lang = strtolower((string) $row->language);
                    $dict = AppQyV1TableMaps::getDictionaryTableName($lang);
                    if (!$schema->hasTable($dict)) {
                        continue;
                    }
                    $entry = $conn->table($dict)->where('md5', $row->content_hash)->first(['id', 'has_audio', 'tts_files']);
                    if (!$entry || !empty($entry->has_audio)) {
                        continue; // No row, or audio already present — never clobber.
                    }
                    $ttsFiles = json_decode($entry->tts_files ?? '[]', true) ?: [];
                    $known = array_filter(array_map(fn ($f) => $f['path'] ?? null, $ttsFiles));
                    if (!in_array($row->audio_path, $known, true)) {
                        $ttsFiles[] = ['path' => $row->audio_path, 'created_at' => (string) ($row->completed_at ?? now())];
                    }
                    $conn->table($dict)->where('id', $entry->id)->update([
                        'tts_files' => json_encode($ttsFiles, JSON_UNESCAPED_UNICODE),
                        'has_audio' => true,
                        'tts_status' => 'completed',
                        'tts_completed_at' => $row->completed_at,
                    ]);
                    $result['words_salvaged']++;
                }
            });

        // ---- 1b. Completed ARTICLE tasks → {lang}_article_library (fill-missing) ----
        $conn->table($queueTable)
            ->where('task_type', 'article')
            ->where('status', 'completed')
            ->whereNotNull('audio_files')
            ->orderBy('id')
            ->chunk(100, function ($rows) use ($conn, $schema, $appKey, &$result) {
                foreach ($rows as $row) {
                    $lang = strtolower((string) $row->language);
                    $articlesTable = AppTablePrefixServiceProvider::buildTableName($appKey, "{$lang}_article_library");
                    if (!$schema->hasTable($articlesTable)) {
                        continue;
                    }
                    $article = $conn->table($articlesTable)
                        ->where('md5', $row->content_hash)
                        ->first(['id', 'has_audio']);
                    if (!$article || !empty($article->has_audio)) {
                        continue;
                    }
                    $update = [
                        'audio_files' => $row->audio_files,
                        'has_audio' => true,
                        'tts_provider' => 'edge-tts',
                    ];
                    if ($schema->hasColumn($articlesTable, 'tts_status')) {
                        $update['tts_status'] = 'completed';
                        $update['tts_completed_at'] = $row->completed_at;
                    }
                    $conn->table($articlesTable)->where('id', $article->id)->update($update);
                    $result['articles_salvaged']++;
                }
            });

        // ---- 1c. Pending/failed WORD intent → tts_cache_{lang} state ----
        $conn->table($queueTable)
            ->where('task_type', 'word')
            ->whereIn('status', ['pending', 'processing', 'failed'])
            ->orderBy('id')
            ->chunk(500, function ($rows) use ($conn, $schema, &$result) {
                foreach ($rows as $row) {
                    $lang = strtolower((string) $row->language);
                    $dict = AppQyV1TableMaps::getDictionaryTableName($lang);
                    if (!$schema->hasTable($dict)) {
                        continue;
                    }
                    $updated = $conn->table($dict)
                        ->where('md5', $row->content_hash)
                        ->where('has_audio', false)
                        ->whereNull('tts_status')
                        ->update([
                            // processing claims do not survive the cutover.
                            'tts_status' => $row->status === 'failed' ? 'failed' : 'pending',
                            'tts_attempts' => (int) ($row->retry_count ?? 0),
                            'tts_error' => $row->error_message,
                            'tts_requested_at' => $row->requested_at ?? $row->created_at,
                        ]);
                    $result['pending_migrated'] += $updated;
                }
            });

        // ---- 3. Drop the intermediate table ----
        $schema->drop($queueTable);
        $result['dropped'] = true;

        Log::info('[TTSQueueDecommission] tts_queue decommissioned', $result);

        return $result;
    }

    /**
     * Cheap canonical-flag reconciliation (no filesystem scans): a row that
     * claims audio but has an empty tts_files list cannot serve anything —
     * reset it to pending so the pipeline regenerates it.
     */
    private static function reconcileCanonicalFlags($conn, $schema): int
    {
        $fixed = 0;
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $dict = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!$schema->hasTable($dict) || !$schema->hasColumn($dict, 'tts_status')) {
                continue;
            }
            $fixed += $conn->table($dict)
                ->where('has_audio', true)
                ->where(function ($q) {
                    $q->whereNull('tts_files')
                        ->orWhere('tts_files', '')
                        ->orWhere('tts_files', '[]')
                        ->orWhere('tts_files', 'null');
                })
                ->update([
                    'has_audio' => false,
                    'tts_status' => 'pending',
                ]);
        }
        return $fixed;
    }
}
