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


namespace App\Apps\DictV1\Controllers\DictV1Dictionaries;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Apps\DictV1\DictV1Models\DictV1DictionaryModel;

class DictV1DictionaryQueryController extends BaseController
{
    /**
     * Find dictionary entries that don't exist from a provided list
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function findNonExistingEntries(Request $request)
    {
        // Validate request
        $validator = Validator::make($request->all(), [
            'content' => 'required_without:contents',
            'contents' => 'required_without:content|array',
            'delimiter' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $contents = [];
            
            // Handle either a string with delimiter or an array of contents
            if ($request->has('content')) {
                $delimiter = $request->input('delimiter', ',');
                $contentStr = $request->input('content');
                
                // Split the content string by delimiter and trim whitespace
                $contents = array_map('trim', explode($delimiter, $contentStr));
                // Remove empty values
                $contents = array_filter($contents, function($value) {
                    return $value !== '';
                });
                // Re-index array
                $contents = array_values($contents);
            } elseif ($request->has('contents')) {
                $contents = $request->input('contents');
            }
            
            // If no contents to process, return early
            if (empty($contents)) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'No contents to process',
                    'missing_entries' => [],
                    'all_records' => 0,
                    'has_translation' => 0,
                    'has_voice' => 0
                ]);
            }
            
            // Use the Dictionary model to find missing entries
            $missingEntries = Dictionary::findMissingEntries($contents);
            $allRecords = Dictionary::countAll();
            $hasTranslation = Dictionary::countByTranslation();
            $hasVoice = Dictionary::countHasVoice();
            
            return response()->json([
                'status' => 'success',
                'message' => count($missingEntries) . ' entries not found in dictionary',
                'total_checked' => count($contents),
                'existing_count' => count($contents) - count($missingEntries),
                'missing_count' => count($missingEntries),
                'missing_entries' => $missingEntries,
                'all_records' => $allRecords,
                'has_translation' => $hasTranslation,
                'has_voice' => $hasVoice
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to process dictionary query',
                'error' => $e->getMessage(),
                'all_records' => $allRecords,
                'has_translation' => $hasTranslation,
                'has_voice' => $hasVoice
            ], 500);
        }
    }
}
