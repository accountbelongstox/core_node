<?php

namespace App\Apps\AppQyV1\Utils\Dict;
class AppQyV1DictFrequency
{
    public static function countFrequency($words, $gcontent)
    {
        $frequency = [];
        foreach ($words as $key => $wordOrItem) {
            $word = $key;
            $frequency[$word] = count($gcontent);
        }
    }
}
