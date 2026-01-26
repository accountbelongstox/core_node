<?php

namespace App\Apps\AppQyV1\AppQyV1Requests\Group;

use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BaseRequest;
use App\Providers\AppTablePrefixServiceProvider;
use App\Constants\AppKeys;

class AppQyV1AddLibraryToGroupRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');
        
        return [
            'gid' => 'required|string',
            'library_id' => "required|integer|exists:{$connection}.{$tableName},id",
        ];
    }

    public function messages(): array
    {
        return [
            'gid.required' => 'Group ID is required',
            'gid.string' => 'Group ID must be a string',
            'library_id.required' => 'Library ID is required',
            'library_id.integer' => 'Library ID must be an integer',
            'library_id.exists' => 'Library not found',
        ];
    }
}
