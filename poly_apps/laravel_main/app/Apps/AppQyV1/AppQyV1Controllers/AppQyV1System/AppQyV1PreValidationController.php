<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Traits\ApiResponse;

class AppQyV1PreValidationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    protected $storageManager;
    protected $markerManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
        $this->markerManager = new AppQyV1InitializationMarkerManager();
    }

    /**
     * Get comprehensive pre-validation status for resource access
     */
    public function getPreValidationStatus(Request $request)
    {
            $audioDirectoryStatus = $this->checkAudioDirectory();
            $databaseStatus = $this->checkDatabaseStatus();
            $pythonStatus = $this->checkPythonStatus();
            $ttsStatus = $this->checkTTSStatus();
            $statisticsStatus = $this->checkStatisticsStatus();

            $overallStatus = $this->determineOverallStatus([
                $audioDirectoryStatus,
                $databaseStatus,
                $pythonStatus,
                $ttsStatus,
                $statisticsStatus
            ]);

            return response()->json([
                'status' => 'success',
                'overall_status' => $overallStatus,
                'can_serve_resources' => $overallStatus['ready'],
                'checks' => [
                    'audio_directory' => $audioDirectoryStatus,
                    'database' => $databaseStatus,
                    'python' => $pythonStatus,
                    'tts' => $ttsStatus,
                    'statistics' => $statisticsStatus
                ],
                'message' => $overallStatus['message'],
                'checked_at' => now()->toISOString()
            ]);

    }

    /**
     * Check audio directory status
     */
    private function checkAudioDirectory(): array
    {
        $audioPath = Config::get('AppQyV1.paths.audio_directory', $this->storageManager->getWordSoundsPath());

        if (!File::exists($audioPath)) {
            return [
                'status' => 'error',
                'ready' => false,
                'message' => 'Audio directory does not exist',
                'path' => $audioPath,
                'file_count' => 0
            ];
        }

        $fileCount = count(File::files($audioPath));

        return [
            'status' => $fileCount > 0 ? 'ready' : 'warning',
            'ready' => $fileCount > 0,
            'message' => $fileCount > 0 ? "Audio directory ready with {$fileCount} files" : 'Audio directory empty',
            'path' => $audioPath,
            'file_count' => $fileCount
        ];
    }

    /**
     * Check database status including legacy migration
     */
    private function checkDatabaseStatus(): array
    {
        $legacyDbPath = Config::get('AppQyV1.paths.legacy_database', $this->storageManager->getLegacyDatabasePath());
        $newDbPath = Config::get('AppQyV1.paths.main_database', database_path('dictionary.sqlite'));

        $legacyExists = File::exists($legacyDbPath);
        $legacyCopied = $this->markerManager->isDatabaseProcessed();
        $wordCount = 0;

            $wordCount = AppQyV1DictionaryModel::count();

        return [
            'status' => $legacyCopied && $wordCount > 0 ? 'ready' : ($legacyExists ? 'warning' : 'error'),
            'ready' => $legacyCopied && $wordCount > 0,
            'message' => $this->getDatabaseStatusMessage($legacyExists, $legacyCopied, $wordCount),
            'legacy_database' => [
                'exists' => $legacyExists,
                'path' => $legacyDbPath,
                'copied_to_new' => $legacyCopied
            ],
            'main_database' => [
                'path' => $newDbPath,
                'word_count' => $wordCount
            ]
        ];
    }

    /**
     * Check Python status
     */
    private function checkPythonStatus(): array
    {
        $pythonCommand = 'python3';
        $output = [];
        $returnCode = 0;

        exec($pythonCommand . ' --version 2>&1', $output, $returnCode);

        $isReady = $returnCode === 0;
        $version = $isReady ? trim(implode('', $output)) : 'Not found';

        return [
            'status' => $isReady ? 'ready' : 'error',
            'ready' => $isReady,
            'message' => $isReady ? "Python available: {$version}" : 'Python3 not found or not executable',
            'version' => $version,
            'command' => $pythonCommand
        ];
    }

    /**
     * Check EdgeTTS status
     */
    private function checkTTSStatus(): array
    {
        $pythonStatus = $this->checkPythonStatus();

        if (!$pythonStatus['ready']) {
            return [
                'status' => 'error',
                'ready' => false,
                'message' => 'EdgeTTS check skipped: Python not available',
                'dependency_error' => 'Python required'
            ];
        }

        $ttsCommand = 'python3 -c "import edge_tts; print(edge_tts.__version__)"';
        $output = [];
        $returnCode = 0;

        exec($ttsCommand . ' 2>&1', $output, $returnCode);

        $isReady = $returnCode === 0;
        $version = $isReady ? trim(implode('', $output)) : 'Not installed';

        return [
            'status' => $isReady ? 'ready' : 'error',
            'ready' => $isReady,
            'message' => $isReady ? "EdgeTTS available: v{$version}" : 'EdgeTTS not installed or not importable',
            'version' => $version,
            'install_command' => 'pip3 install edge-tts'
        ];
    }

    /**
     * Check statistics status (audio, images, words counted)
     */
    private function checkStatisticsStatus(): array
    {
        $audioStatsComplete = $this->markerManager->isAudioProcessed();
        $imageStatsComplete = $this->markerManager->isImagesProcessed();
        $wordStatsComplete = $this->markerManager->isVocabularyProcessingComplete();

        $allComplete = $audioStatsComplete && $imageStatsComplete && $wordStatsComplete;

        return [
            'status' => $allComplete ? 'ready' : 'warning',
            'ready' => $allComplete,
            'message' => $allComplete ? 'All statistics completed' : 'Some statistics not yet processed',
            'details' => [
                'audio_counted' => $audioStatsComplete,
                'images_counted' => $imageStatsComplete,
                'words_counted' => $wordStatsComplete
            ]
        ];
    }

    /**
     * Get database status message
     */
    private function getDatabaseStatusMessage(bool $legacyExists, bool $legacyCopied, int $wordCount): string
    {
        if (!$legacyExists) {
            return 'Legacy database not found - download required';
        }

        if (!$legacyCopied) {
            return 'Legacy database exists but not copied to new database';
        }

        if ($wordCount === 0) {
            return 'Database copied but no words found';
        }

        return "Database ready with {$wordCount} words";
    }

    /**
     * Determine overall status from all checks
     */
    private function determineOverallStatus(array $statuses): array
    {
        $allReady = true;
        $errorCount = 0;
        $warningCount = 0;

        foreach ($statuses as $status) {
            if (!$status['ready']) {
                $allReady = false;
            }

            if ($status['status'] === 'error') {
                $errorCount++;
            } elseif ($status['status'] === 'warning') {
                $warningCount++;
            }
        }

        if ($allReady) {
            return [
                'ready' => true,
                'level' => 'ready',
                'message' => 'All systems ready - can serve resource requests'
            ];
        }

        if ($errorCount > 0) {
            return [
                'ready' => false,
                'level' => 'error',
                'message' => "System not ready - {$errorCount} critical issues found"
            ];
        }

        return [
            'ready' => false,
            'level' => 'warning',
            'message' => "System partially ready - {$warningCount} warnings found"
        ];
    }

    /**
     * Check specific component status (for individual checks)
     */
    public function checkComponent(Request $request, string $component)
    {
        $validComponents = ['audio', 'database', 'python', 'tts', 'statistics'];

        if (!in_array($component, $validComponents)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid component. Valid components: ' . implode(', ', $validComponents)
            ], 400);
        }

        $methodName = 'check' . ucfirst($component === 'tts' ? 'TTS' : $component) . ($component === 'audio' ? 'Directory' : ($component === 'database' ? 'Status' : 'Status'));

        if (method_exists($this, $methodName)) {
            $result = $this->$methodName();
            return response()->json([
                'status' => 'success',
                'component' => $component,
                'result' => $result,
                'checked_at' => now()->toISOString()
            ]);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Component check method not found'
        ], 500);
    }
}
