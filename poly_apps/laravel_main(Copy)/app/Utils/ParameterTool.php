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