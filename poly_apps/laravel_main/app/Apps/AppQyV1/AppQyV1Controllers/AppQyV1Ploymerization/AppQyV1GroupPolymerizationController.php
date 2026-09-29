<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Ploymerization;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryPublicController as PDAPublic;
use Illuminate\Support\Str;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Utils\ParameterTool;
use App\Traits\ApiResponse;
class AppQyV1GroupPolymerizationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    /**
     * Create a new dictionary group
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function queryGroupFetchList(Request $request)
    {
        $supported_params = [
            'gname',
            'gcontent',
            'gwords',
            "sort_by",
            "sort_asc",
            "gid",
            "fetch_gcontent",
            "fetch_personal_words",
            "fetch_words_frequency",
            "fetch_gwords",
            "sort_frequency",
            "query_soft_delete"
        ];
        $isGetPersonalWords = ParameterTool::getBoolPriorityFalse($request, 'fetch_personal_words');
        $isGetGcontent = ParameterTool::getBoolPriorityFalse($request, 'fetch_gcontent');
        $isGetWordsFrequency = ParameterTool::getBoolPriorityFalse($request, 'fetch_words_frequency');
        $isGetGwords = ParameterTool::getBoolPriorityTrue($request, 'fetch_gwords');
        $resultArray = DGroupQPublic::insertGroupAndQuery(
            $request,
            $supported_params,
            $isGetPersonalWords,
            $isGetGcontent,
            $isGetWordsFrequency,
            $isGetGwords
        )
        ;
        return response()->json([
            'status' => $resultArray['status'],
            'supported_params' => $supported_params,
            'message' => $resultArray['message'],
            'data' => [
                ...$resultArray['data']
            ],
            'code' => $resultArray['code']
        ], $resultArray['code']);
    }

}

