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


namespace App\Apps\DictV1\Controllers\DictV1Group;
use Illuminate\Http\Request;
use App\Apps\DictV1\DictV1Models\DictV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1PersonalDictionaryPublicController as PDAPublic;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1WordGroupPublicController as DGroupAPublic;
class DictV1WordGroupCreationController 
{
   
    public function appendWordToGroup($gwords, $group)
    {
        if (empty($gwords)) {
            $gwords = StrTool::extractWords($group->gcontent);
        }
        $originWords = StrTool::toWordArray($group->gwords);
        $newWords = StrTool::toWordArray($gwords);
        $mergeWords = ArrTool::mergeUniqueIgnoreString($originWords, $newWords);
        $group->gwords = $mergeWords;
        return $mergeWords;
    }

    public function countFrequency($group,$gcontent,$gwords)
    {
        $new_gcontent = StrTool::combineIfNotIncluded($group->gcontent, $gcontent,$join_sep);
        $result = implode("\n", $gwords);
        $frequency_content = $new_gcontent . "\n" . $result;
        $result = StrTool::toWordFrequencyArray($frequency_content);
        $words_frequency = $result['frequency'];
        $new_words = $result['words'];
        $new_gcontent_count = strlen($new_gcontent);
        return[
            'frequency' => $words_frequency,
            'new_words' => $new_words,
            'new_gcontent' => $new_gcontent,
            'new_gcontent_count' => $new_gcontent_count,
        ];
    }

    /**
     * Create a new dictionary group
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createDictGroup(Request $request)
    {
        $supported_params = ['gname', 'gcontent', 'gwords','sort'];
        try {
            $validator = Validator::make($request->all(), [
                'gname' => 'required|string|max:255',
                'gcontent' => 'required|string',
                'gwords' => 'nullable|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'errors' => $validator->errors(),
                    'supported_params' => $supported_params,
                ], 422);
            }
            
            $username = Auth::user()->username;

            $gname = $request->input('gname');
            $gcontent = $request->input('gcontent');
            $gwords = $request->input('gwords');
            $sort = $request->input('sort') ?? true;
            $existGroupResult = DGroupAPublic::isGroupNameExist($gname);
            $existGroup = $existGroupResult['group'];
            $isNewGroup = $existGroupResult['isNewGroup'];

            $newWords = StrTool::toWordArray($gwords);
            $originWords = StrTool::toWordArray($existGroup->gwords);
            $mergeWords = $this->appendWordToGroup($newWords, $existGroup);
            $addedWords = StrTool::toWordArray($existGroup->gwords);
            $newAddedWords = count($addedWords) - count($originWords);
            $frequency_result = $this->countFrequency($existGroup, $gcontent, $newWords);
            
            $new_gcontent = $frequency_result['new_gcontent'];
            $new_gcontent_count = $frequency_result['new_gcontent_count'];
            $existGroup->gcontent = $new_gcontent;
            $existGroup->username = $username;  
            $words_frequency = $frequency_result['frequency'];
            if($sort == true){
                asort($words_frequency);
            }
            $existGroup->words_frequency = $words_frequency;
            $existGroup->save();

            $result = PDAPublic::addPersonDictionaries($mergeWords);
            $did = $result['id'];

            $message = $isNewGroup ? 'create new group ' . $gname : 'append words to group ' . $gname;
            return response()->json([
                'status' => 'success',
                'supported_params' => $supported_params,
                'message' => $message,
                'data' => [
                    'gid' => $existGroup->gid,
                    'uid' => $existGroup->uid,
                    'did' => $did,
                    'gname' => $gname,
                    'new_words' => $newAddedWords,
                    'created_at' => $existGroup->created_at,
                    'updated_at' => $existGroup->updated_at,
                    'words_frequency_count' => count($existGroup->words_frequency),
                    'words_frequency' => $existGroup->words_frequency,
                    'gwords_count' => StrTool::wordCount($existGroup->gwords),
                    'gcontent_count' => $new_gcontent_count,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to create dictionary group',
                'error' => $e->getMessage(),
                'supported_params' => $supported_params,
            ], 500);
        }
    }

}
