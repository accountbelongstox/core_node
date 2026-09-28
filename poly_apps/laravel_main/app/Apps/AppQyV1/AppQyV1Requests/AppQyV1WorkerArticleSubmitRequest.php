<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;

class AppQyV1WorkerArticleSubmitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'article_text' => ['required', 'string', 'min:10', 'max:50000'],
            'language' => ['nullable', 'string', 'max:20'],
            'title' => ['nullable', 'string', 'max:255'],
            'title_en' => ['nullable', 'string', 'max:255'],
            'title_cn' => ['nullable', 'string', 'max:255'],
            'reference_cn' => ['nullable', 'string', 'max:5000'],
            'reference_lang' => ['nullable', 'string', 'max:10'],
            'target_lang' => ['nullable', 'string', 'max:10'],
            'article_type' => ['nullable', 'string', 'in:daily'],
            'source' => ['nullable', 'string', 'in:agent_history'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
            'raw_preview' => ['nullable', 'string', 'max:5000'],
            'raw_word_count' => ['nullable', 'integer', 'min:0'],
            'audio_base64' => ['required', 'string'],
            'tts_engine' => ['nullable', 'string', 'max:100'],
            'tts_model' => ['nullable', 'string', 'max:200'],
            'tts_chunked' => ['nullable', 'boolean'],
            'tts_accent' => ['nullable', 'string', 'max:20'],
            'openrouter_model' => ['nullable', 'string', 'max:200'],
        ];
    }
}
