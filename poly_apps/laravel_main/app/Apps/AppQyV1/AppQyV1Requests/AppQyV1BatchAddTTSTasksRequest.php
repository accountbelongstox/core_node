<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

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
        return [
            'tasks' => 'required|array|min:1|max:100',
            'tasks.*.content' => 'required|string|max:10000',
            'tasks.*.language' => 'required|string|max:10',
            'tasks.*.type' => 'nullable|string|in:word,sentence,article',
            'tasks.*.priority' => 'nullable|integer|min:0|max:100',
            'default_priority' => 'nullable|integer|min:0|max:100',
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
            'tasks.max' => 'Maximum 100 tasks allowed per batch.',
            'tasks.*.content.required' => 'Content is required for each task.',
            'tasks.*.content.max' => 'Content must not exceed 10000 characters.',
            'tasks.*.language.required' => 'Language is required for each task.',
            'tasks.*.type.in' => 'Task type must be word, sentence, or article.',
            'tasks.*.priority.min' => 'Priority must be at least 0.',
            'tasks.*.priority.max' => 'Priority must not exceed 100.',
        ];
    }
}
