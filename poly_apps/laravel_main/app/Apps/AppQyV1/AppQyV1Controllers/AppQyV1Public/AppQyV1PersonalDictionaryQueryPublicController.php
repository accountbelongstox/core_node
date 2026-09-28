<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;  
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionariesModel;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\PDAPublic;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Traits\ApiResponse;
class AppQyV1PersonalDictionaryQueryPublicController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public static function queryPDByWord($word)
    {
        $queryResult = PDQBasePublic::queryPersonalDictionary(false);
        $personDict = $queryResult['data']; 
        if(isset($personDict[$word])){
            return $personDict[$word];
        }
        return [];
    }

}

