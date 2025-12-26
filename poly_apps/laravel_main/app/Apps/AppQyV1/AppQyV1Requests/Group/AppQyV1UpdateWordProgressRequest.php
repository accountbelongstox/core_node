<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1UpdateWordProgressRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'gid' => 'required|string',
            'word_id' => 'required|integer',
            'action' => 'required|string|in:read,review,correct,incorrect',
            'proficiency' => 'nullable|integer|min:0|max:100',
            'is_correct' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'gid.required' => 'Group ID is required',
            'word_id.required' => 'Word ID is required',
            'action.required' => 'Action is required',
            'action.in' => 'Action must be one of: read, review, correct, incorrect',
            'proficiency.integer' => 'Proficiency must be an integer',
            'proficiency.min' => 'Proficiency must be at least 0',
            'proficiency.max' => 'Proficiency must not exceed 100',
        ];
    }
}
