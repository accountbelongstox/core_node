<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use App\Traits\ApiResponse;
class AppQyV1WordGroupToolPublicController extends Controller
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

