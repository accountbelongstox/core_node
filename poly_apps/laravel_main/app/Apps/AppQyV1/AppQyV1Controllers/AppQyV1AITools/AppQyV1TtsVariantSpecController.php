<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsVariantSpecModel;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * TTS voice-variant specs CRUD (per-language accent/gender voices).
 *
 * The variant-specs table drives "each sentence/word generates N voices" - the
 * count is dynamic (variantsForLanguage() reads these rows). pycore proxies
 * these routes via /api/local/sentence-audio/variants so the pycore-manager UI
 * can edit them; laravel_manager / wordnew may also call directly.
 *
 * Routes (routes/AppQyV1Router/AppQyV1AITools.php, NO-AUTH worker surface):
 *   GET    /api/app_qy_v1/ai_tools/tts/variant-specs?lang=en
 *   POST   /api/app_qy_v1/ai_tools/tts/variant-specs        { lang, specs[] }
 *   DELETE /api/app_qy_v1/ai_tools/tts/variant-specs?lang=en&variant_key=uk_f
 */
class AppQyV1TtsVariantSpecController extends Controller
{
    /**
     * GET /variant-specs?lang=en -> { success, specs:[{lang,variant_key,accent,gender,is_primary}] }.
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'lang' => 'nullable|string|max:20',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }
        $lang = $request->query('lang', 'en');
        try {
            $specs = AppQyV1TtsVariantSpecModel::listForLanguage((string) $lang);
        } catch (\Throwable $e) {
            Log::error('[TtsVariantSpec] index failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error'], 500);
        }
        return response()->json(['success' => true, 'specs' => $specs]);
    }

    /**
     * POST /variant-specs  body: { lang: "en", specs: [{variant_key,accent,gender,is_primary}] }.
     * Replaces the full spec list for that lang (ensures exactly one primary).
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'lang' => 'required|string|max:20',
            'specs' => 'required|array|min:1|max:20',
            'specs.*.variant_key' => 'nullable|string|max:32',
            'specs.*.accent' => 'nullable|string|max:16',
            'specs.*.gender' => 'nullable|string|max:16',
            'specs.*.is_primary' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }
        try {
            $specs = AppQyV1TtsVariantSpecModel::replaceForLanguage(
                (string) $request->input('lang'),
                $request->input('specs')
            );
        } catch (\Throwable $e) {
            Log::error('[TtsVariantSpec] store failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error'], 500);
        }
        return response()->json(['success' => true, 'specs' => $specs]);
    }

    /**
     * DELETE /variant-specs?lang=en&variant_key=uk_f -> { success, deleted:bool }.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'lang' => 'required|string|max:20',
            'variant_key' => 'required|string|max:32',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }
        try {
            $deleted = AppQyV1TtsVariantSpecModel::deleteVariant(
                (string) $request->query('lang'),
                (string) $request->query('variant_key')
            );
        } catch (\Throwable $e) {
            Log::error('[TtsVariantSpec] destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error'], 500);
        }
        return response()->json(['success' => true, 'deleted' => $deleted]);
    }
}
