<?php

namespace App\Services\PycoreTasks;

use App\Support\QueueCenterContract;
use App\Utils\FileSystemManager;

/**
 * OCR through pycore's OCR engine registry, as an `ocr_recognize` task.
 *
 * Payload: {image_data: base64, image_sha256, model_type, engine?, lang?, languages?, client_task_id?}.
 * Result:  pycore's recognize payload {success, engine, text, latency_ms, error, model_type?, languages?}.
 */
final class OcrRecognizeTask
{
    public const TASK_TYPE = 'ocr_recognize';
    /** CnOCR model types pycore's `model_type` parameter accepts. */
    public const MODEL_TYPES = ['general', 'scene', 'doc', 'number', 'english', 'chinese_traditional'];
    public const DEFAULT_MODEL_TYPE = 'general';

    /**
     * pycore's recognize payload once the task is completed, else the
     * PycoreTaskQueue pending or unavailable view; input errors return {success: false, error}.
     */
    public static function recognizeImage(
        string $imagePath,
        string $modelType = self::DEFAULT_MODEL_TYPE,
        array $options = [],
        ?string $clientTaskId = null
    ): array
    {
        $image = FileSystemManager::exists($imagePath) ? FileSystemManager::readFile($imagePath, false) : false;
        $limit = (int) (QueueCenterContract::taskTypeDefinition(self::TASK_TYPE)['payload_limits']['image_max_bytes'] ?? 0);
        $sha256 = '';
        $state = null;

        if (!is_string($image) || $image === '') {
            return ['success' => false, 'error' => __('pycore.ocr_image_unreadable', ['path' => $imagePath])];
        }
        if ($limit > 0 && strlen($image) > $limit) {
            return ['success' => false, 'error' => __('pycore.ocr_image_too_large', ['bytes' => strlen($image), 'limit' => $limit])];
        }
        $sha256 = hash('sha256', $image);
        $options = array_intersect_key($options, array_flip(['engine', 'lang', 'languages']));
        $state = PycoreTaskQueue::request(
            self::TASK_TYPE,
            ['image_data' => base64_encode($image), 'image_sha256' => $sha256, 'model_type' => $modelType] + $options,
            ['image_sha256' => $sha256, 'model_type' => $modelType] + $options,
            $clientTaskId
        );

        return ($state['status'] ?? null) === PycoreTaskQueue::STATE_COMPLETED
            ? $state['result'] + ['task_id' => $state['task_id']]
            : $state;
    }

    /**
     * @return array{success: bool, queued: bool, count: int, results: array<int, array>}
     */
    public static function recognizeBatch(array $imagePaths, string $modelType = self::DEFAULT_MODEL_TYPE, ?string $clientTaskId = null): array
    {
        $results = [];

        foreach (array_values($imagePaths) as $index => $imagePath) {
            $results[] = ['image_path' => $imagePath] + self::recognizeImage(
                (string) $imagePath,
                $modelType,
                [],
                $clientTaskId !== null ? $clientTaskId.':'.$index : null
            );
        }

        return [
            'success' => $results !== [] && !in_array(false, array_column($results, 'success'), true),
            'queued' => in_array(true, array_column($results, 'queued'), true),
            'count' => count($results),
            'results' => $results,
        ];
    }

    /** What Laravel knows about OCR: the task type pycore serves and its accepted model types. */
    public static function describe(): array
    {
        return [
            'success' => true,
            'task_type' => self::TASK_TYPE,
            'execution_type' => QueueCenterContract::taskTypeExecution(self::TASK_TYPE),
            'model_types' => self::MODEL_TYPES,
            'image_max_bytes' => QueueCenterContract::taskTypeDefinition(self::TASK_TYPE)['payload_limits']['image_max_bytes'] ?? null,
            'required_compute' => QueueCenterContract::taskTypeCompute(self::TASK_TYPE),
        ];
    }
}
