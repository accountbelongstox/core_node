<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Welcome;

use Illuminate\Routing\Controller as BaseController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Traits\ApiResponse;

class AppQyV1WelcomeController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public static function getStatus()
    {
        return [
            'totalWords' => AppQyV1DictionaryModel::count(),
            'translatedWords' => AppQyV1DictionaryModel::where('isTranslation', true)->count(),
            'lastUpdated' => AppQyV1DictionaryModel::max('lastUpdateTime'),
            'totalQueries' => AppQyV1DictionaryModel::sum('queryCount'),
        ];
    }
}

