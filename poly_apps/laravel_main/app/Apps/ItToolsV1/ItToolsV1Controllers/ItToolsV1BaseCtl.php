<?php

namespace App\Apps\ItToolsV1\ItToolsV1Controllers;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

abstract class ItToolsV1BaseCtl extends Controller
{
    use ApiResponse;

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
                422,
                ['missing_fields' => $missingFields]
            );
        }

        return null;
    }
}
