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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1FindNonExistingEntriesRequest;
use App\Traits\ApiResponse;

class AppQyV1DictionaryQueryController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    /**
     * Find dictionary entries that don't exist from a provided list
     */
    public function findNonExistingEntries(AppQyV1FindNonExistingEntriesRequest $request): JsonResponse
    {
        $contents = [];

        // Handle either a string with delimiter or an array of contents
        if ($request->has('content')) {
            $delimiter = $request->input('delimiter', ',');
            $contentStr = $request->input('content');

            // Split the content string by delimiter and trim whitespace
            $contents = array_map('trim', explode($delimiter, $contentStr));
            // Remove empty values
            $contents = array_filter($contents, function ($value) {
                return $value !== '';
            });
            // Re-index array
            $contents = array_values($contents);
        } elseif ($request->has('contents')) {
            $contents = $request->input('contents');
        }

        // If no contents to process, return early
        if (empty($contents)) {
            return $this->success([
                'missing_entries' => [],
                'all_records' => 0,
                'has_translation' => 0,
                'has_voice' => 0,
            ], 'No contents to process');
        }

        // Use the Dictionary model to find missing entries
        $missingEntries = AppQyV1DictionaryModel::findMissingEntries($contents);
        $allRecords = AppQyV1DictionaryModel::countAll();
        $hasTranslation = AppQyV1DictionaryModel::countByTranslation();
        $hasVoice = AppQyV1DictionaryModel::countHasVoice();

        return $this->success([
            'total_checked' => count($contents),
            'existing_count' => count($contents) - count($missingEntries),
            'missing_count' => count($missingEntries),
            'missing_entries' => $missingEntries,
            'all_records' => $allRecords,
            'has_translation' => $hasTranslation,
            'has_voice' => $hasVoice,
        ], count($missingEntries) . ' entries not found in dictionary');
    }
}

