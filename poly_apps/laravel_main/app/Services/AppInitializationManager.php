<?php

namespace App\Services;

use App\Apps\AppQyV1\Utils\AppQyV1Initializer;
use App\Apps\DingDuoDuoV1\Utils\DingDuoDuoV1Initializer;
use App\Apps\McpV1\McpV1Utils\McpV1Initializer;
use App\Apps\PddToolV1\Utils\PddToolV1Initializer;
use App\Contracts\AppInitializerInterface;
use Illuminate\Support\Facades\Log;
use LogicException;
use Throwable;

class AppInitializationManager
{
    private array $initializers = [];

    public static function withDefaultInitializers(): self
    {
        $manager = new self();

        $manager->register(new AppQyV1Initializer());
        $manager->register(new McpV1Initializer());
        $manager->register(new PddToolV1Initializer());
        $manager->register(new DingDuoDuoV1Initializer());

        return $manager;
    }

    public function register(AppInitializerInterface $initializer): void
    {
        $appName = $initializer->getAppName();

        if (isset($this->initializers[$appName])) {
            $registeredClass = get_class($this->initializers[$appName]);
            $incomingClass = get_class($initializer);

            if ($registeredClass === $incomingClass) {
                return;
            }

            throw new LogicException("Conflicting initializers registered for {$appName}: {$registeredClass} and {$incomingClass}");
        }

        $this->initializers[$appName] = $initializer;
        Log::info("[AppInit] Registered initializer for: {$appName}");
    }
    
    public function initializeAll(bool $force = false): array
    {
        $results = [];
        
        foreach ($this->initializers as $appName => $initializer) {
            // Basic CLI progress output for long-running sys:init
            if (PHP_SAPI === 'cli') {
                echo "  -> Initializing {$appName}...\n";
            }
            Log::info("[AppInit] Starting initialization for: {$appName}");
            
            try {
                $result = $initializer->initialize($force);
                $results[$appName] = $result;
                
                if (!empty($result['success'])) {
                    Log::info("[AppInit] Successfully initialized: {$appName}");
                    if (PHP_SAPI === 'cli') {
                        echo "     {$appName}: OK\n";
                    }
                } else {
                    Log::error("[AppInit] Failed to initialize {$appName}: " . ($result['error'] ?? 'Unknown error'));
                    if (PHP_SAPI === 'cli') {
                        echo "     {$appName}: FAILED\n";
                    }
                }
            } catch (Throwable $e) {
                $errorMsg = $e->getMessage();
                Log::error("[AppInit] Exception during {$appName} initialization: {$errorMsg}");
                $results[$appName] = [
                    'success' => false,
                    'error' => $errorMsg,
                    'exception' => get_class($e),
                ];
                if (PHP_SAPI === 'cli') {
                    echo "     {$appName}: EXCEPTION - {$errorMsg}\n";
                }
            }
        }
        
        return [
            'success' => !empty($results)
                && count(array_filter($results, static fn (array $result): bool => !empty($result['success']))) === count($results),
            'results' => $results,
            'timestamp' => now()->toDateTimeString(),
        ];
    }
    
    public function initialize(string $appName, bool $force = false): array
    {
        if (!isset($this->initializers[$appName])) {
            return [
                'success' => false,
                'error' => "App initializer not found: {$appName}",
                'available_apps' => array_keys($this->initializers),
            ];
        }
        
        try {
            $result = $this->initializers[$appName]->initialize($force);
            $result['registered_class'] = get_class($this->initializers[$appName]);
            return $result;
        } catch (Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'exception' => get_class($e),
                'registered_class' => get_class($this->initializers[$appName]),
            ];
        }
    }
    
    public function checkStatus(): array
    {
        $statuses = [];
        
        foreach ($this->initializers as $appName => $initializer) {
            try {
                $statuses[$appName] = $initializer->checkInitializationStatus();
            } catch (Throwable $e) {
                $statuses[$appName] = [
                    'initialized' => false,
                    'error' => $e->getMessage(),
                ];
            }
        }
        
        return [
            'success' => true,
            'apps' => $statuses,
            'timestamp' => now()->toDateTimeString(),
        ];
    }
    
    public function getRegisteredApps(): array
    {
        return array_keys($this->initializers);
    }
    
    public function getDetailedStatus(): array
    {
        $details = [];
        
        foreach ($this->initializers as $appName => $initializer) {
            $details[$appName] = [
                'registered_class' => get_class($initializer),
            ];
            
            if (method_exists($initializer, 'getDatabaseInfo')) {
                try {
                    $details[$appName]['database'] = $initializer->getDatabaseInfo();
                } catch (Throwable $e) {
                    $details[$appName]['database_error'] = $e->getMessage();
                }
            }
        }
        
        return $details;
    }
    
    public function reset(string $appName): array
    {
        if (!isset($this->initializers[$appName])) {
            return [
                'success' => false,
                'error' => "App initializer not found: {$appName}",
            ];
        }
        
        try {
            return $this->initializers[$appName]->reset();
        } catch (Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
