<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;

class AppQyV1AddWordToGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'gid' => ['required', 'string'],
            'word_id' => ['required_without:word_ids', 'integer'],
            'word_ids' => ['required_without:word_id', 'array'],
            'word_ids.*' => ['integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'gid.required' => 'Group ID is required',
            'word_id.required_without' => 'Either word_id or word_ids is required',
            'word_ids.required_without' => 'Either word_id or word_ids is required',
        ];
    }

    public function supportedParams(): array
    {
        return ['gid', 'word_id', 'word_ids'];
    }
}
