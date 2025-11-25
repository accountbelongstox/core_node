<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyImporter;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCollectionModel;

class AppQyV1VocabularyUploadController extends Controller
{
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

        try {
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

        } catch (\Exception $e) {
            Log::error('[AppQyV1VocabularyUpload] Error uploading document', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to create vocabulary collection: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function deleteLibrary(Request $request, $library_id)
    {
        $user = Auth::user();

        try {
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

        } catch (\Exception $e) {
            Log::error('[AppQyV1VocabularyUpload] Error deleting library', [
                'user_id' => $user->id,
                'library_id' => $library_id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to delete collection: ' . $e->getMessage(),
            ], 500);
        }
    }
}
