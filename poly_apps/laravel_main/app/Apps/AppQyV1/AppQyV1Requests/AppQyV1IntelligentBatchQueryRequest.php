<?php

namespace App\Apps\AppQyV1\AppQyV1Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'queries.*.type' => 'nullable|string|in:word,sentence,article',
            'queries.*.priority' => 'nullable|integer|min:0|max:100',
            'default_priority' => 'nullable|integer|min:0|max:100',
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
            'queries.*.type.in' => 'Task type must be one of: word, sentence, article',
            'queries.*.priority.min' => 'Priority must be between 0 and 100',
            'queries.*.priority.max' => 'Priority must be between 0 and 100',
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
