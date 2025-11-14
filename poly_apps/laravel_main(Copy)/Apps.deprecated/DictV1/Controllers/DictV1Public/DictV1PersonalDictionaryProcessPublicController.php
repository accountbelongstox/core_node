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


namespace App\Apps\DictV1\Controllers\DictV1Public;
use App\Apps\DictV1\DictV1Models\DictV1PersonalDictionariesModel;
use App\Utils\ArrTool;
use App\Apps\DictV1\Utils\Dict\DictWrap;
use App\Apps\DictV1\Controllers\DictV1Public\PDQBasePublic;
class DictV1PersonalDictionaryProcessPublicController
{

    public static function updateReviewedPDByWords($words, $safeUpdate = false)
    {
        $upArray = [
            'reviewed' => [
                'op' => 'plus',
                'value' => 1,
            ],
            'review_time' => [
                'op' => 'set',
                'value' => time(),
            ],
        ];
        $default_value = 0;
        return self::updatePropertyPDByWords($words, $upArray, $default_value, $safeUpdate);
    }


    public static function updateLearnedPDByWords($words, $safeUpdate = false)
    {
        $upArray = [
            'learned' => [
                'op' => 'plus',
                'value' => 1,
            ],
        ];
        $default_value = 0;
        return self::updatePropertyPDByWords($words, $upArray, $default_value, $safeUpdate);
    }

    public static function updateReadPDByWords($words, $safeUpdate = false)
    {
        $upArray = [
            'read' => [
                'op' => 'plus',
                'value' => 1,
            ],
        ];
        $default_value = 0;
        return self::updatePropertyPDByWords($words, $upArray, $default_value, $safeUpdate);
    }
    public static function updateWeightPDByWords($words, $safeUpdate = false)
    {
        $upArray = [
            'weight' => [
                'op' => 'plus',
                'value' => 1,
            ],
        ];
        $default_value = 0;
        return self::updatePropertyPDByWords($words, $upArray, $default_value, $safeUpdate);
    }
    public static function updateLastReadPDByWords($words, $safeUpdate = false)
    {
        $upArray = [
            'last_read_time' => [
                'op' => 'set',
                'value' => time(),
            ],
        ];
        $default_value = 0;
        return self::updatePropertyPDByWords($words, $upArray, $default_value, $safeUpdate);
    }

    public static function updatePropertyPDByWords($wordOrWords, $propertyOrUpArray, $default_value = 0, $safeUpdate = false)
    {
        if (!$wordOrWords) {
            return [];
        }
        $queryResult = PDQBasePublic::queryPersonalDictionary(false, true);
        $personDModel = $queryResult['model'];
        $personDict = $queryResult['query_result']['data'];
        $dictionaries_lenght = $queryResult['query_result']['dictionaries_lenght'];
        $words = is_array($wordOrWords) ? $wordOrWords : explode(',', $wordOrWords);
        $upPropertyResult = [];
        foreach ($words as $word) {
            if (!isset($personDict[$word]) && !empty($word) && !$safeUpdate) {
                $index = $dictionaries_lenght + 1;
                $personDict[$word] = DictWrap::wrapDictToItem($word, $index);

            }
            if (is_string($propertyOrUpArray)) {
                $upArray = [
                    $propertyOrUpArray => [
                        'op' => 'set',
                        'value' => $default_value,
                    ],
                ];
            } else {
                $upArray = $propertyOrUpArray;
            }
            $upPropertyResult[$word] = [];
            foreach ($upArray as $property_name => $operationAndValue) {
                $operation = $operationAndValue['op'] ?? 'set';
                $value = $operationAndValue['value'];
                if ($operation == "plus" && !$value) {
                    $value = 1;
                }
                if (isset($personDict[$word])) {
                    $originalValue = $personDict[$word][$property_name];
                    $newValue = $value;
                    $success = true;
                    if ($operation == "plus") {
                        $newValue = (int) $originalValue + $value;
                    } else if ($operation == "minus") {
                        $newValue = (int) $originalValue - $value;
                    } else if ($operation == "set") {
                        $newValue = $value;
                    } else {
                        $success = false;
                    }
                    if ($operation) {
                        $personDict[$word][$property_name] = $newValue;
                    }
                    $upPropertyResult[$word][$property_name] = [
                        'op' => $operation,
                        'success' => $success,
                        'original_value' => $originalValue,
                        'new_value' => $newValue,
                        "message" => "success",
                    ];
                } else {
                    $upPropertyResult[$word] = [];
                    $upPropertyResult[$word][$property_name] = [
                        'op' => $operation,
                        'success' => false,
                        "message" => "$word not found",
                    ];
                }

            }
        }
        $personDModel->personal_dicts = json_encode($personDict);
        $personDModel->save();
        return $upPropertyResult;
    }

}
