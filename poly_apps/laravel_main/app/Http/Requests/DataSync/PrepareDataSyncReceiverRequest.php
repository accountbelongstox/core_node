<?php

namespace App\Http\Requests\DataSync;

use Illuminate\Foundation\Http\FormRequest;

final class PrepareDataSyncReceiverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source_job_id' => ['required', 'string', 'size:32', 'regex:/^[a-f0-9]{32}$/'],
            'prepare_token' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/'],
            'options' => ['required', 'array'],
            'options.databases' => ['required', 'boolean'],
            'options.resources' => ['required', 'boolean'],
            'options.compression' => ['required', 'boolean'],
        ];
    }
}
