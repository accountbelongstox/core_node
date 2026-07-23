<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Services\AppQyV1UserInitializationTableService;
use App\Apps\AppQyV1\Services\AppQyV1BookReadingProgressTableService;
use App\Apps\AppQyV1\Services\AppQyV1ClientDeviceSettingsTableService;
use App\Services\OctaneTaskStatusService;
use App\Services\SystemDependencyInitializer;
use App\Services\AI\UnifiedAIRouter;

class InitializeApps extends Command
{
    protected $signature = 'sys:init';

    protected $description = 'Initialize system databases and resources';

    public function handle()
    {
        $dependencyInitializer = new SystemDependencyInitializer($this);

        $this->info('Initializing system...');
        $this->newLine();

        $this->info('Checking Octane/Swoole compatibility...');
        $dependencyInitializer->fixOctaneSwooleCompatibility();
        $this->newLine();

        $this->info('Checking Octane hot-reload dependencies...');
        $dependencyInitializer->installChokidar();
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
        if (!$this->runSafeMigrations()) {
            $this->error('System initialization stopped because migrations failed.');
            return Command::FAILURE;
        }
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

                    // getenv('LARAVEL_SERVICE_RUN') is the authoritative "unattended" signal (set by
                    // start.ps1/start.sh's NSSM/systemd service registration): stream_isatty(STDIN)
                    // alone is not reliable here -- an NSSM-launched child on Windows can still report
                    // an attached console handle as a TTY even with no operator present, which made
                    // this prompt block forever (stream_select() on STDIN is also documented as
                    // unsupported on Windows for non-socket streams, so the 15s timeout never fired).
                    $isInteractive = PHP_SAPI === 'cli' && defined('STDIN') && @stream_isatty(STDIN)
                        && getenv('LARAVEL_SERVICE_RUN') !== '1';
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

        $this->info('Creating AppQyV1 book reading progress tables...');
        $bookProgressResults = AppQyV1BookReadingProgressTableService::ensureTablesExist();
        foreach ($bookProgressResults as $table => $status) {
            $icon = ($status === 'created' || $status === 'exists') ? '✅' : '❌';
            $this->line("  {$icon} {$table}: {$status}");
        }
        $this->newLine();

        $this->info('Creating AppQyV1 client device settings tables...');
        $clientSettingsResults = AppQyV1ClientDeviceSettingsTableService::ensureTablesExist();
        foreach ($clientSettingsResults as $table => $status) {
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

        $this->info('Seeding TTS engine config + variant specs...');
        try {
            $engineSeed = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsEngineConfigModel::seedDefaults();
            $variantSeed = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsVariantSpecModel::seedDefaults();
            $this->line("  ✅ TTS engine config: {$engineSeed['seeded']} created, {$engineSeed['updated']} updated");
            $this->line("  ✅ TTS variant specs: {$variantSeed['seeded']} created, {$variantSeed['updated']} updated");
        } catch (\Throwable $e) {
            $this->warn('  ⚠️  TTS config seeding failed (will retry next sys:init): ' . $e->getMessage());
        }
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
        $manager = AppInitializationManager::withDefaultInitializers();
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

    private function runSafeMigrations(): bool
    {
        $successful = false;

        try {
            $this->line("  <fg=cyan>Running database migrations (idempotent mode - preserves data)</>");
            $this->line("  <fg=yellow>Command: php artisan migrate --force</>");
            $exitCode = $this->call('migrate', ['--force' => true]);
            $successful = $exitCode === 0;

            if ($successful) {
                $this->line("  ✅ Default connection migrations completed");
            } else {
                $this->error("  ❌ Default connection migrations failed");
            }
        } catch (\Throwable $e) {
            $this->error("  ❌ Migration error: " . $e->getMessage());
        }

        return $successful;
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

}
