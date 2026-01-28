<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Providers\AppTablePrefixServiceProvider;
use App\Constants\AppKeys;

class AppQyV1AddLibraryToGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');
        
        return [
            'gid' => ['required', 'string'],
            'library_id' => ['required', 'integer', "exists:{$connection}.{$tableName},id"],
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
