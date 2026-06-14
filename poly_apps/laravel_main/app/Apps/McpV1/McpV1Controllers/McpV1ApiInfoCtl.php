<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\McpV1\McpV1Controllers;

use App\Http\Controllers\Controller;
use App\Apps\McpV1\McpV1ApiInfo;
use Illuminate\Http\JsonResponse;

class McpV1ApiInfoCtl extends Controller
{
    /**
     * Get API information for McpV1
     */
    public function getApiInfo(): JsonResponse
    {
        return response()->json(McpV1ApiInfo::getApiInfo());
    }
}

