<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;

class AppQyV1AddLibraryToGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'gid' => ['required', 'string'],
            'library_id' => ['required', 'integer', 'exists:appqyv1.app_qy_v1_vocabulary_libraries,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'gid.required' => 'Group ID is required',
            'library_id.required' => 'Library ID is required',
            'library_id.exists' => 'Library not found',
        ];
    }

    public function supportedParams(): array
    {
        return ['gid', 'library_id'];
    }
}
