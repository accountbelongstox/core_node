<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Utils\AppQyV1Initializer;

class InitializeApps extends Command
{
    protected $signature = 'sys:init';

    protected $description = 'Initialize system databases and resources';

    public function handle()
    {
        $this->info('Initializing system...');
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
                            
                            $this->line("   • <fg=cyan;options=bold>{$tableName}</> (" . count($structure) . " columns, {$count} rows)");
                            
                            if (!empty($structure)) {
                                $this->line("     <fg=yellow>Columns:</>");
                                foreach ($structure as $col) {
                                    $pkMark = $col['pk'] ? ' <fg=red>[PK]</>' : '';
                                    $defaultInfo = $col['default'] ? " DEFAULT {$col['default']}" : '';
                                    $this->line("       - {$col['name']}: {$col['type']} {$col['notnull']}{$defaultInfo}{$pkMark}");
                                }
                            }
                            
                            if (!empty($indexes)) {
                                $this->line("     <fg=yellow>Indexes:</>");
                                foreach ($indexes as $idx) {
                                    $uniqueMark = $idx['unique'] ? ' <fg=green>[UNIQUE]</>' : '';
                                    $this->line("       - {$idx['name']}: ({$idx['columns']}){$uniqueMark}");
                                }
                            }
                            
                            $this->newLine();
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
        
        $this->info('Initializing apps...');
        $manager = new AppInitializationManager();
        $manager->register(new AppQyV1Initializer());
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
}
