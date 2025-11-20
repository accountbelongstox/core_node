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

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordSubmit;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;

/**
 * Word Data Submission Controller
 * Reference: DevOps http_controller/sync_audio.js, middware/middb/wordInsert.js, wordUpdate.js
 */
class AppQyV1WordDataSubmissionController extends BaseController
{
    protected $storageManager;
    protected $markerManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
        $this->markerManager = new AppQyV1InitializationMarkerManager();
    }

    /**
     * Submit translation data for a word
     * Reference: DevOps middware/middb/wordInsert.js, basetool/db-tool/trans_item_tool.js
     *
     * @param Request $request
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitTranslation(Request $request, string $word)
    {
        // Check initialization
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required'
            ], 503);
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'translation' => 'required|string|max:10000',
            'phonetic' => 'nullable|string|max:500',
            'us_phonetic' => 'nullable|string|max:500',
            'uk_phonetic' => 'nullable|string|max:500',
            'definition' => 'nullable|string|max:10000',
            'source' => 'nullable|string|in:manual,api,ai_generated',
            'provider_id' => 'nullable|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Find or create word entry
            $dictionary = AppQyV1DictionaryModel::findByContent($word);
            
            if (!$dictionary) {
                $dictionary = new AppQyV1DictionaryModel();
                $dictionary->content = $word;
                $dictionary->md5 = md5($word);
                $dictionary->queryCount = 1;
                $dictionary->lastInsertTime = now();
                $dictionary->createdAt = now();
            }

            // Process translation data
            // Reference: DevOps basetool/db-tool/trans_item_tool.js processing logic
            $translationData = [
                'text' => $request->input('translation'),
                'definition' => $request->input('definition', ''),
                'source' => $request->input('source', 'manual'),
                'submitted_at' => now()->toISOString(),
                'provider_id' => $request->input('provider_id', 0)
            ];

            // Handle encoding properly (Reference: DevOps encoding.js)
            $dictionary->translation = json_encode($translationData, JSON_UNESCAPED_UNICODE);
            $dictionary->isTranslation = true;
            $dictionary->translation_provider = $request->input('provider_id', 1);

            // Update phonetic data
            if ($request->has('us_phonetic')) {
                $dictionary->usPhonetic = $request->input('us_phonetic');
            }
            if ($request->has('uk_phonetic')) {
                $dictionary->ukPhonetic = $request->input('uk_phonetic');
            }
            if ($request->has('phonetic') && !$request->has('us_phonetic') && !$request->has('uk_phonetic')) {
                $dictionary->usPhonetic = $request->input('phonetic');
            }

            // Update timestamps
            $dictionary->lastUpdateTime = now();
            $dictionary->lastModified = now();
            
            $dictionary->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Translation submitted successfully',
                'data' => [
                    'word' => $word,
                    'translation' => $translationData,
                    'phonetic' => [
                        'us' => $dictionary->usPhonetic,
                        'uk' => $dictionary->ukPhonetic
                    ],
                    'id' => $dictionary->id
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to submit translation: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit audio file for a word
     * Reference: DevOps http_controller/sync_audio.js, basetool/voice_tool/voice_tool.js
     *
     * @param Request $request
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitAudio(Request $request, string $word)
    {
        // Check initialization
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required'
            ], 503);
        }

        // Validate audio file
        $validator = Validator::make($request->all(), [
            'audio' => 'required|file|mimes:mp3,wav,ogg|max:10240', // Max 10MB
            'type' => 'nullable|string|in:word,sentence',
            'quality' => 'nullable|string|in:low,medium,high',
            'source' => 'nullable|string|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Audio validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $audioFile = $request->file('audio');
            $audioType = $request->input('type', 'word');
            $audioQuality = $request->input('quality', 'medium');
            $audioSource = $request->input('source', 'upload');

            // Validate audio file properties
            // Reference: DevOps basetool/voice_tool/check_voice.js
            $validation = $this->validateAudioFile($audioFile);
            if (!$validation['valid']) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Audio file validation failed: ' . $validation['error']
                ], 422);
            }

            // Generate filename based on DevOps voice_tool.js naming convention
            $extension = $audioFile->getClientOriginalExtension();
            $filename = $this->generateAudioFilename($word, $audioType, $extension);

            // Determine storage path
            $storagePath = $audioType === 'word' 
                ? $this->storageManager->getWordSoundsPath() 
                : $this->storageManager->getSentenceSoundsPath();

            // Ensure storage directory exists
            if (!File::exists($storagePath)) {
                File::makeDirectory($storagePath, 0755, true);
            }

            // Move file to external storage
            $fullPath = $storagePath . '/' . $filename;
            $audioFile->move($storagePath, $filename);

            // Update database record
            $dictionary = AppQyV1DictionaryModel::findByContent($word);
            if (!$dictionary) {
                $dictionary = new AppQyV1DictionaryModel();
                $dictionary->content = $word;
                $dictionary->md5 = md5($word);
                $dictionary->queryCount = 1;
                $dictionary->lastInsertTime = now();
                $dictionary->createdAt = now();
            }

            // Update voice files metadata
            $voiceFiles = $dictionary->voice_files ? json_decode($dictionary->voice_files, true) : [];
            $voiceFiles[$audioType] = [
                'filename' => $filename,
                'path' => $fullPath,
                'url' => $this->storageManager->getFileUrl($fullPath),
                'quality' => $audioQuality,
                'source' => $audioSource,
                'size' => filesize($fullPath),
                'duration' => $validation['duration'] ?? null,
                'uploaded_at' => now()->toISOString()
            ];

            $dictionary->voice_files = json_encode($voiceFiles, JSON_UNESCAPED_UNICODE);
            $dictionary->isExistLocal = true;
            $dictionary->voice_files_provider = 1; // Upload source
            $dictionary->lastUpdateTime = now();
            $dictionary->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Audio file uploaded successfully',
                'data' => [
                    'word' => $word,
                    'filename' => $filename,
                    'url' => $this->storageManager->getFileUrl($fullPath),
                    'type' => $audioType,
                    'quality' => $audioQuality,
                    'size' => filesize($fullPath)
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to upload audio: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit image files for a word
     * Reference: DevOps basetool/folder.js file operations
     *
     * @param Request $request
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitImages(Request $request, string $word)
    {
        // Check initialization
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required'
            ], 503);
        }

        // Validate image files
        $validator = Validator::make($request->all(), [
            'images' => 'required|array|max:10',
            'images.*' => 'required|file|mimes:jpg,jpeg,png,gif,webp|max:5120', // Max 5MB per image
            'descriptions' => 'nullable|array',
            'descriptions.*' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Image validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $images = $request->file('images');
            $descriptions = $request->input('descriptions', []);
            $uploadedImages = [];

            // Storage path for word images
            $storagePath = $this->storageManager->getWordImagesPath();
            
            // Ensure storage directory exists
            if (!File::exists($storagePath)) {
                File::makeDirectory($storagePath, 0755, true);
            }

            // Process each image
            foreach ($images as $index => $imageFile) {
                $extension = $imageFile->getClientOriginalExtension();
                $filename = $this->generateImageFilename($word, $index, $extension);
                $fullPath = $storagePath . '/' . $filename;

                // Move file to external storage
                $imageFile->move($storagePath, $filename);

                // Get image dimensions
                $imageInfo = getimagesize($fullPath);
                
                $uploadedImages[] = [
                    'filename' => $filename,
                    'path' => $fullPath,
                    'url' => $this->storageManager->getFileUrl($fullPath),
                    'description' => $descriptions[$index] ?? '',
                    'size' => filesize($fullPath),
                    'width' => $imageInfo[0] ?? null,
                    'height' => $imageInfo[1] ?? null,
                    'mime_type' => $imageInfo['mime'] ?? null,
                    'uploaded_at' => now()->toISOString()
                ];
            }

            // Update database record
            $dictionary = AppQyV1DictionaryModel::findByContent($word);
            if (!$dictionary) {
                $dictionary = new AppQyV1DictionaryModel();
                $dictionary->content = $word;
                $dictionary->md5 = md5($word);
                $dictionary->queryCount = 1;
                $dictionary->lastInsertTime = now();
                $dictionary->createdAt = now();
            }

            // Update image files metadata
            $imageFiles = $dictionary->image_files ? json_decode($dictionary->image_files, true) : [];
            $imageFiles = array_merge($imageFiles, $uploadedImages);

            $dictionary->image_files = json_encode($imageFiles, JSON_UNESCAPED_UNICODE);
            $dictionary->image_files_provider = 1; // Upload source
            $dictionary->lastUpdateTime = now();
            $dictionary->save();

            return response()->json([
                'status' => 'success',
                'message' => count($uploadedImages) . ' image(s) uploaded successfully',
                'data' => [
                    'word' => $word,
                    'images' => $uploadedImages,
                    'total_images' => count($imageFiles)
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to upload images: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit complete word data (translation + audio + images)
     *
     * @param Request $request
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitCompleteWordData(Request $request, string $word)
    {
        // Validate complete data
        $validator = Validator::make($request->all(), [
            'translation' => 'required|string|max:10000',
            'phonetic' => 'nullable|string|max:500',
            'us_phonetic' => 'nullable|string|max:500',
            'uk_phonetic' => 'nullable|string|max:500',
            'definition' => 'nullable|string|max:10000',
            'audio' => 'nullable|file|mimes:mp3,wav,ogg|max:10240',
            'images' => 'nullable|array|max:5',
            'images.*' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:5120'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $results = [];

            // Submit translation first
            $translationResult = $this->submitTranslation($request, $word);
            $results['translation'] = json_decode($translationResult->getContent(), true);

            // Submit audio if provided
            if ($request->hasFile('audio')) {
                $audioResult = $this->submitAudio($request, $word);
                $results['audio'] = json_decode($audioResult->getContent(), true);
            }

            // Submit images if provided
            if ($request->hasFile('images')) {
                $imageResult = $this->submitImages($request, $word);
                $results['images'] = json_decode($imageResult->getContent(), true);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Complete word data submitted successfully',
                'word' => $word,
                'results' => $results
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to submit complete word data: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validate audio file properties
     * Reference: DevOps basetool/voice_tool/check_voice.js
     *
     * @param $audioFile
     * @return array
     */
    protected function validateAudioFile($audioFile): array
    {
        try {
            $path = $audioFile->getPathName();
            $size = $audioFile->getSize();
            $mimeType = $audioFile->getMimeType();

            // Basic validations
            if ($size > 10 * 1024 * 1024) { // 10MB limit
                return ['valid' => false, 'error' => 'File size exceeds 10MB limit'];
            }

            $allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
            if (!in_array($mimeType, $allowedMimeTypes)) {
                return ['valid' => false, 'error' => 'Unsupported audio format'];
            }

            // Try to get audio duration (optional)
            $duration = null;
            if (function_exists('getid3_analyze')) {
                try {
                    $getID3 = new \getID3();
                    $fileInfo = $getID3->analyze($path);
                    $duration = $fileInfo['playtime_seconds'] ?? null;
                } catch (\Exception $e) {
                    // Duration extraction failed, but file might still be valid
                }
            }

            return [
                'valid' => true,
                'duration' => $duration,
                'size' => $size,
                'mime_type' => $mimeType
            ];

        } catch (\Exception $e) {
            return ['valid' => false, 'error' => 'File validation failed: ' . $e->getMessage()];
        }
    }

    /**
     * Generate audio filename
     * Reference: DevOps basetool/voice_tool/voice_tool.js naming convention
     *
     * @param string $word
     * @param string $type
     * @param string $extension
     * @return string
     */
    protected function generateAudioFilename(string $word, string $type, string $extension): string
    {
        $safeWord = preg_replace('/[^a-zA-Z0-9_-]/', '_', $word);
        $timestamp = now()->format('YmdHis');
        
        return $safeWord . '_' . $type . '_' . $timestamp . '.' . strtolower($extension);
    }

    /**
     * Generate image filename
     *
     * @param string $word
     * @param int $index
     * @param string $extension
     * @return string
     */
    protected function generateImageFilename(string $word, int $index, string $extension): string
    {
        $safeWord = preg_replace('/[^a-zA-Z0-9_-]/', '_', $word);
        $timestamp = now()->format('YmdHis');
        
        return $safeWord . '_img_' . ($index + 1) . '_' . $timestamp . '.' . strtolower($extension);
    }
}
