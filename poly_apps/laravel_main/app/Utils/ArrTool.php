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
        if ($sortBy === null || $sortBy === '') {
            return $data;
        }
        $firstItem = reset($array);
        if (!is_array($firstItem) && !is_object($firstItem)) {
            return $data;
        }
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

