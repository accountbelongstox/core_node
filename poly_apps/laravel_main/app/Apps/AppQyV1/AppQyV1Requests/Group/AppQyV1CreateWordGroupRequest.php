<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1CreateWordGroupRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'gname' => 'required|string|max:255',
            'gcontent' => 'nullable|string',
            'gwords' => 'nullable|string',
            'sort' => 'nullable|integer',
            'language' => 'nullable|string|size:2',
        ];
    }

    public function messages(): array
    {
        return [
            'gname.required' => 'Group name is required',
            'gname.max' => 'Group name must not exceed 255 characters',
            'language.size' => 'Language code must be exactly 2 characters',
        ];
    }
}
