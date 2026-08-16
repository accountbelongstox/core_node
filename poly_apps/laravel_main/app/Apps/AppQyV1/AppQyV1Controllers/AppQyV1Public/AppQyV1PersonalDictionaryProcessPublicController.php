<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;
use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionariesModel;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Traits\ApiResponse;
class AppQyV1PersonalDictionaryProcessPublicController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */


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
                $operation = 'set';
                if (isset($operationAndValue['op'])) {
                    $operation = $operationAndValue['op'];
                }
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
        $personDModel->saveRecord();
        return $upPropertyResult;
    }

}
