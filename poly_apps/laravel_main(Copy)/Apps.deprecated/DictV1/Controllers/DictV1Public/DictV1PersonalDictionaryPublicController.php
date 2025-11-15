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
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\DictV1\Utils\Dict\DictWrap;
use App\Apps\DictV1\Controllers\DictV1Public\PDQBasePublic;
use Illuminate\Support\Facades\Auth;

class DictV1PersonalDictionaryPublicController
{
    public static function addPersonDictionaries($dictionaries, $sort_frequency = true, $query_soft_delete = false, )
    {
        if($sort_frequency == null)$sort_frequency = true;
        if($query_soft_delete == null)$query_soft_delete = false;
        $uid = Auth::id();
        if ($query_soft_delete == true) {
            $personDictModel = PersonalDictionaries::where('uid', $uid)->whereNull('deleted_at')->first();
        } else {
            $personDictModel = PersonalDictionaries::where('uid', $uid)->first();
        }
        if (!$personDictModel) {
            $personDictModel = new PersonalDictionaries(
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
        $personDictModel->save();
        return [
            "sort_frequency" => $sort_frequency,
            "query_soft_delete" => $query_soft_delete,
            "model" => $personDictModel,
            ...$result
        ];
    }


}
