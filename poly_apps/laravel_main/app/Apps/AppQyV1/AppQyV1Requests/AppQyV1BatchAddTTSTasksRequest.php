<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use App\Support\QueueCenterContract;
use Illuminate\Validation\Rule;

/**
 * Batch Add TTS Tasks Request
 *
 * Validates batch request to add multiple TTS tasks to queue
 */
class AppQyV1BatchAddTTSTasksRequest extends AppQyV1BaseRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $producerLimits = QueueCenterContract::diffDelivery()['producer_batch_limits'] ?? [];
        $wordAudioLimit = max(1, (int) ($producerLimits['word_audio'] ?? 1));
        return [
            'tasks' => 'required|array|min:1|max:' . $wordAudioLimit,
            'tasks.*.content' => 'required|string|max:10000',
            'tasks.*.language' => 'required|string|max:10',
            'tasks.*.type' => ['nullable', 'string', Rule::in(QueueCenterContract::queuePositionOrderedTaskAliases())],
            'tasks.*.position' => 'nullable|string|in:beginning,end',
            'default_position' => 'nullable|string|in:beginning,end',
            'tasks.*.priority' => 'prohibited',
            'default_priority' => 'prohibited',
            // FE fast-track flag: when true the batch jumps to the front of the
            // audio queue (handled in the controller).
            'interactive' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tasks.required' => 'Tasks array is required.',
            'tasks.min' => 'At least one task is required.',
            'tasks.max' => 'Queue Center producer batch limit exceeded.',
            'tasks.*.content.required' => 'Content is required for each task.',
            'tasks.*.content.max' => 'Content must not exceed 10000 characters.',
            'tasks.*.language.required' => 'Language is required for each task.',
        ];
    }
}
