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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;
use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionariesModel;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
class AppQyV1PersonalDictionaryQueryBasePublicController
{

    public static function queryPersonalDictionary($query_soft_delete = false, $return_model = false, $frequency_sort = true)
    {

        $uid = Auth::id();
        if ($query_soft_delete) {
            $personDictModel = PersonalDictionaries::where('uid', $uid)->whereNull('deleted_at')->first();
        } else {
            $personDictModel = PersonalDictionaries::where('uid', $uid)->first();
        }
        if (!$personDictModel) {
            $personDictModel = new PersonalDictionaries();
            $personDictModel->uid = $uid;
            $personDictModel->personal_dicts = json_encode([]);
        }
        $personDictResult = self::getPersonalWords($personDictModel, $frequency_sort);
        $reulstData = [
            'query_soft_delete' => $query_soft_delete,
            "dictionaries_lenght" => $personDictResult['count'],
            'id' => $personDictResult['id'],
            'data' => $personDictResult['data'],
            'pd_count' => $personDictResult['count'],

        ];
        if ($return_model) {
            return [
                'model' => $personDictModel,
                'query_result' => $reulstData,
            ];
        }
        return $reulstData;
    }
    public static function getPersonalWords($queryrequest, $frequency_sort = true,)
    {
        if($frequency_sort == null)$frequency_sort = true;
        $personal_words = [];
        $id = null;
        $count = 0;
        if ($queryrequest) {
            $personal_words = $queryrequest->personal_dicts;
            if (!$personal_words) {
                $personal_words = [];
            }
            $id = $queryrequest->id;
        }
        try {
            if (is_string($personal_words)) {
                $personal_words = json_decode($personal_words, true);

            }
        } catch (\Exception $e) {
            $personal_words = [];
        }
        $count = ArrTool::count($personal_words);
        $personal_words = (array) $personal_words;
        asort($personal_words);
        if($frequency_sort == true){
            asort($personal_words);
        }
        return [
            'id' => $id,
            'data' => $personal_words,
            'count' => $count,
        ];
    }


}

