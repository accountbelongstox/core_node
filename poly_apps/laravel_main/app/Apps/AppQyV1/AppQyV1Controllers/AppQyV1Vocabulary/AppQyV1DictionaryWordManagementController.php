<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dictionary WORD MANAGEMENT (dashboard mutations).
 *
 * The read/drill-down side lives in AppQyV1VocabularyStatsController; this is the
 * write side the Words management UI needs: create / update / delete a single
 * word and run batch actions over a set of md5s. Per-language tables are reached
 * via AppQyV1LangDictionaryModel::forLanguage($code); create/update go through a
 * loaded model instance so JSON-cast columns (translations, word_details) are
 * encoded correctly (a bulk query-builder update would not cast them).
 *
 * Posture mirrors the sibling dictionary endpoints: public, validated, no user
 * data. Cache is invalidated via the model's forgetMetricsCache on every write.
 */
class AppQyV1DictionaryWordManagementController extends Controller
{
    use ApiResponse;

    /** Resolve + guard the language table; returns [code, modelHasTable]. */
    private function resolveLanguage(string $language): array
    {
        $code = AppQyV1VocabularyLibraryPublicController::getLanguageCode($language);
        $hasTable = AppQyV1LangDictionaryModel::languageTableExists($code);
        return [$code, $hasTable];
    }

    /** Consistent row shape (matches AppQyV1VocabularyStatsController::dictionaryWords). */
    private function shapeRow(AppQyV1LangDictionaryModel $row): array
    {
        $entry = AppQyV1VocabularyLibraryPublicController::buildWordEntryFromDictionaryRow($row);

        // File-first audio path/size: same canonical PathMapper base + first-existing
        // tts_file the URL builder uses, so the displayed SERVER PATH + SIZE match the
        // file audio_url serves. Kept in parity with the list controller's row map.
        $audioPath = null;
        $audioSize = null;
        if (!empty($row->tts_files)) {
            $audioBaseAbs = \App\Providers\PathMapper::getAppQyV1AudioBaseDir() . '/';
            $wwwRoot = rtrim(\App\Providers\PathMapper::mapWebPath('www'), '/');
            foreach ($row->tts_files as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    $fullPath = $audioBaseAbs . $ttsFile['path'];
                    if (is_file($fullPath)) {
                        $audioPath = str_starts_with($fullPath, $wwwRoot)
                            ? substr($fullPath, strlen($wwwRoot))
                            : $fullPath;
                        $size = @filesize($fullPath);
                        $audioSize = $size === false ? null : (int) $size;
                        break;
                    }
                }
            }
        }

        return [
            'id' => (int) $row->id,
            'content' => $row->content,
            'md5' => $row->md5,
            'has_translation' => (bool) $row->has_translation || !empty($entry['has_translation']),
            'has_audio' => (bool) $row->has_audio,
            'is_valid' => (bool) $row->is_valid,
            'translations' => $entry['translations'],
            'us_phonetic' => $row->us_phonetic,
            'uk_phonetic' => $row->uk_phonetic,
            'phonetic' => $row->phonetic,
            'query_count' => (int) $row->query_count,
            'audio_url' => $entry['audio_url'],
            'audio_available' => (bool) ($entry['audio_available'] ?? false),
            'audio_path' => $audioPath,
            'audio_size' => $audioSize,
            'word_details' => $row->word_details,
            'image_files' => is_array($row->image_files) ? $row->image_files : null,
            'tts_status' => $row->tts_status,
            'tts_attempts' => (int) ($row->tts_attempts ?? 0),
            'tts_error' => $row->tts_error,
            'validity_note' => $row->validity_note,
            'validity_source' => $row->validity_source,
            'validity_checked_at' => $row->validity_checked_at,
            'last_modified' => $row->last_modified,
        ];
    }

    /**
     * Apply the editable fields from $data onto a loaded model instance. Only
     * keys actually present are touched (partial update). JSON-cast columns are
     * set as arrays so Eloquent encodes them on save().
     */
    private function applyEditable(AppQyV1LangDictionaryModel $row, array $data): void
    {
        if (array_key_exists('translations', $data)) {
            $list = is_array($data['translations'])
                ? array_values(array_filter(array_map('trim', $data['translations']), fn ($t) => $t !== ''))
                : [];
            $row->translations = $list;
            $row->has_translation = count($list) > 0;
        }
        if (array_key_exists('us_phonetic', $data)) {
            $row->us_phonetic = $data['us_phonetic'] !== null ? (string) $data['us_phonetic'] : null;
        }
        if (array_key_exists('uk_phonetic', $data)) {
            $row->uk_phonetic = $data['uk_phonetic'] !== null ? (string) $data['uk_phonetic'] : null;
        }
        if (array_key_exists('phonetic', $data)) {
            $row->phonetic = $data['phonetic'] !== null ? (string) $data['phonetic'] : null;
        }
        if (array_key_exists('word_details', $data)) {
            $row->word_details = $data['word_details'];   // JSON-cast column
        }
        if (array_key_exists('is_valid', $data)) {
            $row->is_valid = (bool) $data['is_valid'];
            $row->validity_checked_at = now();
            $row->validity_source = 'dashboard';
            if (array_key_exists('validity_note', $data)) {
                $row->validity_note = $data['validity_note'] !== null ? (string) $data['validity_note'] : null;
            }
        } elseif (array_key_exists('validity_note', $data)) {
            $row->validity_note = $data['validity_note'] !== null ? (string) $data['validity_note'] : null;
        }
    }

    private array $editableRules = [
        'translations' => 'sometimes|array',
        'translations.*' => 'string',
        'us_phonetic' => 'sometimes|nullable|string|max:255',
        'uk_phonetic' => 'sometimes|nullable|string|max:255',
        'phonetic' => 'sometimes|nullable|string|max:255',
        'word_details' => 'sometimes|nullable',
        'is_valid' => 'sometimes|boolean',
        'validity_note' => 'sometimes|nullable|string|max:2000',
    ];

    /**
     * POST /api/app_qy_v1/dictionary/words
     * Body: { language, content, translations?[], us_phonetic?, uk_phonetic?,
     *         phonetic?, word_details?, is_valid?, validity_note? }
     * Creates (or finds) the word, applies the given fields, returns the row.
     */
    public function create(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'language' => 'required|string',
            'content' => 'required|string|max:512',
        ], $this->editableRules));

        $content = trim((string) $validated['content']);
        if ($content === '') {
            return response()->json(['success' => false, 'message' => 'content is required'], 422);
        }

        [$code, $hasTable] = $this->resolveLanguage($validated['language']);
        if (!$hasTable) {
            return response()->json(['success' => false, 'message' => 'No dictionary for this language'], 404);
        }

        $row = AppQyV1LangDictionaryModel::createOrFind($code, $content);
        $this->applyEditable($row, $validated);
        $row->save();
        AppQyV1LangDictionaryModel::forgetMetricsCache($code);

        return $this->success(['word' => $this->shapeRow($row)], 'Word saved');
    }

    /**
     * PUT /api/app_qy_v1/dictionary/words/{md5}
     * Body: { language, ...editable fields }
     */
    public function update(Request $request, string $md5): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'language' => 'required|string',
        ], $this->editableRules));

        [$code, $hasTable] = $this->resolveLanguage($validated['language']);
        if (!$hasTable) {
            return response()->json(['success' => false, 'message' => 'No dictionary for this language'], 404);
        }

        $row = AppQyV1LangDictionaryModel::findByMd5($code, $md5);
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Word not found'], 404);
        }

        $this->applyEditable($row, $validated);
        $row->save();
        AppQyV1LangDictionaryModel::forgetMetricsCache($code);

        return $this->success(['word' => $this->shapeRow($row)], 'Word updated');
    }

    /**
     * DELETE /api/app_qy_v1/dictionary/words/{md5}?language=
     */
    public function destroy(Request $request, string $md5): JsonResponse
    {
        $validated = $request->validate(['language' => 'required|string']);
        [$code, $hasTable] = $this->resolveLanguage($validated['language']);
        if (!$hasTable) {
            return response()->json(['success' => false, 'message' => 'No dictionary for this language'], 404);
        }

        $deleted = AppQyV1LangDictionaryModel::forLanguage($code)->where('md5', $md5)->delete();
        if ($deleted > 0) {
            AppQyV1LangDictionaryModel::forgetMetricsCache($code);
        }

        return $this->success(['deleted' => (int) $deleted], $deleted > 0 ? 'Word deleted' : 'Word not found');
    }

    /**
     * POST /api/app_qy_v1/dictionary/words/batch
     * Body: { language, md5s:[], action: delete|mark_valid|mark_invalid|requeue_tts }
     *
     * Batch management over a selection. requeue_tts resets the per-row TTS state
     * (has_audio=false, status=pending, attempts=0, error cleared) so the unified
     * TTS coordinator regenerates the audio.
     */
    public function batch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'required|string',
            'md5s' => 'required|array|min:1|max:1000',
            'md5s.*' => 'string',
            'action' => 'required|string|in:delete,mark_valid,mark_invalid,requeue_tts',
        ]);

        [$code, $hasTable] = $this->resolveLanguage($validated['language']);
        if (!$hasTable) {
            return response()->json(['success' => false, 'message' => 'No dictionary for this language'], 404);
        }

        $md5s = array_values(array_unique(array_filter($validated['md5s'], fn ($m) => is_string($m) && $m !== '')));
        if (empty($md5s)) {
            return response()->json(['success' => false, 'message' => 'No valid md5s provided'], 422);
        }

        $base = fn () => AppQyV1LangDictionaryModel::forLanguage($code)->newQuery()->whereIn('md5', $md5s);

        $affected = 0;
        switch ($validated['action']) {
            case 'delete':
                $affected = (int) $base()->delete();
                break;
            case 'mark_valid':
            case 'mark_invalid':
                $affected = (int) $base()->update([
                    'is_valid' => $validated['action'] === 'mark_valid',
                    'validity_checked_at' => now(),
                    'validity_source' => 'dashboard',
                    'updated_at' => now(),
                ]);
                break;
            case 'requeue_tts':
                $affected = (int) $base()->update([
                    'has_audio' => false,
                    'tts_status' => 'pending',
                    'tts_attempts' => 0,
                    'tts_error' => null,
                    'updated_at' => now(),
                ]);
                break;
        }

        AppQyV1LangDictionaryModel::forgetMetricsCache($code);

        return $this->success([
            'action' => $validated['action'],
            'requested' => count($md5s),
            'affected' => $affected,
        ], 'Batch action applied');
    }
}
