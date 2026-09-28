<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\GlobalTask;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ArticleSentenceAudioService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;

/**
 * Phase 6 — One-time backfill of existing AppQyV1 dictionary media state into
 * the unified GlobalTask system, so the unified view has full history before any
 * read/timer cutover.
 *
 * For every word row ({prefix}_tts_cache_{lang}) with audio state,
 * and every article row ({prefix}_{lang}_article_library) with audio state, it
 * UPSERTs a GlobalTask keyed by a DETERMINISTIC task_id ('dict_' + md5(table|id|
 * kind)) — so the command is fully idempotent and interrupt/resume safe — and
 * writes the linking task_id back onto the dict row. Sentence tables are skipped
 * (sentences stay inline). Dict rows are otherwise never mutated.
 *
 * Reversible: every backfilled row carries the 'dict_' task_id prefix, so a
 * cleanup is simply DELETE FROM global_tasks WHERE task_id LIKE 'dict_%'.
 */
class AppQyV1BackfillGlobalTasks extends Command
{
    protected $signature = 'global-task:backfill-from-appqyv1
        {--chunk=100 : Rows processed per chunk}
        {--lang= : Restrict to a single language code (default: all supported)}
        {--dry-run : Report counts without writing anything}';

    protected $description = 'Backfill existing AppQyV1 dictionary audio state into the GlobalTask system (idempotent).';

    public function handle(): int
    {
        $chunk = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $onlyLang = $this->option('lang');
        $articleAudioService = new AppQyV1ArticleSentenceAudioService();

        $connName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $languages = AppQyV1DictionaryTTSCoordinator::supportedLanguages();
        if ($onlyLang) {
            $languages = array_values(array_filter($languages, fn ($l) => $l === $onlyLang));
        }

        $totals = ['audio' => 0, 'article_audio' => 0];

        foreach ($languages as $lang) {
            // --- Word table (audio only) ---
            try {
                $wordTable = AppQyV1LangDictionaryModel::forLanguage($lang)->getTable();
            } catch (\Throwable $e) {
                $this->warn("Skip language {$lang}: cannot resolve word table ({$e->getMessage()})");
                $wordTable = null;
            }

            if ($wordTable && Schema::connection($connName)->hasTable($wordTable)) {
                $hasTts = Schema::connection($connName)->hasColumn($wordTable, 'tts_status');
                $this->info("Word table {$wordTable} (lang={$lang}) — audio=" . ($hasTts ? 'y' : 'n'));

                if ($hasTts) {
                    DB::connection($connName)->table($wordTable)
                    ->where(function ($q) {
                        $q->whereNotNull('tts_status')->orWhere('has_audio', true);
                    })
                    ->orderBy('id')
                    ->chunkById($chunk, function ($rows) use ($lang, $wordTable, $connName, $dryRun, &$totals) {
                        foreach ($rows as $row) {
                            if ($row->tts_status !== null || !empty($row->has_audio)) {
                                $this->upsertBackfillTask($connName, $wordTable, $row, $lang, $dryRun);
                                $totals['audio']++;
                            }
                        }
                    });
                }
            }

            // --- Article table (audio only) ---
            $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (Schema::connection($connName)->hasTable($articleTable)
                && Schema::connection($connName)->hasColumn($articleTable, 'tts_status')) {

                $this->info("Article table {$articleTable} (lang={$lang}) — audio");

                DB::connection($connName)->table($articleTable)
                    ->where(function ($q) {
                        $q->whereNotNull('tts_status')->orWhere('has_audio', true);
                    })
                    ->orderBy('id')
                    ->chunkById($chunk, function ($rows) use ($lang, $dryRun, $articleAudioService, &$totals) {
                        foreach ($rows as $row) {
                            if (!$dryRun && empty($row->has_audio)) {
                                $article = AppQyV1ArticleLibraryModel::findByMd5($lang, (string) ($row->md5 ?? ''));
                                if ($article) {
                                    $articleAudioService->enqueueLibraryArticle($article, $lang, false);
                                }
                            }
                            $totals['article_audio']++;
                        }
                    });
            }
        }

        $this->newLine();
        $this->info(($dryRun ? '[DRY RUN] Would backfill' : 'Backfilled')
            . " — word audio: {$totals['audio']}, article audio: {$totals['article_audio']}");

        return self::SUCCESS;
    }

    /**
     * Idempotently UPSERT one audio GlobalTask for a dictionary row and link
     * the row back. Keyed by a deterministic task_id so re-runs converge.
     *
     * @param object $row Raw DB row (stdClass)
     */
    private function upsertBackfillTask(
        string $connName,
        string $table,
        $row,
        string $language,
        bool $dryRun
    ): void {
        $detId = 'dict_' . md5($table . '|' . $row->id . '|audio');
        $status = $this->mapStatus($row->tts_status ?? null, !empty($row->has_audio));

        if ($dryRun) {
            return;
        }

        GlobalTask::updateOrCreate(
            ['task_id' => $detId],
            [
                'app_name' => 'AppQyV1',
                'task_type' => 'word_audio',
                'execution_type' => GlobalTask::executionType('remote_audio'),
                'status' => $status,
                'priority' => 0,
                'capability' => GlobalTask::capability('audio'),
                'is_fast_tier' => false,
                'progress' => $status === GlobalTask::status('completed') ? 100.0 : 0.0,
                'payload' => [
                    'language' => $language,
                    'content' => $row->content ?? null,
                    'md5' => $row->md5 ?? null,
                    'backfill' => true,
                ],
                'max_retries' => 3,
                'retry_count' => 0,
                'dict_row_id' => (int) $row->id,
                'dict_language' => $language,
                'dict_row_table' => $table,
                'group_key' => $row->md5 ?? null,
                'sync_to_dict_at' => $status === GlobalTask::status('completed') ? now() : null,
                'completed_at' => $status === GlobalTask::status('completed') ? now() : null,
            ]
        );

        // Link the dict row back (only if the column exists).
        $linkColumn = 'tts_global_task_id';
        if (Schema::connection($connName)->hasColumn($table, $linkColumn)) {
            DB::connection($connName)->table($table)
                ->where('id', $row->id)
                ->update([$linkColumn => $detId]);
        }
    }

    private function mapStatus(?string $dictStatus, bool $hasMedia): string
    {
        if ($hasMedia) {
            return GlobalTask::status('completed');
        }

        return match ($dictStatus) {
            'pending' => GlobalTask::status('pending'),
            'processing' => GlobalTask::status('processing'),
            'completed' => GlobalTask::status('completed'),
            'failed' => GlobalTask::status('failed'),
            default => GlobalTask::status('pending'),
        };
    }
}
