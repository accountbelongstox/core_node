<?php

namespace App\Http\Requests\DataSync;

use Illuminate\Foundation\Http\FormRequest;

final class SetDataSyncTargetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'target' => ['required', 'string', 'max:512'],
        ];
    }
}
