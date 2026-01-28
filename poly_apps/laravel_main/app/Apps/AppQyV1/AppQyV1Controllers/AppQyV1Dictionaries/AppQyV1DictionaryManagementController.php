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

            $entries = $request->input('entries');
            $results = [];
            
            DB::beginTransaction();
            
            foreach ($entries as $entry) {
                $content = $entry['content'];
                
                // Check if entry already exists
                $existingEntry = AppQyV1DictionaryModel::findByContent($content);
                    
                if ($existingEntry) {
                    // Update the query count and query time
                    $existingEntry->incrementQueryCount();
                        
                    $results[] = [
                        'content' => $content,
                        'status' => 'updated',
                        'id' => $existingEntry->id
                    ];
                    
                    continue;
                }
                
                // Create new entry
                $dictionary = new AppQyV1DictionaryModel();
                $dictionary->content = $content;
                $dictionary->md5 = md5($content);
                $dictionary->translation = '{}';
                if (isset($entry['translation'])) {
                    $dictionary->translation = $entry['translation'];
                }
                $dictionary->isTranslation = false;
                if (isset($entry['isTranslation'])) {
                    $dictionary->isTranslation = $entry['isTranslation'];
                }
                $dictionary->translation_provider = 0;
                if (isset($entry['translation_provider'])) {
                    $dictionary->translation_provider = $entry['translation_provider'];
                }
                $dictionary->usPhonetic = null;
                if (isset($entry['usPhonetic'])) {
                    $dictionary->usPhonetic = $entry['usPhonetic'];
                }
                $dictionary->ukPhonetic = null;
                if (isset($entry['ukPhonetic'])) {
                    $dictionary->ukPhonetic = $entry['ukPhonetic'];
                }
                $dictionary->voice_files = '{}';
                if (isset($entry['voice_files'])) {
                    $dictionary->voice_files = $entry['voice_files'];
                }
                $dictionary->image_files = '{}';
                if (isset($entry['image_files'])) {
                    $dictionary->image_files = $entry['image_files'];
                }
                $dictionary->isExistLocal = false;
                if (isset($entry['isExistLocal'])) {
                    $dictionary->isExistLocal = $entry['isExistLocal'];
                }
                $dictionary->voice_files_provider = 0;
                if (isset($entry['voice_files_provider'])) {
                    $dictionary->voice_files_provider = $entry['voice_files_provider'];
                }
                $dictionary->image_files_provider = 0;
                if (isset($entry['image_files_provider'])) {
                    $dictionary->image_files_provider = $entry['image_files_provider'];
                }
                $dictionary->hasOperations = true;
                if (isset($entry['hasOperations'])) {
                    $dictionary->hasOperations = $entry['hasOperations'];
                }
                $dictionary->queryCount = 1;
                $dictionary->lastModified = now();
                $dictionary->lastInsertTime = now();
                $dictionary->lastUpdateTime = now();
                $dictionary->lastQueryTime = now();
                $dictionary->createdAt = now();
                $dictionary->save();
                
                $results[] = [
                    'content' => $content,
                    'status' => 'created',
                    'id' => $dictionary->id
                ];
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

            $entries = $request->input('entries');
            
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
            
            // Filter entries to only include new ones
            $newEntries = [];
            $existingCount = 0;
            $existingDetails = [];
            
            foreach ($entries as $entry) {
                $md5 = md5($entry['content']);
                
                if (isset($existingMd5Lookup[$md5])) {
                    // Update query count for existing entries
                    AppQyV1DictionaryModel::where('md5', $md5)
                        ->increment('queryCount', 1, [
                            'lastQueryTime' => now(),
                            'updated_at' => now()
                        ]);
                    
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
            
            // Only proceed with DB transaction if there are new entries
            $results = [];
            
            if (!empty($newEntries)) {
                DB::beginTransaction();

                foreach ($newEntries as $entry) {
                        $content = $entry['content'];
                        $md5 = md5($content);
                        
                        // Create new entry
                        $dictionary = new AppQyV1DictionaryModel();
                        $dictionary->content = $content;
                        $dictionary->md5 = $md5;
                        $dictionary->translation = '{}';
                        if (isset($entry['translation'])) {
                            $dictionary->translation = $entry['translation'];
                        }
                        $dictionary->isTranslation = false;
                        if (isset($entry['isTranslation'])) {
                            $dictionary->isTranslation = $entry['isTranslation'];
                        }
                        $dictionary->translation_provider = 0;
                        if (isset($entry['translation_provider'])) {
                            $dictionary->translation_provider = $entry['translation_provider'];
                        }
                        $dictionary->usPhonetic = null;
                        if (isset($entry['usPhonetic'])) {
                            $dictionary->usPhonetic = $entry['usPhonetic'];
                        }
                        $dictionary->ukPhonetic = null;
                        if (isset($entry['ukPhonetic'])) {
                            $dictionary->ukPhonetic = $entry['ukPhonetic'];
                        }
                        $dictionary->voice_files = '{}';
                        if (isset($entry['voice_files'])) {
                            $dictionary->voice_files = $entry['voice_files'];
                        }
                        $dictionary->image_files = '{}';
                        if (isset($entry['image_files'])) {
                            $dictionary->image_files = $entry['image_files'];
                        }
                        $dictionary->isExistLocal = false;
                        if (isset($entry['isExistLocal'])) {
                            $dictionary->isExistLocal = $entry['isExistLocal'];
                        }
                        $dictionary->voice_files_provider = 0;
                        if (isset($entry['voice_files_provider'])) {
                            $dictionary->voice_files_provider = $entry['voice_files_provider'];
                        }
                        $dictionary->image_files_provider = 0;
                        if (isset($entry['image_files_provider'])) {
                            $dictionary->image_files_provider = $entry['image_files_provider'];
                        }
                        $dictionary->hasOperations = true;
                        if (isset($entry['hasOperations'])) {
                            $dictionary->hasOperations = $entry['hasOperations'];
                        }
                        $dictionary->queryCount = 1;
                        $dictionary->lastModified = now();
                        $dictionary->lastInsertTime = now();
                        $dictionary->lastUpdateTime = now();
                        $dictionary->lastQueryTime = now();
                        $dictionary->createdAt = now();
                        $dictionary->save();
                        
                        $results[] = [
                            'content' => $content,
                            'status' => 'created',
                            'id' => $dictionary->id
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

