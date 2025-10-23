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
use Illuminate\Http\Request;
use App\Apps\DictV1\DictV1Models\DictV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
class DictV1WordGroupToolPublicController
{
    public static function getQueryParam(Request $request, $key, $defaultval = null)
    {
        $value = $request->input($key);
        if (!$value) {
            return $defaultval;
        }
        return $value;
    }

    public static function includePersonWords($group, $sort_frequency = true)
    {
        $person_words = PDQBasePublic::queryPersonalDictionary(false, $sort_frequency);
        $group->gwords = ArrTool::mergeUniqueIgnoreString($group->gwords, $person_words);
        return $group;
    }

}
