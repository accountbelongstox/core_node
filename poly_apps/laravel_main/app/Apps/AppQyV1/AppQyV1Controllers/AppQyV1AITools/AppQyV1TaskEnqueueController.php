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

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsEngineConfigModel;
use App\Http\Controllers\Controller;
use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use App\Models\LangSentence;
use App\Models\Book;
use App\Models\Subtitle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Task Center manual enqueue.
 *
 * Admin / operator surface that creates AppQyV1 global tasks directly so the
 * chrome Task Center has work to pull. Lives in the same NO-AUTH control-plane
 * group as the translation-queue control endpoints (pycore / chrome-mcp callers
 * have no user token; the routes only strip Sanctum's stateful boot). Every
 * created task flows through the existing worker channel
 * (/api/worker/tasks/pull -> /api/worker/tasks/result) and is written back by
 * its registered processor.
 *
 * Supported task types (execution_type fixed per type by the contract so a
 * caller cannot mis-route a task):
 *   - notebooklm    -> remote_notebooklm (chrome, dedicated lane). payload
 *                      { question|source_text, notebook_url?, title? }.
 *   - gemini_image  -> remote_gemini (chrome, dedicated lane). payload
 *                      { prompt, word, language, size?, md5? }. `prompt` is the
 *                      only HARD requirement, but `word` + `language` SHOULD be
 *                      supplied: the write-back keys the stored image off the
 *                      dictionary row for `word`, so a prompt-only task generates
 *                      an image whose result is then dropped (no row to attach it
 *                      to) — prompt-only is a LANE TEST, not a real fill.
 *   - word_media    -> remote_fast + image (chrome). payload { words:[{word,md5}],
 *                      language, target_language? }.
 *   - gemini_chat   -> remote_gemini_text (chrome, dedicated lane). payload
 *                      { question|source_text, title? }. Text-only Gemini
 *                      completion — sibling of gemini_image, kept off its lane
 *                      because gemini_image's contract is image-only.
 *   - chatgpt_chat  -> remote_chatgpt (chrome, dedicated lane). payload
 *                      { prompt, with_audio?, language? }.
 *
 * NOTE: notebooklm / gemini_image / gemini_chat get their OWN execution_types
 * (not remote_client) because the chrome side runs a separate worker per
 * processor type and pull assigns by execution_type with an atomic claim —
 * sharing a lane would let one feature's worker claim another's tasks
 * (and each other's) and starve them until timeout.
 *   - word_audio    -> remote_audio (pycore or Qwen3-TTS Chrome worker).
 *   - word_translation -> remote_translation (pycore/self-filler).
 */
class AppQyV1TaskEnqueueController extends Controller
{
    use ApiResponse;

    /**
     * POST /api/app_qy_v1/ai_tools/task/enqueue
     * Body: { task_type, payload?, priority?, timeout_seconds?, max_retries?, capability? }
     */
    public function enqueue(Request $request, TaskManagerService $taskManager): JsonResponse
    {
        $validated = $request->validate([
            'task_type' => 'required|string',
            'payload' => 'nullable|array',
            'priority' => 'nullable|integer|min:0|max:' . GlobalTask::priority('maximum'),
            'timeout_seconds' => 'nullable|integer|min:10|max:3600',
            'max_retries' => 'nullable|integer|min:0|max:10',
            // Optional capability tag for task types without a fixed capability.
            'capability' => ['nullable', 'string', Rule::in(GlobalTask::capabilities())],
            // "Jump to task-top": honored ONLY for the translate/audio privileged
            // types (see INTERACTIVE_ALLOWED_TYPES); ignored for everything else.
            'interactive' => 'nullable|boolean',
        ]);

        $taskType = $validated['task_type'];
        $taskDefinition = QueueCenterContract::taskTypeDefinition($taskType);
        if ($taskDefinition === null) {
            return $this->error(
                'Unsupported task_type. Allowed: ' . implode(', ', array_column(QueueCenterContract::taskTypes(), 'key')),
                422
            );
        }

        $executionType = (string) $taskDefinition['execution_type'];
        $payload = $validated['payload'] ?? [];

        // Per-type minimal payload guard so a worker never pulls an unworkable task.
        $payloadError = $this->validatePayload($taskType, $payload);
        if ($payloadError !== null) {
            return $this->error($payloadError, 422);
        }

        // Enrich the dedicated retrieval/generation lanes whose worker needs a
        // field the canonical payload omits: sentence_audio needs the sentence
        // TEXT (content); poster needs a media TITLE. Resolve from the source row
        // (reject when missing rather than enqueue a task that always fails).
        $enrichError = null;
        $payload = $this->enrichPayload($taskType, $payload, $enrichError);
        if ($enrichError !== null) {
            return $this->error($enrichError, 422);
        }

        $priority = $validated['priority'] ?? GlobalTask::priority('manual');
        $timeout = $validated['timeout_seconds'] ?? 120;
        $maxRetries = $validated['max_retries'] ?? 3;

        // Capability-routed task types are pinned so a caller cannot place work
        // on a fast lane whose worker cannot execute that task shape.
        $capability = ($taskDefinition['capability_mode'] ?? 'fixed') === 'selectable'
            ? ($validated['capability'] ?? ($taskDefinition['capability'] ?? null))
            : ($taskDefinition['capability'] ?? null);

        // Honor "jump to task-top" only for the privileged translate/audio types;
        // for everything else interactive is ignored so they keep their natural
        // lane/priority. createTask performs the remote_fast + PRIORITY_FAST rewrite.
        $interactive = ($validated['interactive'] ?? false)
            && in_array($taskType, QueueCenterContract::interactiveTaskTypes(), true);

        $task = $taskManager->createTask(
            'AppQyV1',
            $taskType,
            $executionType,
            $payload,
            $timeout,
            $priority,
            $maxRetries,
            $interactive,
            $capability
        );

        return $this->success([
            'task_id' => $task->task_id,
            'task_type' => $task->task_type,
            'execution_type' => $task->execution_type,
            'capability' => $task->capability,
            'priority' => $task->priority,
            'status' => $task->status,
        ], 'Task enqueued');
    }

    /**
     * Minimal per-type payload requirements. Returns an error string or null.
     *
     * Deliberately permissive: it guards the HARD requirement each lane needs to
     * run, not every field needed for a useful result. In particular gemini_image
     * only HARD-requires `prompt` (so a lane test can be enqueued), but the
     * write-back needs `word` + `language` to attach the image to a dictionary
     * row — see the gemini_image branch note below.
     */
    private function validatePayload(string $taskType, array $payload): ?string
    {
        $taskDefinition = QueueCenterContract::taskTypeDefinition($taskType);
        if (array_key_exists('prompt_payload_field', $taskDefinition ?? [])) {
            if (QueueCenterContract::taskPromptPayloadText($taskType, $payload) === null) {
                $field = QueueCenterContract::taskTypePromptPayloadField($taskType);
                if ($taskType === QueueCenterContract::taskTypeKey('gemini_image')) {
                    // The message also flags the SHOULD fields so an operator who
                    // omits word/language understands the result would be dropped.
                    return "{$taskType} payload requires a non-empty {$field}; it SHOULD also include word + language, "
                        . 'otherwise the generated image has no dictionary row to attach to and the result is dropped '
                        . '(prompt-only = lane test).';
                }
                return "{$taskType} payload requires a non-empty {$field} or source_text";
            }
            return null;
        }

        if ($taskType === 'subtitle_search') {
            $hasQuery = (isset($payload['query']) && is_string($payload['query']) && $payload['query'] !== '')
                || (isset($payload['title']) && is_string($payload['title']) && $payload['title'] !== '');
            if (!$hasQuery) {
                return 'subtitle_search payload requires a non-empty query (or title)';
            }
            return null;
        }

        if ($taskType === 'poster') {
            if (!in_array($payload['media_type'] ?? null, ['book', 'subtitle'], true)) {
                return 'poster payload requires media_type = book|subtitle';
            }
            if (!isset($payload['id']) || !is_numeric($payload['id'])) {
                return 'poster payload requires a numeric id';
            }
            return null;
        }

        if ($taskType === 'sentence_audio') {
            // content_id+language identify the row; the sentence TEXT is resolved
            // server-side in enrichPayload (or accepted if the caller supplies it).
            $hasContentId = isset($payload['content_id']) && is_string($payload['content_id']) && $payload['content_id'] !== '';
            $hasLang = isset($payload['language']) && is_string($payload['language']) && $payload['language'] !== '';
            if (!$hasContentId || !$hasLang) {
                return 'sentence_audio payload requires content_id and language';
            }
            return null;
        }

        // word_* types: require at least a language; word identification is checked
        // loosely (words[] or word) so the operator can also stage a batch.
        if (in_array($taskType, ['word_media', 'word_audio', 'word_translation'], true)) {
            if (!isset($payload['language']) || !is_string($payload['language']) || $payload['language'] === '') {
                return $taskType . ' payload requires a language';
            }
        }

        return null;
    }

    /**
     * Resolve the worker-required field the canonical payload omits, so a
     * dedicated-lane task is never enqueued unworkable:
     *   - sentence_audio: look up the sentence TEXT by content_id+language and
     *     inject `content` for the sentence-audio worker.
     *   - poster: look up the media TITLE by media_type+id and inject `title`
     *     (+ `filename` fallback) for the mcp-chrome search worker.
     * Sets $error (-> 422) when the source row/text is missing. A caller that
     * already supplied content/title is trusted (no lookup).
     */
    private function enrichPayload(string $taskType, array $payload, ?string &$error): array
    {
        if ($taskType === 'sentence_audio') {
            // Engine preference for the lane (qwen3tts-first, GPU-gated by pycore).
            // Carried so a manually enqueued task matches the claim/bump lanes.
            if (!isset($payload['engine_profile'])) {
                $payload['engine_profile'] = AppQyV1TtsEngineConfigModel::SENTENCE_PROFILE;
            }
            if (!isset($payload['preferred_engine'])) {
                $payload['preferred_engine'] = AppQyV1TtsEngineConfigModel::sentencePrimaryEngine();
            }
            if (isset($payload['content']) && is_string($payload['content']) && $payload['content'] !== '') {
                return $payload;
            }
            $contentId = (string) ($payload['content_id'] ?? '');
            $language = (string) ($payload['language'] ?? '');
            $sentence = LangSentence::onLang($language)->where('content_id', $contentId)->first();
            if ($sentence === null || (string) $sentence->text === '') {
                $error = 'sentence_audio: no sentence text found for content_id+language';
                return $payload;
            }
            $payload['content'] = (string) $sentence->text;
            return $payload;
        }

        if ($taskType === 'poster') {
            if (isset($payload['title']) && is_string($payload['title']) && $payload['title'] !== '') {
                return $payload;
            }
            $mediaType = (string) ($payload['media_type'] ?? '');
            $id = (int) ($payload['id'] ?? 0);
            $row = $mediaType === 'book'
                ? Book::find($id)
                : ($mediaType === 'subtitle' ? Subtitle::find($id) : null);
            if ($row === null) {
                $error = 'poster: no ' . $mediaType . ' row found for id ' . $id;
                return $payload;
            }
            $title = (string) ($row->title ?? '');
            if ($title === '') {
                $title = (string) ($row->original_name ?? '');
            }
            if ($title === '') {
                $error = 'poster: ' . $mediaType . ' #' . $id . ' has no title';
                return $payload;
            }
            $payload['title'] = $title;
            if (!isset($payload['filename']) && isset($row->original_name)) {
                $payload['filename'] = (string) $row->original_name;
            }
            return $payload;
        }

        return $payload;
    }
}
