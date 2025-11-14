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

namespace App\Apps\DictV1\Utils\Dict;
use App\Utils\StrTool;
class DictWrap
{
    public static function mergeAlreadyWrapDict($alreadyExistDictionaries, $newDictionary)
    {
        $alreadyExistDictionaries = self::wrapDictToItemArray($alreadyExistDictionaries);
        $newDictionary = self::wrapDictToItemArray($newDictionary);
        $newDictionaries = $alreadyExistDictionaries + $newDictionary;
        return $newDictionaries;
    }

    public static function wrapDictToItemArray(array|string|null $words)
    {
        $words = StrTool::toWordArray($words);
        $result = [];
        $index =0;
        foreach ($words as $key => $wordOrItem) {
            $word = $key;
            if(is_string($wordOrItem)){
                $result[$wordOrItem] = self::wrapDictToItem($wordOrItem,$index); // Apply the template to each word
            }
            if(is_array($wordOrItem)){
                $result[$word] = self::wrapDictToItem($wordOrItem,$index); // Apply the template to each word
            }
            $index++;
        }
        return $result;
    }
    
    public static function wrapDictToItem($dictionary,$index)
    {
        $template = [
            'read' => 0,
            'weight' => 0,
            'learned' => 0,
            'reviewed' => 0,
            'last_read_time' => 0,
            'review_time' => 0,
            'index' => $index,
        ];
        if (is_string($dictionary) || !$dictionary) {
            return $template;
        }
        if (is_array($dictionary)) {
            foreach ($template as $key => $value) {
                if (!isset($dictionary[$key])) {
                    $dictionary[$key] = $value;
                }
            }
            return $dictionary;
        }
        return $template;
    }
}