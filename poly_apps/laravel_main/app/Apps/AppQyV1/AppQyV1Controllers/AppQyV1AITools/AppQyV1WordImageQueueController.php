<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordImageQueueService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

/**
 * Word-image queue intake (P3 of the word-media pipeline).
 *
 * POST /api/app_qy_v1/ai_tools/word_image/queue/add
 *
 * Mirrors the TTS queue batch-add (AppQyV1UnifiedTTSQueueService): a re-request
 * with priority 'front' (or position 'beginning') moves the word to the head of
 * the image queue (PRIORITY_FRONT = 100); otherwise the word is queued at
 * PRIORITY_DEFAULT. State lives on the canonical dictionary row's image_*
 * columns. Audio enqueue REUSES the existing
 * POST /api/app_qy_v1/ai_tools/tts/queue/batch/add (not duplicated here).
 *
 * Body: { words: [ { word, language } ], priority?: 'front'|'normal' }
 */
class AppQyV1WordImageQueueController extends BaseController
{
    public function add(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'words' => 'required|array|min:1',
            'words.*.word' => 'required|string',
            'words.*.language' => 'required|string',
            'priority' => 'nullable|string',
            'interactive' => 'nullable|boolean',
        ]);

        // 'front' (or 'beginning') => move-to-front; anything else => normal.
        $position = 'end';
        $priority = $validated['priority'] ?? null;
        if (is_string($priority) && in_array(strtolower($priority), ['front', 'beginning', 'high'], true)) {
            $position = 'beginning';
        }

        $result = (new AppQyV1WordImageQueueService())->addBatch($validated['words'], $position);

        // Interactive intake: ALSO promote each word's canonical word_media image
        // task onto the shared remote_fast lane (capability=image) so the chrome
        // client fast-drains it sub-second. Routed through the SINGLE canonical
        // word_media creator (AppQyV1WordMediaService); the dict-column bump above
        // is unchanged and no second task is created here.
        if ((bool) ($validated['interactive'] ?? false)) {
            $mediaService = new AppQyV1WordMediaService();
            foreach ($validated['words'] as $w) {
                $mediaService->ensureImageFastTask($w['word'], $w['language']);
            }
        }

        if ($position === 'beginning') {
            AppQyV1TranslationEventModel::emit('word_image.priority', [
                'batch' => true,
                'count' => count($validated['words']),
                'items' => $validated['words'],
            ]);
        }

        return response()->json($result);
    }
}
