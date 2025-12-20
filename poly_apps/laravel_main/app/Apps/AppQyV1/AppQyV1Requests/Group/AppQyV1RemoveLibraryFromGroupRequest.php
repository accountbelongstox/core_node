<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;

class AppQyV1RemoveLibraryFromGroupRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'gid' => 'required|string',
            'library_id' => 'required|integer',
        ];
    }
}
