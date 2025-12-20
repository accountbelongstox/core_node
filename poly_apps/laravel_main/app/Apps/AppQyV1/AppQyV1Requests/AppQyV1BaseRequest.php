<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * AppQyV1 基础 FormRequest
 * 统一处理验证失败响应格式
 * 自动提取 supported_params
 */
abstract class AppQyV1BaseRequest extends FormRequest
{
    /**
     * 默认授权通过
     * 子类可覆盖实现权限检查
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * 验证失败处理
     * 返回统一格式的错误响应,包含 supported_params
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
     * 自定义错误消息 (可选)
     * 子类可覆盖提供自定义消息
     */
    public function messages(): array
    {
        return [];
    }

    /**
     * 自定义属性名称 (可选)
     * 子类可覆盖提供友好的属性名
     */
    public function attributes(): array
    {
        return [];
    }
}
