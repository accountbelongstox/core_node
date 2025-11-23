<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Utils\AppQyV1Initializer;

class InitializeApps extends Command
{
    protected $signature = 'apps:init 
                            {app? : Specific app to initialize (optional)}
                            {--force : Force re-initialization of already completed steps}
                            {--status : Check initialization status only}
                            {--reset : Reset initialization status}
                            {--all : Initialize all registered apps}';

    protected $description = 'Initialize application databases and resources';

    public function handle()
    {
        $manager = new AppInitializationManager();
        
        $manager->register(new AppQyV1Initializer());
        
        if ($this->option('status')) {
            return $this->showStatus($manager);
        }
        
        if ($this->option('reset')) {
            return $this->resetStatus($manager);
        }
        
        $appName = $this->argument('app');
        $force = $this->option('force');
        
        if ($this->option('all') || !$appName) {
            return $this->initializeAll($manager, $force);
        }
        
        return $this->initializeApp($manager, $appName, $force);
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
