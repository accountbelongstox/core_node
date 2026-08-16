<?php

namespace App\Console\Commands;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use Illuminate\Console\Command;
use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Services\AppQyV1UserInitializationTableService;
use App\Apps\AppQyV1\Services\AppQyV1BookReadingProgressTableService;
use App\Apps\AppQyV1\Services\AppQyV1ClientDeviceSettingsTableService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageStudyGroupService;
use App\Services\OctaneTaskStatusService;
use App\Services\SystemDependencyInitializer;
use App\Services\AI\UnifiedAIRouter;
use App\Utils\FileSystemManager;

class InitializeApps extends Command
{
    protected $signature = 'sys:init';

    protected $description = 'Initialize system databases and resources';

    public function handle(): int
    {
        $dependencyInitializer = new SystemDependencyInitializer($this);

        $this->info('Initializing system...');
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
            if (FileSystemManager::exists($path)) {
                $this->line("  ✓ Exists {$name}: {$path}");
                continue;
            }

            if (!FileSystemManager::ensureDirectoryExists($path)) {
                $this->error("  ❌ Failed to create {$name}: {$path}");
                return Command::FAILURE;
            }

            $this->line("  ✅ Created {$name}: {$path}");
        }
        $this->newLine();

        $this->info('Running migrations (safe mode - no table drops or rebuilds)...');
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
            return Command::FAILURE;
        }

        $inviteStats = \App\Services\InviteCodeInitializer::getTableStats();
        if (!isset($inviteStats['error'])) {
            $this->line("  <fg=gray>Stats: {$inviteStats['invite_codes']['total']} codes ({$inviteStats['invite_codes']['active']} active), {$inviteStats['invite_code_usage']['total']} usages</>");
        } else {
            $this->error("  ❌ Invite code statistics failed: {$inviteStats['error']}");
            return Command::FAILURE;
        }
        $this->newLine();

        $results = \App\Services\UserSyncService::ensureUserTablesExist();

        $this->info('Database initialization results:');

        foreach ($results as $dbName => $status) {
            $icon = (in_array($status, ['created', 'exists']) || str_contains($status, 'canonical identity')) ? '✅' : '❌';
            $this->line("{$icon} {$dbName}: {$status}");
        }

        if (!$this->initializationStatusesSucceeded($results, ['created', 'exists'], true)) {
            $this->error('Database initialization failed.');
            return Command::FAILURE;
        }
        
        $successCount = collect($results)->filter(fn($s) => in_array($s, ['created', 'exists']) || str_contains($s, 'canonical identity'))->count();
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
        if (!$this->initializationStatusesSucceeded($dictResults)) {
            $this->error('TTS cache table initialization failed.');
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Creating voice subtitle user settings tables...');
        $voiceSubtitleResults = \App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\VoiceSubtitleV1TableService::ensureTablesExist();
        foreach ($voiceSubtitleResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
        }
        if (!$this->initializationStatusesSucceeded($voiceSubtitleResults)) {
            $this->error('Voice subtitle table initialization failed.');
            return Command::FAILURE;
        }
        $this->newLine();

        // TTS state now lives on the canonical tables (tts_cache_{lang} +
        // {lang}_article_library); the intermediate tts_queue table is
        // decommissioned. The decommission run is IDEMPOTENT: it salvages any
        // durable state the queue still uniquely holds (completed article
        // audio, completed word audio, pending intent) fill-missing into the
        // canonical tables, reconciles has_audio/tts_files inconsistencies,
        // then retains the legacy table as an inert archive. Re-runs are fill-missing only.
        $this->info('TTS coordination: synchronizing intermediate tts_queue into canonical tables...');
        try {
            $decom = \App\Services\AppQyV1TTSQueueDecommission::run();
            if ($decom['queue_table_present']) {
                $this->line("  ✅ Salvaged: {$decom['words_salvaged']} word audio, {$decom['articles_salvaged']} article audio, {$decom['pending_migrated']} pending intents");
                $this->line('  ✓ tts_queue retained as an inert archive');
            } else {
                $this->line('  ✓ No legacy tts_queue table present');
            }
            if ($decom['flags_reconciled'] > 0) {
                $this->line("  ✅ Reconciled {$decom['flags_reconciled']} has_audio/tts_files inconsistencies");
            }
        } catch (\Throwable $e) {
            $this->error('  ❌ TTS queue decommission failed: ' . $e->getMessage());
            return Command::FAILURE;
        }

        try {
            $ttsStats = (new \App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator())->statistics();
            $this->line("  <fg=gray>Stats: {$ttsStats['by_status']['pending']} pending, {$ttsStats['by_status']['processing']} processing, {$ttsStats['by_status']['completed']} completed, {$ttsStats['by_status']['failed']} failed</>");
        } catch (\Throwable $e) {
            $this->error('  ❌ TTS statistics failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Creating article library tables (all languages)...');
        $articleLibResults = \App\Services\AppQyV1ArticleLibraryInitializer::ensureTablesExist();
        $articleCreated = count(array_filter($articleLibResults, fn($s) => $s === 'created'));
        $articleExists = count(array_filter($articleLibResults, fn($s) => $s === 'exists'));
        $articleTotal = count($articleLibResults);
        $this->line("  ✅ Created: {$articleCreated}, Exists: {$articleExists}, Total: {$articleTotal}");
        if (!$this->initializationStatusesSucceeded($articleLibResults)) {
            $this->error('Article library table initialization failed.');
            return Command::FAILURE;
        }

        $articleStats = \App\Services\AppQyV1ArticleLibraryInitializer::getTableStats();
        if (!isset($articleStats['error'])) {
            $this->line("  <fg=gray>Articles: {$articleStats['total_articles']} total, {$articleStats['total_with_audio']} with audio, {$articleStats['total_without_audio']} without audio</>");
        } else {
            $this->error("  ❌ Article library statistics failed: {$articleStats['error']}");
            return Command::FAILURE;
        }
        $this->newLine();

        // NOTE: the legacy per-language {prefix}_{lang}_dictionaries tables are NOT
        // created here anymore. The canonical dictionary table is
        // {prefix}_tts_cache_{lang} (created above by ensureMultiLangDictionaryTablesExist);
        // the runtime never reads {lang}_dictionaries, and creating them produced
        // empty orphan tables that contradicted the cleanup step. Multilingual data
        // is imported straight into the tts_cache_{lang} staging tables below.

        $this->info('Importing multilingual word data...');
        $importResults = \App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryImportService::importMultilingualWordsFromMd();
        if (isset($importResults['skipped']) && $importResults['skipped']) {
            $this->line("  ⏭️  {$importResults['message']}");
        } elseif (!empty($importResults['errors'])) {
            foreach ($importResults['errors'] as $error) {
                $this->line("  ❌ {$error}");
            }
            return Command::FAILURE;
        } else {
            $this->line("  ✅ Imported {$importResults['imported']} words from {$importResults['total_files']} files");
        }
        $this->newLine();
        
        $this->info('Initializing dictionary (Step 2: Extended words & translations)...');

        $shouldRunDictInit = true;

        try {
            $dictionaryState = AppQyV1LangDictionaryModel::initializationLanguageState('en');
            $existingCount = $dictionaryState['total'];
            $translatedCount = $dictionaryState['translated'];

            if ($dictionaryState['exists']) {

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
        } catch (\Throwable $e) {
            $this->error("  ❌ Dictionary pre-check failed: {$e->getMessage()}");
            return Command::FAILURE;
        }

        $dictResults = $shouldRunDictInit
            ? \App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryImportService::initializeDictionaryStep2()
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
            return Command::FAILURE;
        }
        
        $this->newLine();
        
        $this->info('AppQyV1 dictionary tables summary:');
        if (!$this->displayDictionaryTableSummary()) {
            return Command::FAILURE;
        }

        $this->newLine();

        $this->info('Creating AppQyV1 user initialization tables...');
        $userInitResults = AppQyV1UserInitializationTableService::ensureTablesExist();
        foreach ($userInitResults as $table => $status) {
            $icon = ($status === 'created' || $status === 'exists') ? '✅' : '❌';
            $this->line("  {$icon} {$table}: {$status}");
        }
        if (!$this->initializationStatusesSucceeded($userInitResults)) {
            $this->error('AppQyV1 user initialization table setup failed.');
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Ensuring per-user default vocabulary groups...');
        $defaultGroupResults = AppQyV1LanguageStudyGroupService::ensureAllUserLanguageGroups();
        $this->line("  ✅ Users: {$defaultGroupResults['users']}; groups: {$defaultGroupResults['groups']}");
        $this->newLine();

        $this->info('Creating AppQyV1 book reading progress tables...');
        $bookProgressResults = AppQyV1BookReadingProgressTableService::ensureTablesExist();
        foreach ($bookProgressResults as $table => $status) {
            $icon = ($status === 'created' || $status === 'exists') ? '✅' : '❌';
            $this->line("  {$icon} {$table}: {$status}");
        }
        if (!$this->initializationStatusesSucceeded($bookProgressResults)) {
            $this->error('AppQyV1 book reading progress table setup failed.');
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Creating AppQyV1 client device settings tables...');
        $clientSettingsResults = AppQyV1ClientDeviceSettingsTableService::ensureTablesExist();
        foreach ($clientSettingsResults as $table => $status) {
            $icon = ($status === 'created' || $status === 'exists') ? '✅' : '❌';
            $this->line("  {$icon} {$table}: {$status}");
        }
        if (!$this->initializationStatusesSucceeded($clientSettingsResults)) {
            $this->error('AppQyV1 client settings table setup failed.');
            return Command::FAILURE;
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
        $globalTaskFailed = false;

        foreach ($globalTaskResults as $table => $status) {
            if (str_starts_with($status, 'error:')) {
                $this->line("  ❌ {$table}: {$status}");
                $globalTaskFailed = true;
            } elseif ($status === 'created') {
                $this->line("  ✅ {$table}: table created");
            } elseif ($status === 'updated') {
                $this->line("  ✅ {$table}: fields added");
            } elseif ($status === 'exists') {
                $this->line("  ✓ {$table}: already configured");
            } elseif ($status === 'table_missing') {
                $this->line("  ⚠️  {$table}: base table not found");
                $globalTaskFailed = true;
            } elseif (str_starts_with($status, 'skipped:')) {
                $this->line("  ❌ {$table}: {$status}");
                $globalTaskFailed = true;
            } else {
                $this->line("  • {$table}: {$status}");
            }
        }

        if ($globalTaskFailed) {
            $this->error('Global Task System initialization failed.');
            return Command::FAILURE;
        }

        // Show statistics
        $taskStats = \App\Services\GlobalTaskSystemInitializer::getTableStats();
        if (!empty($taskStats) && !isset($taskStats['error'])) {
            $this->newLine();
            $this->line('  Global Task System Statistics:');

            if (isset($taskStats['global_tasks'])) {
                $stats = $taskStats['global_tasks'];
                $this->line("    Tasks: {$stats['total']} total ({$stats['pending']} pending, {$stats['processing']} processing, {$stats['completed']} completed, {$stats['failed']} failed)");
                if ($stats['other'] > 0) {
                    $this->line("    Other task states: {$stats['other']}");
                }
            }

            if (isset($taskStats['workers'])) {
                $stats = $taskStats['workers'];
                $this->line("    Workers: {$stats['total']} total ({$stats['online']} online, {$stats['busy']} busy, {$stats['offline']} offline)");
            }
        } elseif (isset($taskStats['error'])) {
            $this->error("  ❌ Could not fetch statistics: {$taskStats['error']}");
            return Command::FAILURE;
        }

        $this->newLine();

        $this->info('Initializing media ingestion tables...');
        if (!$this->initializeMediaIngestTables()) {
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Seeding punctuation markers (Books Sentence/Word Model v2)...');
        if (!$this->seedPunctuationMarkers()) {
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Seeding TTS engine config + variant specs...');
        try {
            $engineSeed = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsEngineConfigModel::seedDefaults();
            $variantSeed = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsVariantSpecModel::seedDefaults();
            $this->line("  ✅ TTS engine config: {$engineSeed['seeded']} created, {$engineSeed['updated']} updated");
            $this->line("  ✅ TTS variant specs: {$variantSeed['seeded']} created, {$variantSeed['updated']} updated");
        } catch (\Throwable $e) {
            $this->error('  ❌ TTS config seeding failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
        $this->newLine();

        $this->info('Migrating daily-sentences → article routes (idempotent)...');
        if (!$this->migrateDailySentencesToArticle()) {
            return Command::FAILURE;
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
        }

        $this->error('❌ System initialization failed');
        return Command::FAILURE;
    }

    private function initializationStatusesSucceeded(
        array $results,
        array $successStatuses = ['created', 'exists'],
        bool $allowCanonicalIdentity = false
    ): bool {
        foreach ($results as $status) {
            $status = (string) $status;
            if (in_array($status, $successStatuses, true)) {
                continue;
            }

            if ($allowCanonicalIdentity && str_contains($status, 'canonical identity')) {
                continue;
            }

            return false;
        }

        return true;
    }
    
    private function displayDictionaryTableSummary(): bool
    {
        try {
            $summary = AppQyV1LangDictionaryModel::initializationTableSummary();

            if (!empty($summary['tables_with_data'])) {
                $this->line('  <fg=green>Tables with data:</>');
                foreach ($summary['tables_with_data'] as $tableInfo) {
                    $duplicates = $tableInfo['count'] - $tableInfo['distinct_md5'];
                    if ($duplicates > 0) {
                        $this->line("    • {$tableInfo['code']}: {$tableInfo['count']} entries  <fg=red>⚠️ {$duplicates} duplicate md5 values</>");
                    } elseif (!$tableInfo['unique_ok']) {
                        $this->line("    • {$tableInfo['code']}: {$tableInfo['count']} entries  <fg=yellow>(md5 unique index missing)</>");
                    } else {
                        $this->line("    • {$tableInfo['code']}: {$tableInfo['count']} entries <fg=green>(md5 unique ✓)</>");
                    }
                }
            }

            if ($summary['empty_count'] > 0) {
                $this->line("  <fg=gray>Empty tables: {$summary['empty_count']} (ready for import)</>");
            }

            $this->line("  <fg=cyan>Total dictionary tables: {$summary['total_tables']}</>");

            if (!empty($summary['errors'])) {
                foreach ($summary['errors'] as $error) {
                    $this->error("  ❌ {$error}");
                }

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            $this->error("  ❌ Dictionary summary failed: {$e->getMessage()}");

            return false;
        }
    }

    private function displayAppResult(string $appName, array $result): void
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
        $safetyExitCode = Command::FAILURE;

        try {
            $this->line("  <fg=cyan>Checking migrations for destructive table operations</>");
            $safetyExitCode = $this->callSilently('migration:check-safety');
            if ($safetyExitCode !== Command::SUCCESS) {
                $this->call('migration:check-safety');
                $this->error('  ❌ Migration safety check failed; no migrations were executed');
                return false;
            }

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
     * adjusts columns/indexes in place and never drops or rebuilds tables.
     */
    private function initializeMediaIngestTables(): bool
    {
        $mediaResults = \App\Services\MediaIngestTablesInitializer::ensureTablesExist();
        $successful = true;

        foreach ($mediaResults as $table => $status) {
            if (str_starts_with($status, 'error:')) {
                $this->line("  ❌ {$table}: {$status}");
                $successful = false;
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
            $this->error("  ❌ Could not fetch media stats: {$mediaStats['error']}");
            $successful = false;
        }

        return $successful;
    }

    /**
     * Seed the canonical punctuation-marker reference set (idempotent).
     *
     * Mirrors pycore/pyfoundations/punctuation_markers.py (_MARKERS) into
     * app_qy_v1_punctuation_markers, upserting by `code` (never clobbers). Safe
     * to re-run; ensures the table exists first.
     */
    private function seedPunctuationMarkers(): bool
    {
        try {
            $result = \App\Services\PunctuationMarkerSeeder::seed();
            $this->line("  ✅ {$result['table']}: {$result['created']} created, {$result['updated']} re-aligned, {$result['unchanged']} unchanged");

            return true;
        } catch (\Throwable $e) {
            $this->error("  ❌ Punctuation marker seed failed: " . $e->getMessage());

            return false;
        }
    }

    /**
     * Idempotent daily-sentences → article/list?type=short merge guard.
     *
     * Routes are code (always aliased). Optional DB: rename article_type
     * 'daily_short' → 'short' if any such rows exist. Marker
     * .migrated_daily_sentences_to_article skips on re-run.
     */
    private function migrateDailySentencesToArticle(): bool
    {
        $markers = new \App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager();
        if ($markers->hasMigratedDailySentencesToArticle()) {
            $this->line('  ⏭️  Already migrated (marker .migrated_daily_sentences_to_article present)');

            return true;
        }

        try {
            $rowsRenamed = AppQyV1ArticleModel::migrateDailyShortTypeInPlace();
        } catch (\Throwable $e) {
            $this->error('  ❌ article_type migration failed: ' . $e->getMessage());

            return false;
        }

        $ok = $markers->setMigratedDailySentencesToArticle([
            'routes_aliased' => true,
            'rows_renamed' => $rowsRenamed,
            'note' => $rowsRenamed > 0
                ? "Renamed {$rowsRenamed} article_type daily_short→short; routes aliased"
                : 'Routes-only: daily-sentences/* aliased to ai_tools/article/*?type=short (no DB rows to migrate)',
        ]);

        if ($ok) {
            $this->line("  ✅ Marker written (routes_aliased=true, rows_renamed={$rowsRenamed})");

            return true;
        }

        $this->error('  ❌ Failed to write .migrated_daily_sentences_to_article marker');

        return false;
    }

}
