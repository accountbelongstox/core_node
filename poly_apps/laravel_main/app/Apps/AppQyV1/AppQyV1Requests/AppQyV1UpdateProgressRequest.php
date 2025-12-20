<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProgressActionEnum;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AppQyV1UpdateProgressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'gid' => ['required', 'string'],
            'word_id' => ['required', 'integer'],
            'action' => ['required', Rule::enum(AppQyV1ProgressActionEnum::class)],
            'proficiency' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_correct' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'gid.required' => 'Group ID is required',
            'word_id.required' => 'Word ID is required',
            'action.required' => 'Action is required',
            'action.in' => 'Action must be either "read" or "review"',
            'proficiency.min' => 'Proficiency must be at least 0',
            'proficiency.max' => 'Proficiency cannot exceed 100',
        ];
    }

    public function supportedParams(): array
    {
        return ['gid', 'word_id', 'action', 'proficiency', 'is_correct'];
    }

    public function getActionEnum(): AppQyV1ProgressActionEnum
    {
        return AppQyV1ProgressActionEnum::from($this->input('action'));
    }
}
