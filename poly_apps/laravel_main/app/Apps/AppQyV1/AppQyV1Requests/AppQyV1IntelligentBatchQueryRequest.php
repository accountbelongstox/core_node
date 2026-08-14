<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use App\Support\QueueCenterContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AppQyV1IntelligentBatchQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'queries' => 'required|array|min:1|max:100',
            'queries.*.task_id' => 'nullable|integer|min:1',
            'queries.*.content' => 'nullable|string|max:50000',
            'queries.*.language' => 'nullable|string|max:10',
            'queries.*.type' => ['nullable', 'string', Rule::in(QueueCenterContract::queuePositionOrderedTaskAliases())],
            'queries.*.position' => 'nullable|string|in:beginning,end',
            'default_position' => 'nullable|string|in:beginning,end',
            'queries.*.priority' => 'prohibited',
            'default_priority' => 'prohibited',
        ];
    }

    public function messages(): array
    {
        return [
            'queries.required' => 'Queries array is required',
            'queries.array' => 'Queries must be an array',
            'queries.min' => 'At least one query is required',
            'queries.max' => 'Maximum 100 queries allowed per request',
            'queries.*.task_id.integer' => 'Task ID must be an integer',
            'queries.*.content.string' => 'Content must be a string',
            'queries.*.content.max' => 'Content cannot exceed 50000 characters',
            'queries.*.language.max' => 'Language code cannot exceed 10 characters',
        ];
    }

    /**
     * Validate that each query has either task_id or (content + language)
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $queries = $this->input('queries', []);

            foreach ($queries as $index => $query) {
                $hasTaskId = isset($query['task_id']);
                $hasContent = isset($query['content']) && isset($query['language']);

                if (!$hasTaskId && !$hasContent) {
                    $validator->errors()->add(
                        "queries.{$index}",
                        "Query must have either 'task_id' or both 'content' and 'language'"
                    );
                }

                if ($hasTaskId && $hasContent) {
                    $validator->errors()->add(
                        "queries.{$index}",
                        "Query cannot have both 'task_id' and 'content'. Use one or the other."
                    );
                }
            }
        });
    }
}
