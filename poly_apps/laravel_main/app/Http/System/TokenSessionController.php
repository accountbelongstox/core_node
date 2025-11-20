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

namespace App\Http\System;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Events\TokenKeyEvent;
class TokenSessionController
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'key' => 'required|string',
            'value' => 'required|string'
        ]);

        $cacheKey = "session:{$validated['token']}";
        Cache::put($cacheKey.':'.$validated['key'], $validated['value']);

        return response()->json(['status' => 'success']);
    }

    public function retrieve(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'key' => 'required|string'
        ]);

        $cacheKey = "session:{$validated['token']}:{$validated['key']}";
        $value = Cache::get($cacheKey);

        return response()->json([
            'exists' => !is_null($value),
            'value' => $value
        ]);
    }

    public function broadcast(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'key' => 'required|string',
            'message' => 'required|string'
        ]);

        event(new TokenKeyEvent(
            $validated['token'],
            $validated['key'],
            $validated['message']
        ));

        return response()->json(['status' => 'broadcast_sent']);
    }
}
