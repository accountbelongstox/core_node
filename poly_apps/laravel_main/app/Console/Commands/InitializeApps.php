<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Utils\AppQyV1Initializer;
use App\Apps\McpV1\McpV1Utils\McpV1Initializer;
use App\Apps\PddToolV1\Utils\PddToolV1Initializer;
use App\Apps\AppQyV1\Services\AppQyV1UserInitializationTableService;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyService;
use App\Services\OctaneTaskStatusService;
use App\Services\AI\UnifiedAIRouter;

class InitializeApps extends Command
{
    protected $signature = 'sys:init';

    protected $description = 'Initialize system databases and resources';

    public function handle()
    {
        $this->info('Initializing system...');
        $this->newLine();

        $this->info('Checking Octane/Swoole compatibility...');
        $this->fixOctaneSwooleCompatibility();
        $this->newLine();

        $this->info('Checking Octane hot-reload dependencies...');
        $this->installChokidar();
        $this->newLine();

        $this->info('Creating external storage directories...');
        $separator = DIRECTORY_SEPARATOR;
        $directories = [
            'avatars' => \App\Providers\PathMapper::getLaravelAvatarsDir(),
            'avatars/appqyv1' => \App\Providers\PathMapper::getLaravelAvatarsDir() . $separator . 'appqyv1',
            'uploads' => \App\Providers\PathMapper::getLaravelUploadsDir(),
            'static' => \App\Providers\PathMapper::getLaravelStaticDir(),
            'cache' => \App\Providers\PathMapper::getLaravelCacheDir(),
            'logs' => \App\Providers\PathMapper::getLaravelLogsDir(),
            'sessions' => \App\Providers\PathMapper::getLaravelSessionsDir(),
            'tmp' => \App\Providers\PathMapper::getLaravelTmpDir(),
        ];

        foreach ($directories as $name => $path) {
            if (!file_exists($path)) {
                mkdir($path, 0755, true);
                $this->line("  ✅ Created {$name}: {$path}");
            } else {
                $this->line("  ✓ Exists {$name}: {$path}");
            }
        }
        $this->newLine();

        $this->info('Running migrations (safe mode - only new tables)...');
        $this->runSafeMigrations();
        $this->newLine();

        $this->info('Creating invite code tables...');
        $inviteCodeResults = \App\Services\InviteCodeInitializer::ensureTablesExist();
        foreach (['invite_codes', 'invite_code_usage', 'default_codes'] as $key) {
            if (isset($inviteCodeResults[$key])) {
                $status = $inviteCodeResults[$key];
                $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
                $this->line("  {$icon} {$key}: {$status}");
            }
        }

        if (isset($inviteCodeResults['codes'])) {
            $this->line("  <fg=cyan>Generated Invite Codes:</>");
            foreach ($inviteCodeResults['codes'] as $type => $code) {
                $this->line("    • {$type}: {$code}");
            }
        }

        if (isset($inviteCodeResults['error'])) {
            $this->error("  ❌ Error: {$inviteCodeResults['error']}");
        }

        $inviteStats = \App\Services\InviteCodeInitializer::getTableStats();
        if (!isset($inviteStats['error'])) {
            $this->line("  <fg=gray>Stats: {$inviteStats['invite_codes']['total']} codes ({$inviteStats['invite_codes']['active']} active), {$inviteStats['invite_code_usage']['total']} usages</>");
        }
        $this->newLine();

        $results = \App\Services\UserSyncService::ensureUserTablesExist();

        $this->info('Database initialization results:');

        foreach ($results as $dbName => $status) {
            $icon = (in_array($status, ['created', 'exists']) || str_contains($status, 'canonical identity')) ? '✅' : '❌';
            $this->line("{$icon} {$dbName}: {$status}");

            if ($this->getOutput()->isVerbose()) {
                $connection = $dbName === 'Main' ? (string) config('database.default') : strtolower($dbName);

                try {
                    if (config("database.connections.{$connection}")) {
                        // $connection is a connection NAME (string); resolve to a
                        // real connection. Driver-aware table listing (sqlite_master
                        // on sqlite, pg_tables on pgsql) via the shared helper.
                        $conn = \Illuminate\Support\Facades\DB::connection($connection);
                        $tables = \App\Services\UserSyncService::listTablesLike($conn, '%');

                        if (!empty($tables)) {
                            foreach ($tables as $table) {
                                $tableName = $table->name;
                                if (str_starts_with($tableName, 'sqlite_')) {
                                    continue;
                                }
                                $count = $conn->table($tableName)->count();
                                $structure = \App\Services\UserSyncService::getTableStructure($connection, $tableName);
                                $indexes = \App\Services\UserSyncService::getTableIndexes($connection, $tableName);

                                $colNames = !empty($structure) ? implode(', ', array_column($structure, 'name')) : '';
                                $idxNames = !empty($indexes) ? implode(', ', array_column($indexes, 'name')) : '';

                                $output = "   • <fg=cyan;options=bold>{$tableName}</>";
                                if ($colNames) {
                                    $output .= " | Cols: {$colNames}";
                                }
                                if ($idxNames) {
                                    $output .= " | Idx: {$idxNames}";
                                }
                                $output .= " | {$count} rows";

                                $this->line($output);
                            }
                        } else {
                            $this->line("   <fg=gray>No tables</>");
                        }
                    }
                } catch (\Exception $e) {
                    $this->line("   <fg=red>Error: {$e->getMessage()}</>");
                }

                $this->newLine();
            }
        }
        
        $successCount = collect($results)->filter(fn($s) => in_array($s, ['created', 'exists']))->count();
        $totalCount = count($results);
        $this->info("Successfully initialized {$successCount}/{$totalCount} databases.");
        $this->newLine();

        // NOTE: the former cleanupConflictingTables() step was removed. It scanned
        // all ~91 languages every run looking for legacy {prefix}_words_{lang} vs
        // {prefix}_{lang}_dictionaries tables -- neither of which is created anymore
        // (canonical is {prefix}_tts_cache_{lang}). Under the per-app pg topology it
        // matched nothing and just added per-start overhead, so it is dead logic.

        $this->info('Creating TTS cache tables (EdgeTTS 91 languages)...');
        $dictResults = \App\Services\UserSyncService::ensureMultiLangDictionaryTablesExist(function($current, $total) {
            $percentage = round(($current / $total) * 100);
            $this->line("  <fg=gray>Progress: {$current}/{$total} ({$percentage}%)</>");
        });
        $createdCount = count(array_filter($dictResults, fn($s) => $s === 'created'));
        $existsCount = count(array_filter($dictResults, fn($s) => $s === 'exists'));
        $this->line("  ✅ Created: {$createdCount}, Exists: {$existsCount}, Total: " . count($dictResults));
        $this->newLine();

        $this->info('Creating voice subtitle user settings tables...');
        $voiceSubtitleResults = \App\Services\UserSyncService::ensureVoiceSubtitleTablesExist();
        foreach ($voiceSubtitleResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
        }
        $this->newLine();

        // TTS state now lives on the canonical tables (tts_cache_{lang} +
        // {lang}_article_library); the intermediate tts_queue table is
        // decommissioned. The decommission run is IDEMPOTENT: it salvages any
        // durable state the queue still uniquely holds (completed article
        // audio, completed word audio, pending intent) fill-missing into the
        // canonical tables, reconciles has_audio/tts_files inconsistencies,
        // then drops the table. Re-runs reconcile only.
        $this->info('TTS coordination: decommissioning intermediate tts_queue (canonical tables are the source of truth)...');
        try {
            $decom = \App\Services\AppQyV1TTSQueueDecommission::run();
            if ($decom['queue_table_present']) {
                $this->line("  ✅ Salvaged: {$decom['words_salvaged']} word audio, {$decom['articles_salvaged']} article audio, {$decom['pending_migrated']} pending intents");
                $this->line($decom['dropped'] ? '  ✅ tts_queue table dropped' : '  ⚠️  tts_queue table NOT dropped (check logs)');
            } else {
                $this->line('  ✓ tts_queue already decommissioned');
            }
            if ($decom['flags_reconciled'] > 0) {
                $this->line("  ✅ Reconciled {$decom['flags_reconciled']} has_audio/tts_files inconsistencies");
            }
        } catch (\Throwable $e) {
            $this->warn('  ⚠️  TTS queue decommission failed (will retry next sys:init): ' . $e->getMessage());
        }

        try {
            $ttsStats = (new \App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator())->statistics();
            $this->line("  <fg=gray>Stats: {$ttsStats['by_status']['pending']} pending, {$ttsStats['by_status']['processing']} processing, {$ttsStats['by_status']['completed']} completed, {$ttsStats['by_status']['failed']} failed</>");
        } catch (\Throwable $e) {
            $this->line('  <fg=gray>Stats unavailable: ' . $e->getMessage() . '</>');
        }
        $this->newLine();

        $this->info('Creating article library tables (all languages)...');
        $articleLibResults = \App\Services\AppQyV1ArticleLibraryInitializer::ensureTablesExist();
        $articleCreated = count(array_filter($articleLibResults, fn($s) => $s === 'created'));
        $articleExists = count(array_filter($articleLibResults, fn($s) => $s === 'exists'));
        $articleTotal = count($articleLibResults);
        $this->line("  ✅ Created: {$articleCreated}, Exists: {$articleExists}, Total: {$articleTotal}");

        $articleStats = \App\Services\AppQyV1ArticleLibraryInitializer::getTableStats();
        if (!isset($articleStats['error'])) {
            $this->line("  <fg=gray>Articles: {$articleStats['total_articles']} total, {$articleStats['total_with_audio']} with audio, {$articleStats['total_without_audio']} without audio</>");
        }
        $this->newLine();

        // NOTE: the legacy per-language {prefix}_{lang}_dictionaries tables are NOT
        // created here anymore. The canonical dictionary table is
        // {prefix}_tts_cache_{lang} (created above by ensureMultiLangDictionaryTablesExist);
        // the runtime never reads {lang}_dictionaries, and creating them produced
        // empty orphan tables that contradicted the cleanup step. Multilingual data
        // is imported straight into the tts_cache_{lang} staging tables below.

        $this->info('Importing multilingual word data...');
        $importResults = \App\Services\UserSyncService::importMultilingualWordsFromMd();
        if (isset($importResults['skipped']) && $importResults['skipped']) {
            $this->line("  ⏭️  {$importResults['message']}");
        } elseif (!empty($importResults['errors'])) {
            foreach ($importResults['errors'] as $error) {
                $this->line("  ❌ {$error}");
            }
        } else {
            $this->line("  ✅ Imported {$importResults['imported']} words from {$importResults['total_files']} files");
        }
        $this->newLine();
        
        $this->info('Initializing dictionary (Step 2: Extended words & translations)...');

        $shouldRunDictInit = true;

        // Fast pre-check. The skip decision MUST key on how many rows already carry
        // a translation -- NOT on the raw row count. The vocabulary importer seeds
        // ~200k bare words (has_translation=0) into the same tts_cache_en table, so
        // a "rows > 0" gate would auto-skip Step 2 forever and translations would
        // never load. Gate on translated rows instead: 0 translated => always run.
        try {
            $dictModel = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
            $dictConnection = $dictModel->getConnection();
            $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('en');

            if (\Illuminate\Support\Facades\Schema::connection($dictConnection->getName())->hasTable($enDictTable)) {
                $existingCount = $dictConnection->table($enDictTable)->count();
                $translatedCount = $dictConnection->table($enDictTable)->where('has_translation', true)->count();

                if ($translatedCount > 0) {
                    // Translations already present -> default to skip (idempotent).
                    // Only prompt on a genuinely interactive TTY; never block an
                    // unattended start.sh / Octane run.
                    $shouldRunDictInit = false;

                    $isInteractive = PHP_SAPI === 'cli' && defined('STDIN') && @stream_isatty(STDIN);
                    if ($isInteractive) {
                        $this->line("  <fg=gray>EN dictionary: {$existingCount} rows, {$translatedCount} translated</>");
                        $this->output->write("  Translations already present. Re-run Step 2 anyway? [y/N] (auto-skip in 15s): ");

                        $answer = 'n';
                        $read = [STDIN];
                        $write = null;
                        $except = null;
                        if (@stream_select($read, $write, $except, 15) > 0) {
                            $input = trim((string) fgets(STDIN));
                            if ($input !== '') {
                                $answer = strtolower($input[0]);
                            }
                        } else {
                            $this->line("\n  <fg=gray>No input in 15s, auto-skipping.</>");
                        }

                        if ($answer === 'y') {
                            $shouldRunDictInit = true;
                            $this->line("  ▶️  Re-running dictionary Step 2...");
                        } else {
                            $this->line("  ⏭️  Skipping dictionary Step 2 ({$translatedCount} translated rows present).");
                        }
                    } else {
                        $this->line("  ⏭️  Skipping dictionary Step 2 ({$translatedCount} translated rows already present).");
                    }
                } else {
                    // No translations yet -> MUST run, regardless of bare-word count.
                    $shouldRunDictInit = true;
                    if ($existingCount > 0) {
                        $this->line("  ▶️  EN dictionary has {$existingCount} rows but 0 translated -> running Step 2 to import translations.");
                    }
                }
            }
        } catch (\Exception $e) {
            $this->line("  <fg=yellow>Warning: dictionary pre-check failed: {$e->getMessage()}</>");
        }

        $dictResults = $shouldRunDictInit
            ? \App\Services\UserSyncService::initializeDictionaryStep2()
            : ['skipped' => true, 'message' => 'Dictionary Step 2 skipped by user / auto-skip'];
        
        if (isset($dictResults['step1_rename_7z'])) {
            $step1 = $dictResults['step1_rename_7z'];
            if (isset($step1['total_files'])) {
                $this->line("  📦 Processing 7z files: {$step1['renamed']}/{$step1['total_files']} renamed");
                if ($step1['extracted'] > 0) {
                    $this->line("  ✅ Extracted JSON file");
                    if (isset($step1['json_file'])) {
                        $sizeMB = round($step1['json_size'] / 1024 / 1024, 2);
                        $this->line("     JSON: {$step1['json_file']} ({$sizeMB} MB)");
                    }
                } else {
                    $this->line("  ⚠️  JSON extraction pending");
                }
                if (!empty($step1['errors'])) {
                    foreach (array_slice($step1['errors'], 0, 3) as $error) {
                        $this->line("     ⚠️  {$error}");
                    }
                }
            }
        }
        
        if (isset($dictResults['step3_import_words'])) {
            $step3 = $dictResults['step3_import_words'];
            if (isset($step3['skipped']) && $step3['skipped']) {
                $this->line("  ⏭️  Words: {$step3['message']}");
            } elseif (isset($step3['imported'])) {
                $this->line("  ✅ Imported {$step3['imported']} words from output.txt");
            } elseif (isset($step3['error'])) {
                $this->line("  ❌ {$step3['error']}");
            }
        }
        
        if (isset($dictResults['step4_update_translations'])) {
            $step4 = $dictResults['step4_update_translations'];
            if (isset($step4['error'])) {
                $this->line("  ❌ Translations: {$step4['error']}");
            } elseif (isset($step4['processed'])) {
                $this->line("  ✅ Translations: processed {$step4['processed']}, updated {$step4['updated']}, inserted {$step4['inserted']}, errors {$step4['errors']}");
            }
        }
        
        if (isset($dictResults['error'])) {
            $this->error("  ❌ Dictionary initialization error: {$dictResults['error']}");
        }
        
        $this->newLine();
        
        $this->info('AppQyV1 dictionary tables summary:');
        try {
            $appKey = AppKeys::APPQYV1;
            $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
            $connection = $model->getConnection();
            $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
            // Canonical dictionary tables are {prefix}_tts_cache_{lang} (the legacy
            // {prefix}_{lang}_dictionaries pattern matched nothing -> summary was
            // always empty). Exclude the _staging Stage-1 tables.
            $pattern = $prefix . '_tts_cache_%';
            $allDictTables = \App\Services\UserSyncService::listTablesLike($connection, $pattern);

            $tablesWithData = [];
            $tablesEmpty = [];

            foreach ($allDictTables as $tableObj) {
                $tableName = $tableObj->name;
                if (str_ends_with($tableName, '_staging')) {
                    continue;
                }
                try {
                    $count = $connection->table($tableName)->count();
                    $langCode = str_replace($prefix . '_tts_cache_', '', $tableName);
                    if ($count > 0) {
                        // md5 is created UNIQUE on these formal tables, so
                        // count(distinct md5) == count(*) is GUARANTEED by the
                        // constraint. Verifying the UNIQUE INDEX exists (schema-only,
                        // cheap) replaces a full distinct scan on EVERY re-run (e.g.
                        // EN 233k rows). Only when the constraint is somehow missing
                        // do we fall back to a real distinct count to quantify dupes.
                        $uniqueOk = $this->hasUniqueSingleColumnIndex($connection, $tableName, 'md5');
                        $distinctMd5 = $uniqueOk
                            ? $count
                            : (int) $connection->table($tableName)->distinct()->count('md5');
                        $tablesWithData[] = [
                            'name' => $tableName,
                            'code' => $langCode,
                            'count' => $count,
                            'distinct_md5' => $distinctMd5,
                            'unique_ok' => $uniqueOk,
                        ];
                    } else {
                        $tablesEmpty[] = $tableName;
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }

            if (!empty($tablesWithData)) {
                $this->line("  <fg=green>Tables with data:</>");
                foreach ($tablesWithData as $tableInfo) {
                    $dup = $tableInfo['count'] - $tableInfo['distinct_md5'];
                    if ($dup > 0) {
                        $this->line("    • {$tableInfo['code']}: {$tableInfo['count']} entries  <fg=red>⚠️ {$dup} DUPLICATE md5 -- UNIQUE constraint NOT enforced</>");
                    } elseif (empty($tableInfo['unique_ok'])) {
                        $this->line("    • {$tableInfo['code']}: {$tableInfo['count']} entries  <fg=yellow>(no md5 UNIQUE index; 0 dupes now)</>");
                    } else {
                        $this->line("    • {$tableInfo['code']}: {$tableInfo['count']} entries <fg=green>(md5 UNIQUE ✓)</>");
                    }
                }
            }

            $emptyCount = count($tablesEmpty);
            if ($emptyCount > 0) {
                $this->line("  <fg=gray>Empty tables: {$emptyCount} (ready for import)</>");
            }

            $totalDictTables = count($allDictTables);
            $this->line("  <fg=cyan>Total dictionary tables: {$totalDictTables}</>");
        } catch (\Exception $e) {
            $this->line("  <fg=red>Error: {$e->getMessage()}</>");
        }

        $this->newLine();

        $this->info('Creating AppQyV1 user initialization tables...');
        $userInitResults = AppQyV1UserInitializationTableService::ensureTablesExist();
        foreach ($userInitResults as $table => $status) {
            $icon = ($status === 'created' || $status === 'exists') ? '✅' : '❌';
            $this->line("  {$icon} {$table}: {$status}");
        }
        $this->newLine();

        $this->info('Verifying Octane Timer tasks...');
        $taskStatusService = new OctaneTaskStatusService();
        $taskVerification = $taskStatusService->verifyInitialization();

        if ($taskVerification['success']) {
            $this->line("  ✅ All Octane timer tasks properly configured");
            $summary = $taskVerification['summary'];
            $this->line("     Discovered: {$summary['total_discovered']} tasks");
            $this->line("     Registered: {$summary['total_registered']} tasks");
            $this->line("     Running: {$summary['total_running']} tasks");
            $this->line("     Timer: " . ($summary['timer_running'] ? 'Running' : 'Not Running'));

            $basicTasks = $taskStatusService->getBasicTaskObjects();
            foreach ($basicTasks as $task) {
                $statusIcon = match($task['status']) {
                    'running' => '✅',
                    'waiting' => '⏳',
                    'disabled' => '⏸️',
                    'error' => '❌',
                    default => '○'
                };
                $this->line("     {$statusIcon} {$task['name']} ({$task['interval']}s) - {$task['status']}");
            }
        } else {
            // EXPECTED during sys:init: the Octane timer only runs INSIDE the Octane
            // runtime, which start.sh launches AFTER sys:init finishes. So "timer not
            // running / heartbeat missing" here is normal ordering, not a failure --
            // the tasks are registered now and activate when Octane starts next.
            $this->line("  ℹ️  Octane timer not active yet (expected): it starts with the Octane runtime AFTER sys:init.");
            foreach ($taskVerification['issues'] as $issue) {
                $this->line("     • {$issue}");
            }
            $this->line("  ℹ️  Tasks are registered; they activate automatically when Octane launches.");
        }
        $this->newLine();
        
        $this->info('Checking vocabulary library tables...');
        $vocabResults = AppQyV1VocabularyService::ensureVocabularyTablesExist();
        $missingCount = 0;
        foreach ($vocabResults as $table => $status) {
            $icon = $status === 'exists' ? '✅' : ($status === 'missing' ? '⚠️' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
            if ($status === 'missing') {
                $missingCount++;
            }
        }
        if ($missingCount > 0) {
            // These tables are created by the migrations that already ran earlier in
            // THIS command (see "Running migrations" above). If any are still missing,
            // a migration failed -- check that output -- rather than re-running sys:init.
            $this->line("  <fg=yellow>⚠️  {$missingCount} vocabulary table(s) missing despite migrations; check the migration output above.</>");
        }

        $this->newLine();

        $this->info('Importing vocabulary libraries from files...');
        $importResults = AppQyV1VocabularyService::importVocabularyFromFiles();
        $this->line("  ✅ Imported: {$importResults['imported']} libraries");
        $this->line("  ✓ Skipped: {$importResults['skipped']} libraries");
        if ($importResults['errors'] > 0) {
            $this->line("  ❌ Errors: {$importResults['errors']}");
        }
        
        foreach ($importResults['libraries'] as $file => $status) {
            $this->line("    • {$file}: {$status}");
        }
        
        $this->newLine();
        
        $this->info('Vocabulary library summary:');
        try {
            $appKey = AppKeys::APPQYV1;
            $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel();
            $libraries = $model->getConnection()
                ->table(AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries'))
                ->select('name', 'total_words', 'difficulty_level')
                ->where('is_public', true)
                ->get();
            
            foreach ($libraries as $lib) {
                $this->line("  • {$lib->name}: {$lib->total_words} words ({$lib->difficulty_level})");
            }
        } catch (\Exception $e) {
            $this->line("  <fg=red>Error: {$e->getMessage()}</>");
        }
        
        $this->newLine();

        $this->info('Initializing Global Task System...');
        $globalTaskResults = \App\Services\GlobalTaskSystemInitializer::ensureTablesExist();

        foreach ($globalTaskResults as $table => $status) {
            if (str_starts_with($status, 'error:')) {
                $this->line("  ❌ {$table}: {$status}");
            } elseif ($status === 'created') {
                $this->line("  ✅ {$table}: table created");
            } elseif ($status === 'updated') {
                $this->line("  ✅ {$table}: fields added");
            } elseif ($status === 'exists') {
                $this->line("  ✓ {$table}: already configured");
            } elseif ($status === 'table_missing') {
                $this->line("  ⚠️  {$table}: base table not found");
            } else {
                $this->line("  • {$table}: {$status}");
            }
        }

        // Show statistics
        $taskStats = \App\Services\GlobalTaskSystemInitializer::getTableStats();
        if (!empty($taskStats) && !isset($taskStats['error'])) {
            $this->newLine();
            $this->line('  Global Task System Statistics:');

            if (isset($taskStats['global_tasks'])) {
                $stats = $taskStats['global_tasks'];
                $this->line("    Tasks: {$stats['total']} total ({$stats['pending']} pending, {$stats['processing']} processing, {$stats['completed']} completed, {$stats['failed']} failed)");
            }

            if (isset($taskStats['workers'])) {
                $stats = $taskStats['workers'];
                $this->line("    Workers: {$stats['total']} total ({$stats['online']} online, {$stats['busy']} busy, {$stats['offline']} offline)");
            }
        } elseif (isset($taskStats['error'])) {
            $this->line("  ⚠️  Could not fetch statistics: {$taskStats['error']}");
        }

        $this->newLine();

        $this->info('Initializing media ingestion tables...');
        $this->initializeMediaIngestTables();
        $this->newLine();

        $this->info('Seeding punctuation markers (Books Sentence/Word Model v2)...');
        $this->seedPunctuationMarkers();
        $this->newLine();

        $this->info('Verifying AI providers...');
        $aiRouter = new UnifiedAIRouter();
        $providersStatus = $aiRouter->getProvidersStatus();

        foreach ($providersStatus as $provider => $status) {
            $icon = $status['available'] ? '✅' : '❌';
            $type = $status['type'] ?? 'unknown';
            $priority = isset($status['priority']) ? " (Priority: {$status['priority']})" : '';

            $this->line("  {$icon} {$provider}: " . ($status['available'] ? 'Available' : 'Not configured') . " ({$type}){$priority}");

            // Show key count and rate limits
            if ($status['available'] && isset($status['key_count'])) {
                $keyCount = $status['key_count'];
                $multiplier = $status['rate_limit_multiplier'] ?? 1;
                $this->line("     Keys: {$keyCount} (Rate limit multiplier: {$multiplier}x)");

                if (isset($status['effective_limits'])) {
                    $limits = $status['effective_limits'];
                    $limitStr = [];
                    if (isset($limits['rpm'])) $limitStr[] = "{$limits['rpm']} req/min";
                    if (isset($limits['rpd'])) $limitStr[] = "{$limits['rpd']} req/day";
                    if (!empty($limitStr)) {
                        $this->line("     Limits: " . implode(', ', $limitStr));
                    }
                }
            }

            // Show usage stats
            if ($status['available'] && isset($status['usage'])) {
                $usage = $status['usage'];

                // For multi-key providers, show aggregate stats
                if (isset($usage['aggregate'])) {
                    $agg = $usage['aggregate'];
                    if (isset($agg['minute']['requests'])) {
                        $this->line("     Usage (all keys): {$agg['minute']['requests']} req/min, {$agg['day']['requests']} req/day");
                    }
                } else {
                    // Legacy single-key display
                    if (isset($usage['minute']['requests'])) {
                        $this->line("     Minute: {$usage['minute']['requests']} requests");
                    }
                    if (isset($usage['day']['requests'])) {
                        $this->line("     Day: {$usage['day']['requests']} requests");
                    }
                }
            }
        }
        $this->newLine();

        $this->info('Initializing apps...');
        $manager = new AppInitializationManager();
        $manager->register(new AppQyV1Initializer());
        $manager->register(new McpV1Initializer());
        $manager->register(new PddToolV1Initializer());
        $result = $manager->initializeAll(false);
        
        foreach ($result['results'] as $appName => $appResult) {
            $this->displayAppResult($appName, $appResult);
        }
        
        $this->newLine();
        
        if ($result['success']) {
            $this->info('✅ System initialized successfully!');
            return Command::SUCCESS;
        } else {
            $this->error('❌ System initialization failed');
            return 1;
        }
    }
    
    /**
     * Cheap schema-only check: does $table have a single-column UNIQUE index on
     * $column? Used to confirm md5 uniqueness without a full distinct scan on every
     * sys:init re-run. Returns false (no fast-path) if introspection fails.
     */
    private function hasUniqueSingleColumnIndex($connection, string $table, string $column): bool
    {
        try {
            foreach ($connection->getSchemaBuilder()->getIndexes($table) as $idx) {
                $cols = $idx['columns'] ?? [];
                if (!empty($idx['unique']) && count($cols) === 1 && in_array($column, $cols, true)) {
                    return true;
                }
            }
        } catch (\Throwable $e) {
            // schema introspection unavailable -> treat as unknown
        }

        return false;
    }

    private function showStatus(AppInitializationManager $manager)
    {
        $this->info('Checking initialization status...');
        $this->newLine();
        
        $status = $manager->checkStatus();
        $detailedStatus = $manager->getDetailedStatus();
        
        foreach ($status['apps'] as $appName => $appStatus) {
            $initialized = $appStatus['initialized'] ?? false;
            $statusIcon = $initialized ? '✅' : '❌';
            
            $this->line("{$statusIcon} <fg=cyan;options=bold>{$appName}</>");
            
            $details = $detailedStatus[$appName] ?? [];
            if (isset($details['registered_class'])) {
                $this->line("   <fg=gray>Initializer: {$details['registered_class']}</>");
            }
            
            if (isset($appStatus['error'])) {
                $this->error("   Error: {$appStatus['error']}");
            } else {
                $completedSteps = $appStatus['completed_steps'] ?? [];
                $stepCount = count(array_filter($completedSteps));
                $totalSteps = count($completedSteps);
                
                $this->line("   <fg=yellow>Progress: {$stepCount}/{$totalSteps} steps completed</>");
                $this->newLine();
                
                if (!empty($completedSteps)) {
                    foreach ($completedSteps as $step => $completed) {
                        $stepIcon = $completed ? '✓' : '○';
                        $stepColor = $completed ? 'green' : 'gray';
                        $this->line("   <fg={$stepColor}>{$stepIcon} {$step}</>");
                    }
                }
                
                $this->newLine();
                
                if (isset($appStatus['last_run'])) {
                    $this->line("   <fg=gray>Last run: {$appStatus['last_run']}</>");
                }
                
                if (isset($details['database'])) {
                    $this->newLine();
                    $this->line("   <fg=cyan;options=bold>📊 Database Information:</>");
                    $dbInfo = $details['database'];
                    
                    if (isset($dbInfo['connection'])) {
                        $this->line("   Connection: <fg=yellow>{$dbInfo['connection']}</>");
                    }
                    
                    if (isset($dbInfo['path'])) {
                        $this->line("   Path: <fg=yellow>{$dbInfo['path']}</>");
                    }
                    
                    if (isset($dbInfo['size'])) {
                        $this->line("   Size: <fg=yellow>{$dbInfo['size']}</>");
                    }
                    
                    if (isset($dbInfo['tables'])) {
                        $tableCount = count($dbInfo['tables']);
                        $this->line("   Tables: <fg=yellow>{$tableCount}</>");
                        
                        if ($tableCount > 0 && $tableCount <= 10) {
                            $this->newLine();
                            $this->line("   <fg=cyan>Table Structure:</>");
                            foreach ($dbInfo['tables'] as $table) {
                                $this->line("   • {$table['name']} ({$table['columns']} columns, {$table['rows']} rows)");
                            }
                        } elseif ($tableCount > 10) {
                            $this->newLine();
                            $this->line("   <fg=cyan>Sample Tables (showing first 5):</>");
                            foreach (array_slice($dbInfo['tables'], 0, 5) as $table) {
                                $this->line("   • {$table['name']} ({$table['columns']} columns, {$table['rows']} rows)");
                            }
                            $this->line("   <fg=gray>... and " . ($tableCount - 5) . " more tables</>");
                        }
                    }
                }
            }
            
            $this->newLine();
            $this->line("   " . str_repeat('─', 70));
            $this->newLine();
        }
        
        return 0;
    }
    
    private function resetStatus(AppInitializationManager $manager)
    {
        $appName = $this->argument('app');
        
        if (!$appName) {
            $this->error('Please specify an app to reset');
            return 1;
        }
        
        if (!$this->confirm("Reset initialization status for {$appName}?")) {
            $this->info('Reset cancelled');
            return 0;
        }
        
        $result = $manager->reset($appName);
        
        if ($result['success']) {
            $this->info("✅ Reset successful for {$appName}");
            return 0;
        } else {
            $this->error("❌ Reset failed: {$result['error']}");
            return 1;
        }
    }
    
    private function initializeAll(AppInitializationManager $manager, bool $force)
    {
        $this->info('Initializing all registered apps...');
        
        if ($force) {
            $this->warn('⚠️  Force mode enabled - all steps will be re-executed');
        }
        
        $this->newLine();
        
        $result = $manager->initializeAll($force);
        
        foreach ($result['results'] as $appName => $appResult) {
            $this->displayAppResult($appName, $appResult);
        }
        
        $this->newLine();
        
        if ($result['success']) {
            $this->info('✅ All apps initialized successfully!');
            return 0;
        } else {
            $this->error('❌ Some apps failed to initialize');
            return 1;
        }
    }
    
    private function initializeApp(AppInitializationManager $manager, string $appName, bool $force)
    {
        $this->info("Initializing {$appName}...");
        
        if ($force) {
            $this->warn('⚠️  Force mode enabled - all steps will be re-executed');
        }
        
        $this->newLine();
        
        $result = $manager->initialize($appName, $force);
        
        if (isset($result['available_apps'])) {
            $this->error("App '{$appName}' not found");
            $this->info('Available apps: ' . implode(', ', $result['available_apps']));
            return 1;
        }
        
        $this->displayAppResult($appName, $result);
        
        $this->newLine();
        
        if ($result['success']) {
            $this->info("✅ {$appName} initialized successfully!");
            return 0;
        } else {
            $this->error("❌ {$appName} initialization failed");
            return 1;
        }
    }
    
    private function displayAppResult(string $appName, array $result)
    {
        $this->line("<fg=cyan;options=bold>═══ {$appName} ═══</>");
        
        if (isset($result['registered_class'])) {
            $this->line("<fg=gray>Initializer: {$result['registered_class']}</>");
            $this->newLine();
        }
        
        if (isset($result['steps'])) {
            foreach ($result['steps'] as $step => $stepResult) {
                $status = $stepResult['status'] ?? 'unknown';
                $description = $stepResult['description'] ?? $step;
                $message = $stepResult['message'] ?? '';
                
                switch ($status) {
                    case 'success':
                        $this->line("  ✅ {$description}");
                        if ($message) {
                            $this->line("     <fg=gray>{$message}</>");
                        }
                        break;
                        
                    case 'skipped':
                        $this->line("  ⏭️  {$description} <fg=yellow>(skipped)</>");
                        break;
                        
                    case 'warning':
                        $this->warn("  ⚠️  {$description}");
                        if ($message) {
                            $this->warn("     {$message}");
                        }
                        break;
                        
                    case 'error':
                        $this->error("  ❌ {$description}");
                        if ($message) {
                            $this->error("     {$message}");
                        }
                        break;
                }
            }
        }
        
        if (isset($result['error'])) {
            $this->error("  Error: {$result['error']}");
        }
    }

    /**
     * Run database migrations with idempotency (safe mode)
     * 
     * ============================================================================
     * IMPORTANT: DATA SAFETY GUARANTEES
     * ============================================================================
     * 
     * 1. The --force flag ONLY bypasses confirmation prompts in production.
     *    It does NOT delete tables or modify existing data.
     * 
     * 2. Migration behavior (idempotent):
     *    - If table doesn't exist: Creates the table with all required columns
     *    - If table exists: Checks for missing columns and adds them (preserves data)
     *    - If table exists with all columns: Skips (no changes)
     * 
     * 3. All migration files MUST use hasTable() checks to ensure idempotency.
     *    Migration files that don't check table existence are unsafe.
     * 
     * 4. This ensures:
     *    - Tables are created if missing (no data loss, table doesn't exist)
     *    - Missing columns are added without data loss (preserves existing data)
     *    - Existing data is always preserved (never deleted or modified)
     *    - Code aligns with database structure (not rebuilding tables)
     * 
     * 5. Why use --force?
     *    - In production, Laravel asks for confirmation before running migrations
     *    - --force bypasses this prompt (required for automated scripts)
     *    - --force does NOT change migration behavior (migrations are still idempotent)
     *    - --force does NOT delete data (migrations use hasTable() checks)
     * 
     * ============================================================================
     * LINE-BY-LINE EXPLANATION
     * ============================================================================
     */
    private function runSafeMigrations()
    {
        try {
            // Line 793: Display message to user about migration mode
            // This informs the user that migrations run in idempotent mode (preserves data)
            $this->line("  <fg=cyan>Running database migrations (idempotent mode - preserves data)</>");

            // ====================================================================
            // DEFAULT CONNECTION MIGRATIONS
            // ====================================================================
            // Line 798-800: Run migrations on default connection (usually 'sqlite')
            // 
            // --force parameter explanation:
            //   - Purpose: Bypass production confirmation prompts
            //   - Does NOT: Delete tables, modify data, or change migration behavior
            //   - Safe to use: Yes, because migrations use hasTable() checks
            // 
            // Migration execution flow:
            //   1. Laravel reads migration files from database/migrations/
            //   2. Checks migrations table to see which migrations have run
            //   3. Runs only NEW migrations (not already executed)
            //   4. Each migration file checks hasTable() before creating tables
            //   5. If table exists, migration adds missing columns (preserves data)
            //   6. If table doesn't exist, migration creates table with all columns
            // 
            // Data safety:
            //   - Migrations never drop tables (unless explicitly in down() method)
            //   - Migrations never delete data (only add columns)
            //   - Migrations are idempotent (safe to run multiple times)
            
            // Print command before execution
            $this->line("  <fg=yellow>Command: php artisan migrate --force</>");
            $exitCode = $this->call('migrate', [
                '--force' => true, // Line 799: Bypass confirmation only, safe to use (does NOT delete data)
            ]);
            
            // Line 802-806: Check migration exit code and display result
            // Exit code 0 means success, non-zero means some migrations had issues
            // Note: Even if some migrations fail, data is still safe (no deletions occurred)
            if ($exitCode === 0) {
                $this->line("  ✅ Default connection migrations completed");
            } else {
                $this->warn("  ⚠️  Some default connection migrations encountered issues");
            }

            // NOTE (idempotency): a SINGLE `migrate --force` on the default
            // connection above already applies EVERY migration file exactly once.
            // Each per-app migration routes its own tables via
            // Schema::connection($this->connection) (app_qy_v1_database,
            // bank_v1_database, ...), while the migration repository is tracked
            // centrally on the default connection. The former per-connection
            // `migrate --database=appqyv1/bankv1` calls were REDUNDANT and, under
            // the one-database-per-app topology, re-ran every framework/global
            // migration against each per-app database (creating duplicate
            // users/jobs/global_tasks tables there and re-executing every file on
            // first init). Removing them keeps sys:init migrations idempotent and
            // free of cross-database pollution. (Verified: the only connection-less
            // migrations create framework/global tables that belong on the default
            // connection, so none depended on --database routing.)

        } catch (\Exception $e) {
            // Line 824: Catch and display any exceptions during migration
            // This ensures errors are reported but don't crash the entire initialization
            $this->error("  ❌ Migration error: " . $e->getMessage());
        }
    }

    /**
     * Initialize the dedicated media ingestion tables (idempotent).
     *
     * Creates / aligns app_qy_v1_subtitles, app_qy_v1_books, app_qy_v1_source_sentences,
     * app_qy_v1_media_segments and the per-language app_qy_v1_sentences_{lang} /
     * app_qy_v1_chapters_{lang} tables via SafeMigrationHelper so re-running sys:init
     * only ADDS missing columns/indexes and never drops data. (Books v3.1: the shared
     * sentences/chapters tables are removed.)
     */
    private function initializeMediaIngestTables()
    {
        $mediaResults = \App\Services\MediaIngestTablesInitializer::ensureTablesExist();

        foreach ($mediaResults as $table => $status) {
            if (str_starts_with($status, 'error:')) {
                $this->line("  ❌ {$table}: {$status}");
            } elseif ($status === 'created') {
                $this->line("  ✅ {$table}: table created");
            } elseif ($status === 'updated') {
                $this->line("  ✅ {$table}: fields added");
            } else {
                $this->line("  ✓ {$table}: already aligned");
            }
        }

        $mediaStats = \App\Services\MediaIngestTablesInitializer::getTableStats();
        if (!isset($mediaStats['error'])) {
            $this->line("  <fg=gray>Stats: {$mediaStats['sentences']} sentences, {$mediaStats['chapters']} chapters, {$mediaStats['subtitles']} subtitles, {$mediaStats['books']} books, {$mediaStats['source_sentences']} source_sentences, {$mediaStats['segments']} segments</>");
        } else {
            $this->line("  ⚠️  Could not fetch media stats: {$mediaStats['error']}");
        }
    }

    /**
     * Seed the canonical punctuation-marker reference set (idempotent).
     *
     * Mirrors pycore/pyfoundations/punctuation_markers.py (_MARKERS) into
     * app_qy_v1_punctuation_markers, upserting by `code` (never clobbers). Safe
     * to re-run; ensures the table exists first.
     */
    private function seedPunctuationMarkers()
    {
        try {
            $result = \App\Services\PunctuationMarkerSeeder::seed();
            $this->line("  ✅ {$result['table']}: {$result['created']} created, {$result['updated']} re-aligned, {$result['unchanged']} unchanged");
        } catch (\Throwable $e) {
            $this->error("  ❌ Punctuation marker seed failed: " . $e->getMessage());
        }
    }

    /**
     * Fix Octane/Swoole compatibility
     *
     * PHP Version: 8.5 (Upgraded from 8.4)
     * Swoole Version: 6.x (Compiled from master for PHP 8.5 compatibility)
     *
     * Swoole 6.x compatibility patch for Laravel Octane v2.13.x
     * Issue: Swoole 6.x changed task event signature (breaking change)
     * - Swoole 5.x: task(Server $server, int $taskId, int $fromWorkerId, $data)
     * - Swoole 6.x: task(Server $server, Server\Task $task)
     *
     * This method calls App\Support\OctaneSwooleCompatFixer to apply the patch
     * The patch is idempotent (safe to run multiple times)
     */
    private function fixOctaneSwooleCompatibility()
    {
        if (!is_dir(base_path('vendor/laravel/octane'))) {
            $this->line("  <fg=yellow>⏭️  Laravel Octane not installed, skipping</>");
            return;
        }

        try {
            $fixer = new \App\Support\OctaneSwooleCompatFixer(base_path());
            $result = $fixer->run();

            switch ($result['status']) {
                case 'fixed':
                    $this->line("  ✅ Compatibility patch applied (Swoole {$result['swoole_version']})");
                    break;
                case 'already_fixed':
                    $this->line("  ✓ Compatibility patch already applied (Swoole {$result['swoole_version']})");
                    break;
                case 'compatible':
                    $this->line("  ✓ Swoole {$result['swoole_version']} - compatible with Octane v2.13.x");
                    break;
                case 'skipped':
                    if (($result['reason'] ?? '') === 'swoole_not_installed' && PHP_OS_FAMILY !== 'Windows') {
                        $result = $this->ensureSwooleThenRefix($fixer);
                        if (($result['status'] ?? '') === 'fixed') {
                            $this->line("  ✅ Compatibility patch applied (Swoole {$result['swoole_version']})");
                        } elseif (($result['status'] ?? '') === 'already_fixed') {
                            $this->line("  ✓ Compatibility patch already applied (Swoole {$result['swoole_version']})");
                        } elseif (($result['status'] ?? '') === 'compatible') {
                            $this->line("  ✓ Swoole {$result['swoole_version']} - compatible with Octane v2.13.x");
                        } else {
                            $this->line("  ⏭️  Compatibility check skipped: {$result['reason']}");
                        }
                    } else {
                        $this->line("  ⏭️  Compatibility check skipped: {$result['reason']}");
                    }
                    break;
                case 'unknown':
                    $this->line("  <fg=yellow>⚠️  Unknown Swoole version: {$result['swoole_version']}</>");
                    break;
                default:
                    $this->line("  <fg=yellow>⚠️  Unexpected status: {$result['status']}</>");
            }
        } catch (\Exception $e) {
            $this->warn("  ⚠️  Compatibility check error: " . $e->getMessage());
        }
    }

    /**
     * Swoole missing on a non-Windows host: invoke the canonical installer
     * (scripts/shells/linux/debian/install_shells/32_install_swoole.sh), then
     * re-run the Octane/Swoole compatibility fixer once. Octane is the single
     * task-system driver, so Swoole is required on Linux/WSL.
     */
    private function ensureSwooleThenRefix(\App\Support\OctaneSwooleCompatFixer $fixer): array
    {
        $repoRoot = dirname(base_path(), 2);
        $installScript = $repoRoot . '/scripts/shells/linux/debian/install_shells/32_install_swoole.sh';
        $exitCode = 0;

        if (!is_file($installScript)) {
            $this->warn("  ⚠️  Swoole installer missing: {$installScript}");
            return ['status' => 'skipped', 'reason' => 'swoole_not_installed'];
        }

        $this->line("  <fg=cyan>Swoole not installed -> running installer (may build from source, can take several minutes)...</>");
        $this->line("  <fg=yellow>Command: bash {$installScript}</>");
        passthru('bash ' . escapeshellarg($installScript), $exitCode);

        if ($exitCode !== 0) {
            $this->warn("  ⚠️  Swoole installer exited with code {$exitCode}; Octane will be unavailable (degraded fallback).");
            return ['status' => 'skipped', 'reason' => 'swoole_not_installed'];
        }

        // Re-run the fixer; the installer also applies the Octane 6.x patch itself,
        // so this is mostly a verification / idempotent second pass.
        return $fixer->run();
    }

    private function installChokidar()
    {
        $laravelPath = base_path();
        $isWindows = PHP_OS_FAMILY === 'Windows';
        $separator = $isWindows ? '\\' : '/';
        $chokidarPath = $laravelPath . $separator . 'node_modules' . $separator . 'chokidar';

        $this->line("  <fg=cyan>Checking Node.js and pnpm...</>");

        // Platform-specific command to check if command exists
        if ($isWindows) {
            $this->line("  <fg=yellow>Command: where node</>");
            exec('where node 2>NUL', $nodeOutput, $nodeCode);
            $this->line("  <fg=yellow>Command: where pnpm</>");
            exec('where pnpm 2>NUL', $pnpmOutput, $pnpmCode);
        } else {
            $this->line("  <fg=yellow>Command: command -v node</>");
            exec('command -v node 2>&1', $nodeOutput, $nodeCode);
            $this->line("  <fg=yellow>Command: command -v pnpm</>");
            exec('command -v pnpm 2>&1', $pnpmOutput, $pnpmCode);
        }

        if ($nodeCode !== 0) {
            $this->warn("  ⚠️  Node.js not found - hot-reload will not be available");
            $this->line("     Install Node.js to enable Octane --watch mode");
            return;
        }

        if ($pnpmCode !== 0) {
            $this->warn("  ⚠️  pnpm not found - hot-reload will not be available");
            $this->line("     Install pnpm to enable Octane --watch mode (npm install -g pnpm)");
            return;
        }

        $this->line("  <fg=yellow>Command: node --version</>");
        exec('node --version 2>&1', $nodeVersion);
        $this->line("  <fg=yellow>Command: pnpm --version</>");
        exec('pnpm --version 2>&1', $pnpmVersion);
        $this->line("  ✓ Node.js: " . trim($nodeVersion[0] ?? 'unknown'));
        $this->line("  ✓ pnpm: " . trim($pnpmVersion[0] ?? 'unknown'));

        $this->line("  <fg=cyan>Installing/Verifying chokidar (always runs)...</>");

        $originalDir = getcwd();
        chdir($laravelPath);

        if (is_dir($chokidarPath)) {
            $this->line("  ⟳ chokidar exists, verifying installation...");
            $this->line("  <fg=yellow>Command: pnpm install --save-dev chokidar</>");
            exec('pnpm install --save-dev chokidar 2>&1', $output, $code);
        } else {
            $this->line("  ⬇ Installing chokidar...");
            $this->line("  <fg=yellow>Command: pnpm install --save-dev chokidar</>");
            exec('pnpm install --save-dev chokidar 2>&1', $output, $code);
        }

        chdir($originalDir);

        if ($code !== 0) {
            $this->warn("  ⚠️  chokidar installation had issues:");
            foreach (array_slice($output, -3) as $line) {
                $this->line("     " . $line);
            }
            return;
        }

        if (is_dir($chokidarPath)) {
            // Platform-specific version check
            if ($isWindows) {
                $this->line("  <fg=yellow>Command: pnpm list chokidar</>");
                exec('pnpm list chokidar 2>&1', $versionOutput);
                // Extract version from output (Windows doesn't have grep/head)
                $version = 'unknown';
                foreach ($versionOutput as $line) {
                    if (stripos($line, 'chokidar') !== false && stripos($line, '@') !== false) {
                        // Extract version like "chokidar@3.5.3"
                        if (preg_match('/chokidar@([\d.]+)/i', $line, $matches)) {
                            $version = 'chokidar@' . $matches[1];
                            break;
                        }
                    }
                }
            } else {
                $this->line("  <fg=yellow>Command: pnpm list chokidar | grep chokidar | head -1</>");
                exec('pnpm list chokidar 2>&1 | grep chokidar | head -1', $versionOutput);
                $version = trim($versionOutput[0] ?? 'unknown');
            }
            $this->line("  ✅ chokidar installed: {$version}");

            $this->line("  <fg=yellow>Command: node -e \"require('chokidar'); console.log('OK')\"</>");
            exec('node -e "require(\'chokidar\'); console.log(\'OK\')" 2>&1', $testOutput, $testCode);
            if ($testCode === 0 && isset($testOutput[0]) && trim($testOutput[0]) === 'OK') {
                $this->line("  ✅ chokidar test passed - hot-reload ready");
            } else {
                $this->warn("  ⚠️  chokidar test failed but module exists");
            }
        } else {
            $this->error("  ❌ chokidar not found after installation");
        }
    }
}
