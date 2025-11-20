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

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use Illuminate\Support\Facades\File;

/**
 * Initialization Marker Manager for Dictionary System
 * Reference: DevOps basetool/token_file.js
 */
class AppQyV1InitializationMarkerManager
{
    protected $markersPath;
    protected $databaseMarker;
    protected $audioMarker;
    protected $imagesMarker;
    protected $initCompleteMarker;
    protected $vocabularyMarker;
    protected $vocabularyStartMarker;
    protected $vocabularyFailedMarker;

    public function __construct()
    {
        $externalDataPath = env('DICT_EXTERNAL_DATA_PATH', storage_path('app/external_data'));
        $this->markersPath = $externalDataPath . '/markers';
        
        $this->databaseMarker = $this->markersPath . '/database_ready.flag';
        $this->audioMarker = $this->markersPath . '/audio_processed.flag';
        $this->imagesMarker = $this->markersPath . '/images_processed.flag';
        $this->initCompleteMarker = $this->markersPath . '/initialization_done.flag';
        $this->vocabularyMarker = $this->markersPath . '/vocabulary_processed.flag';
        $this->vocabularyStartMarker = $this->markersPath . '/vocabulary_processing_start.flag';
        $this->vocabularyFailedMarker = $this->markersPath . '/vocabulary_processing_failed.flag';

        // Ensure markers directory exists
        if (!File::exists($this->markersPath)) {
            File::makeDirectory($this->markersPath, 0755, true);
        }
    }

    /**
     * Check if database processing is complete
     * Reference: DevOps basetool/token_file.js marker checking logic
     */
    public function isDatabaseProcessed(): bool
    {
        return File::exists($this->databaseMarker);
    }

    /**
     * Check if audio processing is complete
     */
    public function isAudioProcessed(): bool
    {
        return File::exists($this->audioMarker);
    }

    /**
     * Check if image processing is complete
     */
    public function isImagesProcessed(): bool
    {
        return File::exists($this->imagesMarker);
    }

    /**
     * Check if full initialization is complete
     */
    public function isInitializationComplete(): bool
    {
        return File::exists($this->initCompleteMarker) ||
               ($this->isDatabaseProcessed() && $this->isAudioProcessed() && $this->isImagesProcessed());
    }

    /**
     * Set database processing as complete
     * Reference: DevOps basetool/token_file.js marker creation logic
     */
    public function setDatabaseProcessed(): bool
    {
        try {
            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'database_processing_complete',
                'process_id' => getmypid(),
                'version' => '1.0'
            ];
            
            return File::put($this->databaseMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Set audio processing as complete
     */
    public function setAudioProcessed(): bool
    {
        try {
            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'audio_processing_complete',
                'process_id' => getmypid(),
                'version' => '1.0'
            ];
            
            return File::put($this->audioMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Set image processing as complete
     */
    public function setImagesProcessed(): bool
    {
        try {
            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'images_processing_complete',
                'process_id' => getmypid(),
                'version' => '1.0'
            ];
            
            return File::put($this->imagesMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Set full initialization as complete
     */
    public function setInitializationComplete(): bool
    {
        try {
            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'full_initialization_complete',
                'process_id' => getmypid(),
                'version' => '1.0',
                'components' => [
                    'database' => $this->isDatabaseProcessed(),
                    'audio' => $this->isAudioProcessed(),
                    'images' => $this->isImagesProcessed()
                ]
            ];
            
            return File::put($this->initCompleteMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Clear all markers (for reset functionality)
     */
    public function clearAllMarkers(): bool
    {
        try {
            $markers = [
                $this->databaseMarker,
                $this->audioMarker,
                $this->imagesMarker,
                $this->initCompleteMarker
            ];

            foreach ($markers as $marker) {
                if (File::exists($marker)) {
                    File::delete($marker);
                }
            }

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get marker information
     */
    public function getMarkerInfo(string $markerType): ?array
    {
        $markerPath = null;
        
        switch ($markerType) {
            case 'database':
                $markerPath = $this->databaseMarker;
                break;
            case 'audio':
                $markerPath = $this->audioMarker;
                break;
            case 'images':
                $markerPath = $this->imagesMarker;
                break;
            case 'complete':
                $markerPath = $this->initCompleteMarker;
                break;
            case 'vocabulary':
                $markerPath = $this->vocabularyMarker;
                break;
        }

        if (!$markerPath || !File::exists($markerPath)) {
            return null;
        }

        try {
            $content = File::get($markerPath);
            return json_decode($content, true);
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Get all markers status
     */
    public function getAllMarkersStatus(): array
    {
        return [
            'database' => [
                'exists' => $this->isDatabaseProcessed(),
                'info' => $this->getMarkerInfo('database')
            ],
            'audio' => [
                'exists' => $this->isAudioProcessed(),
                'info' => $this->getMarkerInfo('audio')
            ],
            'images' => [
                'exists' => $this->isImagesProcessed(),
                'info' => $this->getMarkerInfo('images')
            ],
            'complete' => [
                'exists' => $this->isInitializationComplete(),
                'info' => $this->getMarkerInfo('complete')
            ]
        ];
    }

    /**
     * Create temporary marker for process tracking
     */
    public function createTemporaryMarker(string $processName, array $data = []): bool
    {
        try {
            $tempMarkerPath = $this->markersPath . '/temp_' . $processName . '.flag';
            $markerData = array_merge([
                'timestamp' => now()->toISOString(),
                'process_name' => $processName,
                'process_id' => getmypid(),
                'status' => 'in_progress'
            ], $data);
            
            return File::put($tempMarkerPath, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Remove temporary marker
     */
    public function removeTemporaryMarker(string $processName): bool
    {
        try {
            $tempMarkerPath = $this->markersPath . '/temp_' . $processName . '.flag';
            if (File::exists($tempMarkerPath)) {
                return File::delete($tempMarkerPath);
            }
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Check if process is already running
     */
    public function isProcessRunning(string $processName): bool
    {
        $tempMarkerPath = $this->markersPath . '/temp_' . $processName . '.flag';
        return File::exists($tempMarkerPath);
    }

    /**
     * Vocabulary Processing Marker Methods
     */
    public function isVocabularyProcessingComplete(): bool
    {
        return File::exists($this->vocabularyMarker);
    }

    public function markVocabularyProcessingStart(): bool
    {
        try {
            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'vocabulary_processing_started',
                'process_id' => getmypid(),
                'version' => '1.0'
            ];
            
            return File::put($this->vocabularyStartMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function markVocabularyProcessingComplete(): bool
    {
        try {
            // Remove start and failed markers
            if (File::exists($this->vocabularyStartMarker)) {
                File::delete($this->vocabularyStartMarker);
            }
            if (File::exists($this->vocabularyFailedMarker)) {
                File::delete($this->vocabularyFailedMarker);
            }

            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'vocabulary_processing_complete',
                'process_id' => getmypid(),
                'version' => '1.0'
            ];
            
            return File::put($this->vocabularyMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function markVocabularyProcessingFailed(string $error): bool
    {
        try {
            $markerData = [
                'timestamp' => now()->toISOString(),
                'status' => 'vocabulary_processing_failed',
                'error' => $error,
                'process_id' => getmypid(),
                'version' => '1.0'
            ];
            
            return File::put($this->vocabularyFailedMarker, json_encode($markerData, JSON_PRETTY_PRINT)) !== false;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function getVocabularyProcessingCompletedTime(): ?string
    {
        $info = $this->getMarkerInfo('vocabulary');
        return $info['timestamp'] ?? null;
    }

    public function clearVocabularyProcessingMarkers(): bool
    {
        try {
            $markers = [
                $this->vocabularyMarker,
                $this->vocabularyStartMarker,
                $this->vocabularyFailedMarker
            ];

            foreach ($markers as $marker) {
                if (File::exists($marker)) {
                    File::delete($marker);
                }
            }

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
