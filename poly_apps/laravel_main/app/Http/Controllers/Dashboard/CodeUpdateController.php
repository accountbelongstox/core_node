<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\LaravelCodeLastModifiedService;
use Illuminate\Http\JsonResponse;

/**
 * Dashboard helper: latest laravel_main source modification time for the UI header.
 */
class CodeUpdateController extends Controller
{
    public function lastModified(): JsonResponse
    {
        $data = (new LaravelCodeLastModifiedService())->probe();

        return response()
            ->json([
                'success' => true,
                'data' => $data,
            ])
            ->header('Cache-Control', 'no-store, max-age=0');
    }
}
