<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use App\Providers\PathMapper;

/**
 * Pycore OCR Utility
 *
 * PHP wrapper for calling Python pycore OCR utilities.
 * Provides OCR (Optical Character Recognition) functionality via CnOCR.
 *
 * Usage:
 *   $result = PycoreOCRUtil::recognizeImage('/path/to/image.jpg');
 *   $result = PycoreOCRUtil::recognizeImage('/path/to/image.jpg', 'doc');
 *   $batchResult = PycoreOCRUtil::recognizeBatch(['/path/1.jpg', '/path/2.jpg']);
 *
 * Available model types:
 *   - general: General purpose model for mixed content (default)
 *   - scene: Optimized for general scene photos with text
 *   - doc: Optimized for document screenshots and scans
 *   - number: Optimized for number recognition (0-9 only)
 *   - english: Optimized for English text
 *   - chinese_traditional: Optimized for Traditional Chinese
 */
class PycoreOCRUtil
{
    /**
     * Get Python executable path
     */
    private static function getPythonPath(): string
    {
        // Use python3 from system
        return 'python3';
    }

    /**
     * Get pycore root directory
     */
    private static function getPycoreRoot(): string
    {
        // Core node root is 3 levels up from laravel_main/app/CallPycoreUtils
        $laravelRoot = dirname(__DIR__, 2); // laravel_main
        $polyAppsRoot = dirname($laravelRoot); // poly_apps
        return dirname($polyAppsRoot); // core_node
    }

    /**
     * Execute Python OCR command
     *
     * @param string $pythonCode Python code to execute
     * @param int $timeout Timeout in seconds
     * @return array Result from Python execution
     */
    private static function executePythonCode(string $pythonCode, int $timeout = 300): array
    {
        $pycoreRoot = self::getPycoreRoot();
        $pythonPath = self::getPythonPath();

        // Build Python command with proper PYTHONPATH and DISPLAY for headless environment
        $command = sprintf(
            'cd %s && PYTHONPATH=%s DISPLAY=:0 %s -c %s',
            escapeshellarg($pycoreRoot),
            escapeshellarg($pycoreRoot),
            $pythonPath,
            escapeshellarg($pythonCode)
        );

        Log::info('Executing Python OCR command', [
            'pycore_root' => $pycoreRoot,
            'timeout' => $timeout
        ]);

        // Execute command
        $process = Process::timeout($timeout)->run($command);

        // Check if process was successful
        if (!$process->successful()) {
            Log::error('Python OCR execution failed', [
                'exit_code' => $process->exitCode(),
                'error' => $process->errorOutput()
            ]);

            return [
                'success' => false,
                'error' => 'Python execution failed: ' . $process->errorOutput(),
                'exit_code' => $process->exitCode()
            ];
        }

        // Parse JSON output
        $output = trim($process->output());
        $result = json_decode($output, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('Failed to parse Python JSON output', [
                'json_error' => json_last_error_msg(),
                'output' => $output
            ]);

            return [
                'success' => false,
                'error' => 'Failed to parse JSON output: ' . json_last_error_msg(),
                'raw_output' => $output
            ];
        }

        return $result;
    }

    /**
     * Recognize text from a single image
     *
     * @param string $imagePath Absolute path to image file
     * @param string $modelType Model type (general, scene, doc, number, english, chinese_traditional)
     * @param int $timeout Timeout in seconds
     * @return array OCR result
     */
    public static function recognizeImage(string $imagePath, string $modelType = 'general', int $timeout = 300): array
    {
        // Validate image path
        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => "Image file not found: {$imagePath}"
            ];
        }

        $pycoreRoot = self::getPycoreRoot();

        // Build Python code - import directly to avoid GUI dependencies
        $pythonCode = sprintf(
            'import sys; sys.path.insert(0, %s); import json; from pycore.pyutils.ocr.ocr_manager import ocr_manager; result = ocr_manager.recognize_image(%s, model_type=%s); print(json.dumps(result, ensure_ascii=False))',
            var_export($pycoreRoot, true),
            var_export($imagePath, true),
            var_export($modelType, true)
        );

        Log::info('OCR: Recognizing image', [
            'image_path' => $imagePath,
            'model_type' => $modelType
        ]);

        return self::executePythonCode($pythonCode, $timeout);
    }

    /**
     * Recognize text from multiple images (batch processing)
     *
     * @param array $imagePaths Array of absolute paths to image files
     * @param string $modelType Model type (general, scene, doc, number, english, chinese_traditional)
     * @param int $timeout Timeout in seconds
     * @return array Batch OCR results
     */
    public static function recognizeBatch(array $imagePaths, string $modelType = 'general', int $timeout = 600): array
    {
        // Validate all image paths
        foreach ($imagePaths as $imagePath) {
            if (!file_exists($imagePath)) {
                return [
                    'success' => false,
                    'error' => "Image file not found: {$imagePath}"
                ];
            }
        }

        $pycoreRoot = self::getPycoreRoot();

        // Build Python code - import directly to avoid GUI dependencies
        $imagePathsJson = json_encode($imagePaths);
        $pythonCode = sprintf(
            'import sys; sys.path.insert(0, %s); import json; from pycore.pyutils.ocr.ocr_manager import ocr_manager; result = ocr_manager.recognize_batch(%s, model_type=%s); print(json.dumps(result, ensure_ascii=False))',
            var_export($pycoreRoot, true),
            $imagePathsJson,
            var_export($modelType, true)
        );

        Log::info('OCR: Batch recognition', [
            'image_count' => count($imagePaths),
            'model_type' => $modelType
        ]);

        return self::executePythonCode($pythonCode, $timeout);
    }

    /**
     * Get available OCR models
     *
     * @return array Available model types and configurations
     */
    public static function getAvailableModels(): array
    {
        $pycoreRoot = self::getPycoreRoot();

        $pythonCode = sprintf(
            'import sys; sys.path.insert(0, %s); import json; from pycore.pyutils.ocr.ocr_manager import ocr_manager; result = ocr_manager.get_available_models(); print(json.dumps(result, ensure_ascii=False))',
            var_export($pycoreRoot, true)
        );

        Log::info('OCR: Getting available models');

        return self::executePythonCode($pythonCode, 30);
    }

    /**
     * Get OCR engine information
     *
     * @param string|null $modelType Specific model type (optional)
     * @return array Engine information
     */
    public static function getEngineInfo(?string $modelType = null): array
    {
        $pycoreRoot = self::getPycoreRoot();

        if ($modelType !== null) {
            $pythonCode = sprintf(
                'import sys; sys.path.insert(0, %s); import json; from pycore.pyutils.ocr.ocr_manager import ocr_manager; result = ocr_manager.get_engine_info(model_type=%s); print(json.dumps(result, ensure_ascii=False))',
                var_export($pycoreRoot, true),
                var_export($modelType, true)
            );
        } else {
            $pythonCode = sprintf(
                'import sys; sys.path.insert(0, %s); import json; from pycore.pyutils.ocr.ocr_manager import ocr_manager; result = ocr_manager.get_engine_info(); print(json.dumps(result, ensure_ascii=False))',
                var_export($pycoreRoot, true)
            );
        }

        Log::info('OCR: Getting engine info', ['model_type' => $modelType]);

        return self::executePythonCode($pythonCode, 30);
    }
}
