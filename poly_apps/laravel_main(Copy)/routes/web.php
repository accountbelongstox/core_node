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

use Illuminate\Support\Facades\Route;
use App\Http\EnvironmentApiInfo\DebugIndex;
use App\Http\EnvironmentApiInfo\ApiInfoIndex;
use App\Http\EnvironmentApiInfo\ApiParamsCache;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

// This route is the single web entry point for debugging and must not be modified.
// It points to the ApiInfoIndex class which is responsible for gathering all information.
Route::get('/api_info', [ApiInfoIndex::class, 'index']);

// Root route displays a complete HTML debugging interface
Route::get('/', [DebugIndex::class, 'index']);

// API parameters cache routes
Route::post('/api_params_cache/save', [ApiParamsCache::class, 'save']);
Route::get('/api_params_cache/load', [ApiParamsCache::class, 'load']);
Route::get('/api_params_cache/list', [ApiParamsCache::class, 'listByApp']);
