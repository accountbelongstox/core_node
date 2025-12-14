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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Utils\ParameterTool;
use App\Traits\ApiResponse;
class AppQyV1WordGroupQueryPublicController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public static function valideGidGname($gname, $gid, )
    {
        $gcredential = $gid;
        if (isset($gname)) {
            $gcredential = $gname;
        }
        $isGname = $gname ? true : false;
        $status = "success";
        $success = true;
        $message = "success";
        if (!$gcredential) {
            $status = "error";
            $success = false;
            $message = "Group credential Gid or Gname is required";
        }
        return [
            'gcredential' => $gcredential,
            'isGname' => $isGname,
            'status' => $status,
            'message' => $message,
            'success' => $success,
        ];
    }
    public static function isGroupNameExist($rowGname, $rowGid = null)
    {
        $result = self::valideGidGname($rowGname, $rowGid);
        $gcredential = $result["gcredential"];
        $queryByGname = $result["isGname"];
        $success = $result["success"];
        $message = $result["message"];
        $gcredential = $result["gcredential"];
        $existGroup = null;
        $isNewGroup = false;
        if ($success == true) {
            $uid = Auth::id();
            if ($queryByGname) {
                $existGroup = AppQyV1WordGroupModel::where('gname', $gcredential)->where('uid', $uid)->first();
            } else {
                $existGroup = AppQyV1WordGroupModel::where('gid', $gcredential)->where('uid', $uid)->first();
            }
            if (!$existGroup && $queryByGname == true) {
                $newGid = Str::uuid()->toString();
                $newGname = StrTool::genGnameByTimeAndUUID();
                if (isset($gcredential)) {
                    $newGname = $gcredential;
                }
                $isNewGroup = true;
                $existGroup = new WordGroup([
                    'gid' => $newGid,
                    'uid' => $uid,
                    'gname' => $newGname,
                    'gcontent' => '',
                    'gwords' => [],
                    'words_frequency' => [],
                ]);
            }
            if (!$existGroup) {
                $success = false;
                $message = "Group id is invalid";
            }
        } else {
            $status = "error";
            $success = false;
        }

        return [
            'group' => $existGroup,
            'isNewGroup' => $isNewGroup,
            'success' => $success,
            'message' => $message,
            'gcredential' => $gcredential
        ];
    }

    public static function appendWordToGroup($gwords, $group, $sort_by = 'read', $sort_asc = true)
    {
        if (empty($gwords)) {
            $gwords = StrTool::extractWords($group->gcontent);
        }
        $originWords = StrTool::toWordArray($group->gwords);
        $newWords = StrTool::toWordArray($gwords);
        $mergeWords = ArrTool::mergeUniqueIgnoreString($originWords, $newWords);
        $mergeWords = ArrTool::sortNestedObject($mergeWords, $sort_by, $sort_asc);
        return $mergeWords;
    }

    public static function countFrequency($existGroup, $gcontent, $gwords, $sort_frequency = true)
    {
        if ($sort_frequency == null)
            $sort_frequency = true;
        if (!$gcontent)
            $gcontent = "";
        $new_gcontent = StrTool::combineIfNotIncluded($existGroup->gcontent, $gcontent, $join_sep);
        $words_content = implode("\n", $gwords);
        $frequency_content = $new_gcontent . "\n" . $words_content;
        $request_content = $gcontent . "\n" . $words_content;
        $request_words = StrTool::toWordArray($request_content);
        $result = StrTool::toWordFrequencyArray($frequency_content);
        $words_frequency = $result['frequency'];
        if ($sort_frequency) {
            asort($words_frequency);
        }
        $new_words = $result['words'];
        $new_gcontent_count = strlen($new_gcontent);
        return [
            'frequency' => $words_frequency,
            'new_words' => $new_words,
            'new_gcontent' => $new_gcontent,
            'new_gcontent_count' => $new_gcontent_count,
            'request_words' => $request_words,
        ];
    }

    /**
     * Create a new dictionary group
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public static function insertGroupAndQuery(
        $request,
        $supported_params = null,
        $isGetPersonalWords = false,
        $isGetGcontent = false,
        $isGetWordsFrequency = false,
        $isGetGwords = false,
    ): array {
        if (!$supported_params) {
            $supported_params = [
                'gname',
                'gcontent',
                'gwords',
                "sort_by",
                "sort_asc",
                "gid",
                "fetch_gcontent",
                "sort_frequency",
                "query_soft_delete"
            ];
        }
        $validator = Validator::make($request->all(), [
            'gcontent' => 'nullable|string',
            'gwords' => 'nullable|string',
            'fetch_gcontent' => 'nullable|boolean',
            'sort_frequency' => 'nullable|string',
            'sort_by' => 'nullable|string'
        ]);
        $status = "success";
        $message = "success";
        $data = null;
        $code = 200;
        if ($validator->fails()) {
            $status = "error";
            $message = "Validation failed";
            $data = null;
            $code = 422;
            return [
                'status' => $status,
                'message' => $message,
                'data' => $data,
                'code' => $code,
            ];
        }
        $uid = Auth::id();
        $username = Auth::user()->username;
        DGroupAPublic::ensureDefaultGroupIfNotExist($uid, $username);
        $gname = $request->input('gname');
        $gcontent = $request->input('gcontent');
        $gwords = $request->input('gwords');
        $gid = $request->input('gid');
        $sort_by = 'read';
        if ($request->has('sort_by')) {
            $sort_by = $request->input('sort_by');
        }
        $sort_asc = ParameterTool::getBoolPriorityTrue($request, 'sort_asc');
        $sort_frequency = ParameterTool::getBoolPriorityTrue($request, 'sort_frequency');
        $query_soft_delete = ParameterTool::getBoolPriorityFalse($request, 'query_soft_delete');

        $existGroupResult = self::isGroupNameExist($gname, $gid);
        $success = $existGroupResult['success'];
        $message = $existGroupResult['message'];
        $gcredential = $existGroupResult['gcredential'];
        if ($success == false) {
            $status = "error";
            $message = $message . " gcredential:" . $gcredential;
            $data = null;
            $code = 422;
            return [
                'status' => $status,
                'message' => $message,
                'data' => $data,
                'code' => $code,
            ];
        }

        $uid = Auth::id();
        $existGroup = $existGroupResult['group'];
        $isNewGroup = $existGroupResult['isNewGroup'];

        $newWords = StrTool::toWordArray($gwords);
        $frequency_result = self::countFrequency($existGroup, $gcontent, $newWords, $sort_frequency, );
        $combined_words = $frequency_result['new_words'];
        $request_words = $frequency_result['request_words'];
        $newWordsAndGcontentWords = $newWords + $combined_words;
        $originWords = StrTool::toWordArray($existGroup->gwords);
        $mergeWords = self::appendWordToGroup($newWordsAndGcontentWords, $existGroup, $sort_by, $sort_asc);
        $existGroup->gwords = $mergeWords;

        $addedWords = StrTool::toWordArray($existGroup->gwords);
        $newAddedWords = count($addedWords) - count($originWords);

        $new_gcontent = $frequency_result['new_gcontent'];
        $new_gcontent_count = $frequency_result['new_gcontent_count'];
        $existGroup->gcontent = $new_gcontent;
        $existGroup->words_frequency = $frequency_result['frequency'];
        if (!$gname && !$existGroup->gname) {
            $gname = StrTool::genGnameByTimeAndUUID();
            $existGroup->gname = $gname;
        }
        $existGroup->save();
        $personalDict = PDAPublic::addPersonDictionaries($mergeWords, $sort_frequency, $query_soft_delete);
        $did = $personalDict['id'];
        $personal_words = $personalDict['data'];
        $personal_lenght = $personalDict['count'];

        $message = $isNewGroup ? 'create new group ' . $gname : 'append words to group ' . $gname;
        // $personal_words = PDQBasePublic::queryPersonalDictionary(false);
        $include_personal_words = ArrTool::filterByKeys($personal_words, $request_words);
        $include_personal_words_count = count($include_personal_words);

        $sortedIncludePersonalWords = ArrTool::sortNestedObject($include_personal_words, $sort_by, $sort_asc);
        $data = [
            'gid' => $existGroup->gid,
            "uid" => $uid,
            'did' => $did,
            'gname' => $existGroup->gname,
            "request_gname" => $gname,
            'new_words' => $newAddedWords,
            'created_at' => $existGroup->created_at,
            'updated_at' => $existGroup->updated_at,
            'words_frequency_count' => count($existGroup->words_frequency),
            'gwords_count' => StrTool::wordCount($existGroup->gwords),
            'gcontent_count' => $new_gcontent_count,
            'total_words' => count($existGroup->gwords),
            'personal_lenght' => $personal_lenght,
            'personal_query_soft_delete' => $personalDict["query_soft_delete"],
            'fetch_gcontent' => $isGetGcontent,
            'fetch_personal_words' => $isGetPersonalWords,
            'fetch_words_frequency' => $isGetWordsFrequency,
            'fetch_gwords' => $isGetGwords,
            'sort_by' => $sort_by,
            'sort_asc' => $sort_asc,
            "sort_frequency" => $personalDict["sort_frequency"],
            "include_personal_words_count" => $include_personal_words_count,
            "include_personal_words" => $sortedIncludePersonalWords,
            'personal_words' => $isGetPersonalWords ? $personal_words : null,
            'words_frequency' => $isGetWordsFrequency ? $existGroup->words_frequency : null,
            'gwords' => $isGetGwords ? $existGroup->gwords : null,
            'gcontent' => $isGetGcontent ? $existGroup->gcontent : null,
        ];
        return [
            'status' => $status,
            'supported_params' => $supported_params,
            'message' => $message,
            'data' => $data,
            'code' => $code,
        ];
    }

}

