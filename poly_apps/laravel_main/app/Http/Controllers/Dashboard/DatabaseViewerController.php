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

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DatabaseViewerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DatabaseViewerController extends Controller
{
    /** @var DatabaseViewerService */
    protected $service;

    public function __construct(DatabaseViewerService $service)
    {
        $this->service = $service;
    }

    public function tables(): JsonResponse
    {
        $list = $this->service->getTables();
        return response()->json(['tables' => $list]);
    }

    public function structure(Request $request, string $table): JsonResponse
    {
        $connection = $request->query('connection');
        if ($connection) {
            $this->service->setConnection($connection);
        }
        $columns = $this->service->getTableStructure($table);
        return response()->json(['columns' => $columns]);
    }

    public function data(Request $request, string $table): JsonResponse
    {
        $connection = $request->query('connection');
        if ($connection) {
            $this->service->setConnection($connection);
        }
        $page = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', 20);
        $result = $this->service->getTableData($table, $page, $perPage);
        $result['data'] = array_map(fn ($row) => (array) $row, $result['data']);
        return response()->json($result);
    }
}
