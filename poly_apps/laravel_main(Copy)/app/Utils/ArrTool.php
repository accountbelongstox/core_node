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

class ArrTool
{

    public static function count(array|string|null $arr): int
    {
        if (is_string($arr)) {
            return 1;
        }
        if (is_array($arr)) {
            return count($arr);
        }
        return 0;
    }

    public static function mergeUnique(array $arr1, array $arr2): array
    {
        return array_values(array_unique(array_merge($arr1, $arr2)));
    }

    public static function mergeUniqueIgnoreString(array $arr1, array $arr2): array
    {
        return array_values(array_unique(array_merge($arr1, $arr2)));
    }

    public static function sortNestedObject($data, $sortBy = 'read', $direction = 'asc')
    {
        $array = (array) $data;

        if (empty($array)) {
            return $data;
        }
        $firstItem = reset($array);
        if (!isset($firstItem[$sortBy])) {
            return $data;
        }

        uasort($array, function ($a, $b) use ($sortBy, $direction) {
            $valA = $a[$sortBy];
            $valB = $b[$sortBy];

            if ($valA == $valB) {
                return 0;
            }

            $result = ($valA < $valB) ? -1 : 1;

            return ($direction === 'desc') ? -$result : $result;
        });

        return (object) $array;
    }

    public static function filterByKeys($a, $b)
    {
        $array = is_object($a) ? (array) $a : $a;
        $lowerB = array_map('strtolower', $b);
        $filtered = array_filter($array, function ($key) use ($lowerB) {
            return in_array(strtolower($key), $lowerB);
        }, ARRAY_FILTER_USE_KEY);
        $result = is_object($a) ? (object) $filtered : $filtered;
        return $result;
    }

    public static function randomArray(array $array, int $num): array
    {
        if ($num <= 0) {
            return [];
        }
        $count = count($array);
        $num = min($num, $count); // Ensure we don't exceed array length

        if ($num === $count) {
            return $array; // Return all if requested amount equals array size
        }
        $keys = array_rand($array, $num);
        $keys = is_array($keys) ? $keys : [$keys]; // Handle single vs multiple results
        return array_intersect_key($array, array_flip($keys));
    }
}

