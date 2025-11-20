<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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
