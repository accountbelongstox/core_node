<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Utils\StrTool;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Traits\ApiResponse;

class AppQyV1DictionaryManagementController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    /**
     * Add a new dictionary entry or multiple entries
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function addDictionary(Request $request)
    {
        // Validate request
        $validator = Validator::make($request->all(), [
            'content' => 'required|string',
            'translation' => 'nullable|json',
            'isTranslation' => 'nullable|boolean',
            'translation_provider' => 'nullable|integer',
            'usPhonetic' => 'nullable|string',
            'ukPhonetic' => 'nullable|string',
            'voice_files' => 'nullable|json',
            'image_files' => 'nullable|json',
            'isExistLocal' => 'nullable|boolean',
            'voice_files_provider' => 'nullable|integer',
            'image_files_provider' => 'nullable|integer',
            'hasOperations' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

            // Prepare data
            $content = $request->input('content');
            
            // Check if entry already exists
            $existingEntry = AppQyV1DictionaryModel::findByContent($content);
                
            if ($existingEntry) {
                // Update the query count and query time
                $existingEntry->incrementQueryCount();
                    
                return response()->json([
                    'status' => 'success',
                    'message' => 'Dictionary entry already exists, query count updated',
                    'data' => $existingEntry
                ]);
            }
            
            // Create new entry
            $dictionary = new AppQyV1DictionaryModel();
            $dictionary->content = $content;
            $dictionary->md5 = md5($content);
            $dictionary->translation = $request->input('translation', '{}');
            $dictionary->isTranslation = $request->input('isTranslation', false);
            $dictionary->translation_provider = $request->input('translation_provider', 0);
            $dictionary->usPhonetic = $request->input('usPhonetic');
            $dictionary->ukPhonetic = $request->input('ukPhonetic');
            $dictionary->voice_files = $request->input('voice_files', '{}');
            $dictionary->image_files = $request->input('image_files', '{}');
            $dictionary->isExistLocal = $request->input('isExistLocal', false);
            $dictionary->voice_files_provider = $request->input('voice_files_provider', 0);
            $dictionary->image_files_provider = $request->input('image_files_provider', 0);
            $dictionary->hasOperations = $request->input('hasOperations', true);
            $dictionary->queryCount = 1;
            $dictionary->lastModified = now();
            $dictionary->lastInsertTime = now();
            $dictionary->lastUpdateTime = now();
            $dictionary->lastQueryTime = now();
            $dictionary->createdAt = now();
            $dictionary->save();
            
            return response()->json([
                'status' => 'success',
                'message' => 'Dictionary entry added successfully',
                'id' => $dictionary->id
            ]);
            
    }
    
    /**
     * Add multiple dictionary entries from a list
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function addDictionaryList(Request $request)
    {
        // Validate request
        $validator = Validator::make($request->all(), [
            'entries' => 'required|array',
            'entries.*.content' => 'required|string',
            'entries.*.translation' => 'nullable|json',
            'entries.*.isTranslation' => 'nullable|boolean',
            'entries.*.translation_provider' => 'nullable|integer',
            'entries.*.usPhonetic' => 'nullable|string',
            'entries.*.ukPhonetic' => 'nullable|string',
            'entries.*.voice_files' => 'nullable|json',
            'entries.*.image_files' => 'nullable|json',
            'entries.*.isExistLocal' => 'nullable|boolean',
            'entries.*.voice_files_provider' => 'nullable|integer',
            'entries.*.image_files_provider' => 'nullable|integer',
            'entries.*.hasOperations' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

            // Local variable declarations
            $entries = $request->input('entries');
            $results = [];
            $allContents = [];
            $existingByContent = [];
            $existingEntries = null;
            $existingEntry = null;
            $updateContents = [];
            $insertRows = [];
            $insertMd5s = [];
            $now = null;
            $entry = null;
            $content = null;
            $md5 = null;
            $insertedById = [];
            $insertedRows = null;
            $row = null;
            $resultIndex = null;
            $pendingCreated = [];

            DB::beginTransaction();

            // Collect the distinct content list for a single batched existence lookup.
            foreach ($entries as $entry) {
                $content = $entry['content'];
                if (!isset($allContents[$content])) {
                    $allContents[$content] = true;
                }
            }

            // Batch 1: ONE whereIn over all contents instead of N findByContent() calls.
            $existingEntries = AppQyV1DictionaryModel::whereIn('content', array_keys($allContents))->get();
            foreach ($existingEntries as $existingEntry) {
                $existingByContent[$existingEntry->content] = $existingEntry;
            }

            // Build the insert payload and the result list in the SAME input order as
            // the original loop, interleaving updated/created entries exactly.
            $now = now();
            foreach ($entries as $entry) {
                $content = $entry['content'];
                $md5 = md5($content);

                if (isset($existingByContent[$content])) {
                    $existingEntry = $existingByContent[$content];

                    // Defer the increment to a single batched query below; report
                    // the same shape as the original per-item path.
                    if (!isset($updateContents[$content])) {
                        $updateContents[$content] = true;
                    }

                    $results[] = [
                        'content' => $content,
                        'status' => 'updated',
                        'id' => $existingEntry->id
                    ];

                    continue;
                }

                // Reserve this result slot in input order; the id is filled in after
                // the bulk insert resolves the generated primary keys.
                $resultIndex = count($results);
                $results[] = [
                    'content' => $content,
                    'status' => 'created',
                    'id' => null
                ];
                $pendingCreated[] = ['index' => $resultIndex, 'md5' => $md5];

                // Guard against duplicate contents within the same request payload so
                // we do not attempt to insert the same md5 twice. The result slot is
                // still emitted (matching the original per-item loop behavior).
                if (isset($insertMd5s[$md5])) {
                    continue;
                }
                $insertMd5s[$md5] = true;

                // Build a raw row. JSON columns must be json_encode()d to match the
                // Eloquent json-cast bytes the original save() produced (a '{}' string
                // literal is encoded to '"{}"', an array is encoded to its JSON form).
                $insertRows[] = [
                    'content' => $content,
                    'md5' => $md5,
                    'translation' => json_encode(isset($entry['translation']) ? $entry['translation'] : '{}'),
                    'isTranslation' => isset($entry['isTranslation']) ? (bool) $entry['isTranslation'] : false,
                    'translation_provider' => isset($entry['translation_provider']) ? $entry['translation_provider'] : 0,
                    'usPhonetic' => isset($entry['usPhonetic']) ? $entry['usPhonetic'] : null,
                    'ukPhonetic' => isset($entry['ukPhonetic']) ? $entry['ukPhonetic'] : null,
                    'voice_files' => json_encode(isset($entry['voice_files']) ? $entry['voice_files'] : '{}'),
                    'image_files' => json_encode(isset($entry['image_files']) ? $entry['image_files'] : '{}'),
                    'isExistLocal' => isset($entry['isExistLocal']) ? (bool) $entry['isExistLocal'] : false,
                    'voice_files_provider' => isset($entry['voice_files_provider']) ? $entry['voice_files_provider'] : 0,
                    'image_files_provider' => isset($entry['image_files_provider']) ? $entry['image_files_provider'] : 0,
                    'hasOperations' => isset($entry['hasOperations']) ? (bool) $entry['hasOperations'] : true,
                    'queryCount' => 1,
                    'lastModified' => $now,
                    'lastInsertTime' => $now,
                    'lastUpdateTime' => $now,
                    'lastQueryTime' => $now,
                    'createdAt' => $now,
                    // Eloquent save() auto-fills these via the model timestamps; raw
                    // insert must set them explicitly to match.
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // Batch 2: ONE increment over all existing contents (same +1 delta and
            // lastQueryTime/updated_at touch as incrementQueryCount() did per row).
            if (!empty($updateContents)) {
                AppQyV1DictionaryModel::whereIn('content', array_keys($updateContents))
                    ->increment('queryCount', 1, [
                        'lastQueryTime' => $now,
                        'updated_at' => $now
                    ]);
            }

            // Batch 3: ONE race-safe insertOrIgnore for all new entries, then ONE
            // whereIn to resolve the generated ids for per-item result reporting.
            if (!empty($insertRows)) {
                AppQyV1DictionaryModel::insertOrIgnore($insertRows);

                $insertedRows = AppQyV1DictionaryModel::whereIn('md5', array_keys($insertMd5s))
                    ->select('id', 'md5')
                    ->get();
                foreach ($insertedRows as $row) {
                    $insertedById[$row->md5] = $row->id;
                }

                // Fill the reserved 'created' result slots in their original order.
                foreach ($pendingCreated as $row) {
                    if (isset($insertedById[$row['md5']])) {
                        $results[$row['index']]['id'] = $insertedById[$row['md5']];
                    }
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => count($results) . ' dictionary entries processed',
                'results' => $results
            ]);

    }

    /**
     * Filter out existing dictionary entries and only add new ones
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function filterAndAddDictionaryList(Request $request)
    {
        // Validate request
        $validator = Validator::make($request->all(), [
            'entries' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

            // Local variable declarations
            $entries = $request->input('entries');
            $allContents = [];
            $allMd5s = [];
            $existingEntries = null;
            $dictionariesRecoredCount = 0;
            $existingMd5s = [];
            $existingMd5Lookup = [];
            $newEntries = [];
            $existingCount = 0;
            $existingDetails = [];
            $existingEntry = null;
            $entry = null;
            $md5 = null;
            $content = null;
            $results = [];
            $updateCounts = [];
            $insertRows = [];
            $insertMd5s = [];
            $now = null;
            $insertedById = [];
            $insertedRows = null;
            $row = null;

            // Extract all contents from the entries
            $allContents = array_column($entries, 'content');
            $allMd5s = array_map('md5', $allContents);

            // Find existing entries by MD5 hashes
            $existingEntries = AppQyV1DictionaryModel::whereIn('md5', $allMd5s)
                ->select('id', 'content', 'md5', 'queryCount')
                ->get();
            $dictionariesRecoredCount = AppQyV1DictionaryModel::count();
            $existingMd5s = $existingEntries->pluck('md5')->toArray();

            // Create a lookup array for faster checking
            $existingMd5Lookup = array_flip($existingMd5s);

            // Filter entries to only include new ones. Per-md5 increments are tallied
            // here (one per occurrence) and applied in a single batched pass below,
            // preserving the original total increment amount per existing row.
            foreach ($entries as $entry) {
                $md5 = md5($entry['content']);

                if (isset($existingMd5Lookup[$md5])) {
                    // Tally one increment per occurrence (same as the per-item
                    // increment('queryCount', 1) the original ran inside the loop).
                    if (!isset($updateCounts[$md5])) {
                        $updateCounts[$md5] = 0;
                    }
                    $updateCounts[$md5]++;

                    // Find the existing entry details
                    $existingEntry = $existingEntries->firstWhere('md5', $md5);
                    if ($existingEntry) {
                        $existingDetails[] = [
                            'content' => $entry['content'],
                            'id' => $existingEntry->id,
                            'queryCount' => $existingEntry->queryCount + 1 // Add 1 to reflect the increment
                        ];
                    }

                    $existingCount++;
                } else {
                    $newEntries[] = $entry;
                }
            }

            // Batched increments: one query per distinct existing md5 (was one query
            // per occurrence). The delta equals the number of occurrences, matching
            // the cumulative effect of the original per-item increments.
            if (!empty($updateCounts)) {
                $now = now();
                foreach ($updateCounts as $md5 => $count) {
                    AppQyV1DictionaryModel::where('md5', $md5)
                        ->increment('queryCount', $count, [
                            'lastQueryTime' => $now,
                            'updated_at' => $now
                        ]);
                }
            }

            // Only proceed with DB transaction if there are new entries
            if (!empty($newEntries)) {
                DB::beginTransaction();

                $now = now();

                // Build the bulk insert payload, deduping by md5 so insertOrIgnore
                // writes each new word once (race-safe). Result rows are still emitted
                // once per new-entry occurrence to preserve the original count shape.
                foreach ($newEntries as $entry) {
                    $content = $entry['content'];
                    $md5 = md5($content);

                    if (isset($insertMd5s[$md5])) {
                        continue;
                    }
                    $insertMd5s[$md5] = true;

                    // JSON columns must be json_encode()d to match the Eloquent
                    // json-cast bytes the original save() produced.
                    $insertRows[] = [
                        'content' => $content,
                        'md5' => $md5,
                        'translation' => json_encode(isset($entry['translation']) ? $entry['translation'] : '{}'),
                        'isTranslation' => isset($entry['isTranslation']) ? (bool) $entry['isTranslation'] : false,
                        'translation_provider' => isset($entry['translation_provider']) ? $entry['translation_provider'] : 0,
                        'usPhonetic' => isset($entry['usPhonetic']) ? $entry['usPhonetic'] : null,
                        'ukPhonetic' => isset($entry['ukPhonetic']) ? $entry['ukPhonetic'] : null,
                        'voice_files' => json_encode(isset($entry['voice_files']) ? $entry['voice_files'] : '{}'),
                        'image_files' => json_encode(isset($entry['image_files']) ? $entry['image_files'] : '{}'),
                        'isExistLocal' => isset($entry['isExistLocal']) ? (bool) $entry['isExistLocal'] : false,
                        'voice_files_provider' => isset($entry['voice_files_provider']) ? $entry['voice_files_provider'] : 0,
                        'image_files_provider' => isset($entry['image_files_provider']) ? $entry['image_files_provider'] : 0,
                        'hasOperations' => isset($entry['hasOperations']) ? (bool) $entry['hasOperations'] : true,
                        'queryCount' => 1,
                        'lastModified' => $now,
                        'lastInsertTime' => $now,
                        'lastUpdateTime' => $now,
                        'lastQueryTime' => $now,
                        'createdAt' => $now,
                        // Eloquent save() auto-fills these via the model timestamps;
                        // raw insert must set them explicitly to match.
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                // ONE race-safe bulk insert, then ONE whereIn to resolve generated ids.
                AppQyV1DictionaryModel::insertOrIgnore($insertRows);

                $insertedRows = AppQyV1DictionaryModel::whereIn('md5', array_keys($insertMd5s))
                    ->select('id', 'md5')
                    ->get();
                foreach ($insertedRows as $row) {
                    $insertedById[$row->md5] = $row->id;
                }

                // Emit one created result per new-entry occurrence, preserving order
                // and the original new_added count.
                foreach ($newEntries as $entry) {
                    $content = $entry['content'];
                    $md5 = md5($content);
                    $results[] = [
                        'content' => $content,
                        'status' => 'created',
                        'id' => isset($insertedById[$md5]) ? $insertedById[$md5] : null
                    ];
                }

                DB::commit();
            }

            // Format the response according to the required structure
            return response()->json([
                'status' => 'success',
                'add_success' => count($results) > 0,
                'filter_count' => $existingCount,
                'ext' => [
                    'total_recored' => $dictionariesRecoredCount,
                    'total_processed' => count($entries),
                    'new_added' => count($results),
                    "filtered_count" => count($existingDetails)
                ]
            ]);
    }
}

