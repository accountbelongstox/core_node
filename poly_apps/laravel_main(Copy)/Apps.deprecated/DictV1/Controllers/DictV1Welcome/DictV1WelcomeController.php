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


namespace App\Apps\DictV1\Controllers\DictV1Welcome;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\DB;

class DictV1WelcomeController extends BaseController
{
    public static function getStatus()
    {
        return [
            'totalWords' => DB::table('dict_v1_dictionaries')->count(),
            'translatedWords' => DB::table('dict_v1_dictionaries')->where('isTranslation', true)->count(),
            'lastUpdated' => DB::table('dict_v1_dictionaries')->max('lastUpdateTime'),
            'totalQueries' => DB::table('dict_v1_dictionaries')->sum('queryCount'),
        ];
    }
}
