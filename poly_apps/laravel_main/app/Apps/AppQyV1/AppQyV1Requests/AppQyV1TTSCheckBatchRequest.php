<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

/**
 * TTS Batch Status Check Request
 *
 * Validates batch status check requests for TTS queue
 * Max 100 words per request to match queue_batch limit
 */
class AppQyV1TTSCheckBatchRequest extends AppQyV1BaseRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'words' => 'required|array|min:1|max:100',
            'words.*.word' => 'required|string|max:255',
            'words.*.language' => 'required|string|max:10',
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
            'words.required' => 'The words field is required.',
            'words.array' => 'The words must be an array.',
            'words.min' => 'At least 1 word is required.',
            'words.max' => 'Cannot check more than 100 words at once.',
            'words.*.word.required' => 'Each word entry must have a word field.',
            'words.*.word.string' => 'Word must be a string.',
            'words.*.word.max' => 'Word must not exceed 255 characters.',
            'words.*.language.required' => 'Each word entry must have a language field.',
            'words.*.language.string' => 'Language must be a string.',
            'words.*.language.max' => 'Language code must not exceed 10 characters.',
        ];
    }
}
