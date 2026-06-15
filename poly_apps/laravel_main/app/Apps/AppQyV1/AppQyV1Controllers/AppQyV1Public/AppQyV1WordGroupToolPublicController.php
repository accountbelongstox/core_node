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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use App\Traits\ApiResponse;
class AppQyV1WordGroupToolPublicController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

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

