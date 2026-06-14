<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Http\Request;

class ParameterTool
{
    public static function getBoolNormal(Request $request, $key): bool
    {
        $value = $request->input($key);
        if ($value === false || $value === "false" || $value === 0 || $value === "0" || !$value) {
            return false;
        }
        return true;
    }

    public static function getBoolPriorityFalse(Request $request, $key, $isNullDefault = false): bool
    {
        $value = $request->input($key);
        if ($value === null) {
            return $isNullDefault;
        }
        if ($value === false || $value === "false" || $value === 0 || $value === "0" || !$value) {
            return false;
        }
        return true;
    }

    public static function getBoolPriorityTrue(Request $request, $key, $isNullDefault = true): bool
    {
        $value = $request->input($key);
        if ($value === null) {
            return $isNullDefault;
        }
        if ($value === false || $value === "false" || $value === 0 || $value === "0" || !$value) {
            return false;
        }
        return true;
    }
}