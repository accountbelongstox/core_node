<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the recharge-order creation payload ({token, package_id}).
 */
class DingDuoDuoV1RechargeCreateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['nullable', 'string', 'max:191'],
            'package_id' => ['required', 'string', 'max:64'],
        ];
    }
}
