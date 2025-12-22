<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1RemoveWordsFromGroupRequest extends AppQyV1BaseRequest
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
}
