<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Requests;

use Illuminate\Foundation\Http\FormRequest;

class DingDuoDuoV1MemberRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:191'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'device_id' => ['nullable', 'string', 'max:191'],
        ];
    }
}
