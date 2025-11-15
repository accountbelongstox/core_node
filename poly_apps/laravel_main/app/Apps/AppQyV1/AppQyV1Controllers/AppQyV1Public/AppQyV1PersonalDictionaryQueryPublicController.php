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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\PDAPublic;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\PDQBasePublic;
class AppQyV1PersonalDictionaryQueryPublicController
{
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

