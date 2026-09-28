<?php

namespace App\Apps\AppQyV1\Utils\Dict;
use App\Utils\StrTool;
class AppQyV1DictWrap
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
