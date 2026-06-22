<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

/**
 * Add TTS Task Request
 *
 * Validates request to add TTS task to queue
 */
class AppQyV1AddTTSTaskRequest extends AppQyV1BaseRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'content' => 'required|string|max:10000',
            'language' => 'required|string|max:10',
            'type' => 'nullable|string|in:word,sentence,article',
            'priority' => 'nullable|integer|min:0|max:100',
            // FE fast-track flag: when true the row jumps to the front of the
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
            'content.required' => 'Content is required.',
            'content.max' => 'Content must not exceed 10000 characters.',
            'language.required' => 'Language is required.',
            'language.max' => 'Language code must not exceed 10 characters.',
            'type.in' => 'Task type must be word, sentence, or article.',
            'priority.min' => 'Priority must be at least 0.',
            'priority.max' => 'Priority must not exceed 100.',
        ];
    }
}
