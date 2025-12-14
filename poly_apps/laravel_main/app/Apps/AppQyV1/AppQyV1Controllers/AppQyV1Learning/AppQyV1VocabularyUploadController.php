<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyImporter;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCollectionModel;
use App\Traits\ApiResponse;

class AppQyV1VocabularyUploadController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private $importer;

    public function __construct()
    {
        $this->importer = new AppQyV1VocabularyImporter();
    }

    public function uploadDocument(Request $request)
    {
        $request->validate([
            'document' => 'required|string',
            'collection_name' => 'required|string|max:255',
            'lang_code' => 'required|string|size:2',
            'description' => 'nullable|string',
        ]);

        $user = Auth::user();
        $document = $request->input('document');
        $collectionName = $request->input('collection_name');
        $langCode = $request->input('lang_code');
        $description = $request->input('description');

            $words = $this->importer->extractWordsFromDocument($document, $langCode);

            if (empty($words)) {
                return response()->json([
                    'success' => false,
                    'error' => 'No valid words found in document',
                ], 400);
            }

            $result = $this->importer->createVocabularyCollection(
                $collectionName,
                $langCode,
                $words,
                'user_upload',
                $user->id,
                false,
                $description
            );

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Vocabulary collection created successfully',
                    'data' => $result,
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'],
                ], 500);
            }

    }

    public function deleteLibrary(Request $request, $library_id)
    {
        $user = Auth::user();

            $collection = AppQyV1VocabularyCollectionModel::find($library_id);

            if (!$collection) {
                return response()->json([
                    'success' => false,
                    'error' => 'Collection not found',
                ], 404);
            }

            if ($collection->owner_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'error' => 'You do not have permission to delete this collection',
                ], 403);
            }

            $collection->delete();

            return response()->json([
                'success' => true,
                'message' => 'Collection deleted successfully',
            ]);

    }
}
