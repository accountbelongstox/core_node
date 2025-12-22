<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1AddWordsToGroupRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'gid' => 'required|string',
            'word_id' => 'nullable|integer',
            'word_ids' => 'nullable|array',
            'word_ids.*' => 'integer',
        ];
    }

    public function messages(): array
    {
        return [
            'gid.required' => 'Group ID is required',
            'word_id.integer' => 'Word ID must be an integer',
            'word_ids.array' => 'Word IDs must be an array',
            'word_ids.*.integer' => 'Each word ID must be an integer',
        ];
    }
}
