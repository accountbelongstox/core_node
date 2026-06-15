<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
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
        return response()->json($result);
    }
}
