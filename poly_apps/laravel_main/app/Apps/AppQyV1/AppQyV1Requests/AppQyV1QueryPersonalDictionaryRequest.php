<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

class AppQyV1QueryPersonalDictionaryRequest extends AppQyV1BaseRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'query_soft_delete' => 'nullable|boolean',
        ];
    }
}
