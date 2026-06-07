<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * AppQyV1 base FormRequest
 * Uniformly handles the validation failure response format
 * Automatically extracts supported_params
 */
abstract class AppQyV1BaseRequest extends FormRequest
{
    /**
     * Authorize by default
     * Subclasses can override to implement permission checks
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Handle validation failure
     * Returns an error response in the unified format, including supported_params
     */
    protected function failedValidation(Validator $validator)
    {
        $supportedParams = array_keys($this->rules());

        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'error' => $validator->errors()->first(),
                'message' => $validator->errors()->first(),
                'data' => ['supported_params' => $supportedParams],
                'code' => 400,
                'status' => 'error',
            ], 400)
        );
    }

    /**
     * Custom error messages (optional)
     * Subclasses can override to provide custom messages
     */
    public function messages(): array
    {
        return [];
    }

    /**
     * Custom attribute names (optional)
     * Subclasses can override to provide friendly attribute names
     */
    public function attributes(): array
    {
        return [];
    }
}
