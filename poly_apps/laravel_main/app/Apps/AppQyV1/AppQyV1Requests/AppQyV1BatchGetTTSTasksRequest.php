<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

/**
 * Batch Get TTS Tasks Request
 *
 * Validates batch request to query multiple TTS tasks
 */
class AppQyV1BatchGetTTSTasksRequest extends AppQyV1BaseRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'task_ids' => 'required|array|min:1|max:100',
            'task_ids.*' => 'required|integer|min:1',
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
            'task_ids.required' => 'Task IDs array is required.',
            'task_ids.min' => 'At least one task ID is required.',
            'task_ids.max' => 'Maximum 100 task IDs allowed per batch.',
            'task_ids.*.required' => 'Each task ID is required.',
            'task_ids.*.integer' => 'Each task ID must be an integer.',
            'task_ids.*.min' => 'Each task ID must be greater than 0.',
        ];
    }
}
