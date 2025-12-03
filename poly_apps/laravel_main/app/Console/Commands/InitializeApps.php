<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Utils\AppQyV1Initializer;
use App\Apps\McpV1\McpV1Utils\McpV1Initializer;
use App\Apps\AwyV0\Utils\AwyV0Initializer;
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
        $directories = [
            'avatars' => \App\Providers\PathMapper::getLaravelAvatarsDir(),
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

        $results = \App\Services\UserSyncService::ensureUserTablesExist();
        
        $this->info('Database initialization results:');
        
        foreach ($results as $dbName => $status) {
            $icon = in_array($status, ['created', 'exists']) ? '✅' : '❌';
            $this->line("{$icon} {$dbName}: {$status}");
            
            $connection = $dbName === 'Main' ? 'sqlite' : strtolower($dbName);
            
            try {
                if (config("database.connections.{$connection}")) {
                    $tables = \DB::connection($connection)->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
                    
                    if (!empty($tables)) {
                        foreach ($tables as $table) {
                            $tableName = $table->name;
                            $count = \DB::connection($connection)->table($tableName)->count();
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
        
        $successCount = collect($results)->filter(fn($s) => in_array($s, ['created', 'exists']))->count();
        $totalCount = count($results);
        $this->info("Successfully initialized {$successCount}/{$totalCount} databases.");
        $this->newLine();
        
        $this->info('Creating TTS cache tables...');
        $ttsResults = \App\Services\UserSyncService::ensureTTSCacheTablesExist();
        foreach ($ttsResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
        }
        $this->newLine();

        $this->info('Creating voice subtitle user settings tables...');
        $voiceSubtitleResults = \App\Services\UserSyncService::ensureVoiceSubtitleTablesExist();
        foreach ($voiceSubtitleResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
        }
        $this->newLine();

        $this->info('Creating multilingual word tables...');
        $wordTableResults = \App\Services\UserSyncService::ensureMultilingualWordTablesExist();
        foreach ($wordTableResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
        }
        $this->newLine();
        
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
        $dictResults = \App\Services\UserSyncService::initializeDictionaryStep2();
        
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
        
        $this->info('AppQyV1 word tables summary:');
        try {
            $connection = 'appqyv1';
            $tables = [
                'app_qy_v1_words_english',
                'app_qy_v1_words_lao',
                'app_qy_v1_words_japanese',
                'app_qy_v1_words_vietnamese',
                'app_qy_v1_tts_cache',
            ];
            
            foreach ($tables as $table) {
                try {
                    $count = \DB::connection($connection)->table($table)->count();
                    $this->line("  • {$table}: {$count} rows");
                } catch (\Exception $e) {
                    $this->line("  • {$table}: <fg=red>not exists</>");
                }
            }
        } catch (\Exception $e) {
            $this->line("  <fg=red>Error: {$e->getMessage()}</>");
        }
        
        $this->newLine();

        $this->info('Creating AppQyV1 user initialization tables...');
        $userInitResults = AppQyV1UserInitializationTableService::ensureTablesExist();
        foreach ($userInitResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
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
            $this->warn("  ⚠️  Octane timer tasks have issues:");
            foreach ($taskVerification['issues'] as $issue) {
                $this->line("     • {$issue}");
            }
            $this->line("  ℹ️  Note: Run Octane to activate timer tasks");
        }
        $this->newLine();
        
        $this->info('Creating vocabulary library tables...');
        $vocabResults = AppQyV1VocabularyService::ensureVocabularyTablesExist();
        foreach ($vocabResults as $table => $status) {
            $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
            $this->line("  {$icon} {$table}: {$status}");
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
            $connection = 'appqyv1';
            $libraries = \DB::connection($connection)
                ->table('app_qy_v1_vocabulary_libraries')
                ->select('name', 'total_words', 'difficulty_level')
                ->where('is_public', 1)
                ->get();
            
            foreach ($libraries as $lib) {
                $this->line("  • {$lib->name}: {$lib->total_words} words ({$lib->difficulty_level})");
            }
        } catch (\Exception $e) {
            $this->line("  <fg=red>Error: {$e->getMessage()}</>");
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

            if ($status['available'] && isset($status['usage'])) {
                $usage = $status['usage'];
                if (isset($usage['minute']['requests'])) {
                    $this->line("     Minute: {$usage['minute']['requests']} requests");
                }
                if (isset($usage['day']['requests'])) {
                    $this->line("     Day: {$usage['day']['requests']} requests");
                }
            }
        }
        $this->newLine();

        $this->info('Initializing apps...');
        $manager = new AppInitializationManager();
        $manager->register(new AppQyV1Initializer());
        $manager->register(new McpV1Initializer());
        $manager->register(new AwyV0Initializer());
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

    private function runSafeMigrations()
    {
        try {
            $this->line("  <fg=cyan>Running database migrations with refresh and seed</>");

            $exitCode = $this->call('migrate:refresh', [
                '--force' => true,
                '--seed' => true,
            ]);

            if ($exitCode === 0) {
                $this->line("  ✅ Database migrations and seeding completed successfully");
            } else {
                $this->warn("  ⚠️  Some migrations encountered issues");
            }

        } catch (\Exception $e) {
            $this->error("  ❌ Migration error: " . $e->getMessage());
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
                    $this->line("  ⏭️  Compatibility check skipped: {$result['reason']}");
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

    private function installChokidar()
    {
        $laravelPath = base_path();
        $chokidarPath = $laravelPath . '/node_modules/chokidar';

        $this->line("  <fg=cyan>Checking Node.js and pnpm...</>");

        exec('command -v node 2>&1', $nodeOutput, $nodeCode);
        exec('command -v pnpm 2>&1', $pnpmOutput, $pnpmCode);

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

        exec('node --version 2>&1', $nodeVersion);
        exec('pnpm --version 2>&1', $pnpmVersion);
        $this->line("  ✓ Node.js: " . trim($nodeVersion[0] ?? 'unknown'));
        $this->line("  ✓ pnpm: " . trim($pnpmVersion[0] ?? 'unknown'));

        $this->line("  <fg=cyan>Installing/Verifying chokidar (always runs)...</>");

        $originalDir = getcwd();
        chdir($laravelPath);

        if (is_dir($chokidarPath)) {
            $this->line("  ⟳ chokidar exists, verifying installation...");
            exec('pnpm install --save-dev chokidar 2>&1', $output, $code);
        } else {
            $this->line("  ⬇ Installing chokidar...");
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
            exec('pnpm list chokidar 2>&1 | grep chokidar | head -1', $versionOutput);
            $version = trim($versionOutput[0] ?? 'unknown');
            $this->line("  ✅ chokidar installed: {$version}");

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
