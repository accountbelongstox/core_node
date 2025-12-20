<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1GetRecommendationsRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'gid' => 'required|string',
            'limit' => 'nullable|integer|min:1|max:100',
            'proficiency_max' => 'nullable|integer|min:0|max:100',
        ];
    }

    public function messages(): array
    {
        return [
            'limit.max' => 'Limit must not exceed 100',
            'proficiency_max.max' => 'Proficiency max must not exceed 100',
        ];
    }
}
