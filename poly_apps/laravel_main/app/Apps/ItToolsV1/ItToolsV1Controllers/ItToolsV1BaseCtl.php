<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Controllers;

use Illuminate\Http\JsonResponse;

abstract class ItToolsV1BaseCtl
{
    protected function success($data, string $message = 'Success', int $code = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'timestamp' => time()
        ], $code);
    }
    
    protected function error(string $message, $errors = null, int $code = 400): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
            'timestamp' => time()
        ];
        
        if ($errors !== null) {
            $response['errors'] = $errors;
        }
        
        return response()->json($response, $code);
    }
    
    protected function validateRequired(array $data, array $requiredFields): ?JsonResponse
    {
        $missingFields = [];
        
        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
                $missingFields[] = $field;
            }
        }
        
        if (!empty($missingFields)) {
            return $this->error(
                'Missing required fields',
                ['missing_fields' => $missingFields],
                422
            );
        }
        
        return null;
    }
    
    protected function safeExecute(callable $callback): JsonResponse
    {
        try {
            $result = $callback();
            return is_array($result) ? $this->success($result) : $result;
        } catch (\Exception $e) {
            return $this->error(
                'Operation failed: ' . $e->getMessage(),
                ['exception' => get_class($e)],
                500
            );
        }
    }
}
