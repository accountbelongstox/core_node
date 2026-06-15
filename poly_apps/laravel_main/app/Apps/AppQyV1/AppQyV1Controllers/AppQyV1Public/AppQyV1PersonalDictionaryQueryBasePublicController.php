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
use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionariesModel;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use App\Traits\ApiResponse;
class AppQyV1PersonalDictionaryQueryBasePublicController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */


    public static function queryPersonalDictionary($query_soft_delete = false, $return_model = false, $frequency_sort = true)
    {

        $uid = Auth::id();
        if ($query_soft_delete) {
            $personDictModel = AppQyV1PersonalDictionariesModel::where('uid', $uid)->whereNull('deleted_at')->first();
        } else {
            $personDictModel = AppQyV1PersonalDictionariesModel::where('uid', $uid)->first();
        }
        if (!$personDictModel) {
            $personDictModel = new AppQyV1PersonalDictionariesModel();
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
            if (is_string($personal_words)) {
                $personal_words = json_decode($personal_words, true);

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

