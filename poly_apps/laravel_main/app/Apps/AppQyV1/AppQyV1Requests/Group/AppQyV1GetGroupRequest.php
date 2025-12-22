<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1GetGroupRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'gid' => 'required|string',
            'fetch_gcontent' => 'nullable|boolean',
            'sort_by' => 'nullable|string',
            'sort_asc' => 'nullable|boolean',
            'sort_frequency' => 'nullable|boolean',
        ];
    }
}
