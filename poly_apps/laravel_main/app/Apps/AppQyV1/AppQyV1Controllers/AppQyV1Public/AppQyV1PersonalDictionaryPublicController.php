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
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use Illuminate\Support\Facades\Auth;
use App\Traits\ApiResponse;

class AppQyV1PersonalDictionaryPublicController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public static function addPersonDictionaries($dictionaries, $sort_frequency = true, $query_soft_delete = false, )
    {
        if($sort_frequency == null)$sort_frequency = true;
        if($query_soft_delete == null)$query_soft_delete = false;
        $uid = Auth::id();
        $personDictModel = AppQyV1PersonalDictionariesModel::findForUser(
            (int) $uid,
            $query_soft_delete == true
        );
        if (!$personDictModel) {
            $personDictModel = new AppQyV1PersonalDictionariesModel(
                [
                    'uid' => $uid,
                ]
            );
        }
        $result = PDQBasePublic::getPersonalWords($personDictModel, $sort_frequency);
        $personal_words = $result['data'];
        $newDictionary = DictWrap::mergeAlreadyWrapDict($personal_words, $dictionaries);
        $personDictModel->personal_dicts = json_encode($newDictionary);
        $personDictModel->uid = $uid;
        $personDictModel->saveRecord();
        return [
            "sort_frequency" => $sort_frequency,
            "query_soft_delete" => $query_soft_delete,
            "model" => $personDictModel,
            ...$result
        ];
    }


}
