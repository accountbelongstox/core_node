<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the member login payload ({username, password, device_id?}).
 */
class DingDuoDuoV1MemberLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:191'],
            'password' => ['required', 'string', 'max:255'],
            'device_id' => ['nullable', 'string', 'max:191'],
        ];
    }
}
