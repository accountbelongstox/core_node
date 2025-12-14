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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use Illuminate\Routing\Controller as BaseController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
class AppQyV1WordQueryController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    protected $storageManager;
    protected $markerManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
        $this->markerManager = new AppQyV1InitializationMarkerManager();
    }
    /**
     * Check if a word exists in the dictionary
     * Reference: DevOps http_controller/word_query.js
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function wordExists(Request $request)
    {
        // Check initialization first
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required. Please run /initialize endpoint first.',
                'initialization_status' => $this->markerManager->getAllMarkersStatus()
            ], 503);
        }

        $word = $request->input('word');
        
        if (!$word) {
            return response()->json([
                'exists' => false,
                'message' => 'No word provided'
            ]);
        }
        
        $dictionary = AppQyV1DictionaryModel::findByContent($word);
        
        if ($dictionary) {
            // Update the query count
            $dictionary->incrementQueryCount();
            
            // Convert the dictionary to an array and decode JSON fields
            $dictionaryData = $dictionary->toArray();
            
            // Remove ID field
            unset($dictionaryData['id']);
            
            // Ensure translation is properly decoded if it's not already
            if (is_string($dictionaryData['translation'])) {
                $dictionaryData['translation'] = json_decode($dictionaryData['translation'], true);
            }
            
            return response()->json([
                'exists' => true,
                'word' => $word,
                'data' => $dictionaryData
            ]);
        }
        
        return response()->json([
            'exists' => false,
            'word' => $word
        ]);
    }

    /**
     * Enhanced word query with audio and image files
     * Reference: DevOps http_controller/word_query.js, basetool/voice_tool/search_voice.js
     *
     * @param Request|string $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function queryWordEnhanced($request)
    {
        // Check initialization first
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required. Please run /initialize endpoint first.',
                'initialization_status' => $this->markerManager->getAllMarkersStatus()
            ], 503);
        }

        if (is_string($request)) {
            $word = $request;
        } else {
            $word = $request->input('word');
        }

        if (!$word) {
            return response()->json([
                'status' => 'error',
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1DictionaryModel::findByContent($word);

        if (!$dictionary) {
            return response()->json([
                'status' => 'not_found',
                'word' => $word,
                'message' => 'Word not found in dictionary'
            ]);
        }

        // Update query count
        $dictionary->incrementQueryCount();

        // Get dictionary data
        $dictionaryData = $dictionary->toArray();
        unset($dictionaryData['id']);

        // Decode JSON fields
        if (is_string($dictionaryData['translation'])) {
            $dictionaryData['translation'] = json_decode($dictionaryData['translation'], true);
        }
        if (is_string($dictionaryData['voice_files'])) {
            $dictionaryData['voice_files'] = json_decode($dictionaryData['voice_files'], true);
        }
        if (is_string($dictionaryData['image_files'])) {
            $dictionaryData['image_files'] = json_decode($dictionaryData['image_files'], true);
        }

        // Find audio files from external storage
        // Reference: DevOps basetool/voice_tool/search_voice.js
        $audioFile = $this->storageManager->findAudioFile($word);
        $audioUrls = [];
        if ($audioFile) {
            $audioUrls['word'] = $this->storageManager->getFileUrl($audioFile);
        }

        // Find image files from external storage
        $imageFiles = $this->storageManager->findImageFiles($word);
        $imageUrls = [];
        foreach ($imageFiles as $imageFile) {
            $imageUrls[] = $this->storageManager->getFileUrl($imageFile);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'word' => $word,
                'translation' => $dictionaryData['translation'],
                'phonetic' => [
                    'us' => $dictionaryData['usPhonetic'],
                    'uk' => $dictionaryData['ukPhonetic']
                ],
                'audio' => $audioUrls,
                'images' => $imageUrls,
                'metadata' => [
                    'last_updated' => $dictionaryData['lastUpdateTime'],
                    'query_count' => $dictionaryData['queryCount'],
                    'source' => 'database',
                    'has_local_files' => $dictionaryData['isExistLocal']
                ],
                'raw_data' => $dictionaryData
            ]
        ]);
    }
    /**
     * Check if a word exists by URL path parameter
     *
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkWord(Request | string $request )
    {
        if(is_string($request)){
            $word = $request;
        }else{
            $word = $request->input('word');
        }

        if (!$word) {
            return response()->json([
                'exists' => false,
                'message' => 'No word provided'
            ]);
        }
        
        $dictionary = AppQyV1DictionaryModel::findByContent($word);
        
        if ($dictionary) {
            // Update the query count
            $dictionary->incrementQueryCount();
            
            // Convert the dictionary to an array and decode JSON fields
            $dictionaryData = $dictionary->toArray();
            
            // Remove ID field
            unset($dictionaryData['id']);
            
            // Ensure translation is properly decoded if it's not already
            if (is_string($dictionaryData['translation'])) {
                $dictionaryData['translation'] = json_decode($dictionaryData['translation'], true);
            }
            
            return response()->json([
                'exists' => true,
                'word' => $word,
                'data' => $dictionaryData
            ]);
        }
        
        return response()->json([
            'exists' => false,
            'word' => $word
        ]);
    }
    
    /**
     * Batch check multiple words
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function batchWordExists(Request $request)
    {
        $words = $request->input('words', []);
        
        if (empty($words)) {
            return response()->json([
                'message' => 'No words provided',
                'results' => []
            ]);
        }
        
        $results = [];
        
        foreach ($words as $word) {
            $dictionary = AppQyV1DictionaryModel::findByContent($word);
            
            if ($dictionary) {
                // Update query count
                $dictionary->incrementQueryCount();
                
                // Get dictionary data
                $dictionaryData = $dictionary->toArray();
                
                // Remove ID field
                unset($dictionaryData['id']);
                
                // Ensure translation is properly decoded if it's not already
                if (is_string($dictionaryData['translation'])) {
                    $dictionaryData['translation'] = json_decode($dictionaryData['translation'], true);
                }
                
                $results[] = [
                    'word' => $word,
                    'exists' => true,
                    'data' => $dictionaryData
                ];
            } else {
                $results[] = [
                    'word' => $word,
                    'exists' => false
                ];
            }
        }
        
        return response()->json([
            'results' => $results
        ]);
    }
} 
