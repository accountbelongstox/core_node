<?php

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