<?php

namespace App\Http\Requests\DataSync;

use Illuminate\Foundation\Http\FormRequest;

final class StartDataSyncRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'target' => ['nullable', 'string', 'max:512'],
            'databases' => ['required', 'boolean'],
            'resources' => ['required', 'boolean'],
            'compression' => ['required', 'boolean'],
        ];
    }
}
