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
 *   - word_media    -> remote_client (chrome). payload { words:[{word,md5}],
 *                      language, target_language? }.
 *   - gemini_chat   -> remote_gemini_text (chrome, dedicated lane). payload
 *                      { question|source_text, title? }. Text-only Gemini
 *                      completion — sibling of gemini_image, kept off its lane
 *                      because gemini_image's contract is image-only.
 *
 * NOTE: notebooklm / gemini_image / gemini_chat get their OWN execution_types
 * (not remote_client) because the chrome side runs a separate worker per
 * processor type and pull assigns by execution_type with an atomic claim —
 * sharing a lane would let one feature's worker claim another's tasks
 * (and each other's) and starve them until timeout.
 *   - word_audio    -> remote_audio (pycore).
 *   - word_translation -> remote_translation (pycore/self-filler).
 */
class AppQyV1TaskEnqueueController extends Controller
{
    use ApiResponse;

    /**
     * Allowed task_type -> fixed execution_type. The execution_type is NOT taken
     * from the request: each task type has exactly one lane in the v3 contract.
     */
    private const TASK_TYPE_EXECUTION = [
        'notebooklm' => GlobalTask::EXECUTION_REMOTE_NOTEBOOKLM,
        'gemini_image' => GlobalTask::EXECUTION_REMOTE_GEMINI,
        'gemini_chat' => GlobalTask::EXECUTION_REMOTE_GEMINI_TEXT,
        'word_media' => GlobalTask::EXECUTION_REMOTE_CLIENT,
        'word_audio' => GlobalTask::EXECUTION_REMOTE_AUDIO,
        'word_translation' => GlobalTask::EXECUTION_REMOTE_TRANSLATION,
        // New dedicated pycore-only retrieval/generation lanes (each gets its own
        // execution_type so a dedicated per-processor_type worker claims it).
        'subtitle_search' => GlobalTask::EXECUTION_REMOTE_SUBTITLE,
        'poster' => GlobalTask::EXECUTION_REMOTE_POSTER,
        'sentence_audio' => GlobalTask::EXECUTION_REMOTE_SENTENCE_AUDIO,
    ];

    /**
     * Default capability tag per task_type when the caller omits `capability`.
     * For the dedicated lanes the tag is pinned to its provider tag (used mainly
     * for UI / provider display, since the lane is claimed by processor_type).
     * Task types absent here default to NULL (any-eligible).
     */
    private const TASK_TYPE_DEFAULT_CAPABILITY = [
        'subtitle_search' => GlobalTask::CAPABILITY_SUBTITLE,
        'poster' => GlobalTask::CAPABILITY_POSTER,
        'sentence_audio' => GlobalTask::CAPABILITY_SENTENCE_AUDIO,
        // Pin audio so an interactive promotion onto remote_fast stays pycore-only
        // (chrome has no audio lane). word_translation stays NULL = either client.
        'word_audio' => GlobalTask::CAPABILITY_AUDIO,
    ];

    /**
     * task_types allowed to "jump to task-top" via interactive=true. Restricted to
     * the translate + audio categories: each has a confirmed claimant AND a result
     * write-back (WordTranslationTaskProcessor handles word_audio by task_type).
     * IMAGE (word_media / gemini_image) is intentionally excluded until the pycore
     * image lane exists (its claimant routing is decided separately). Non-privileged
     * types (notebooklm / subtitle_search / poster) never jump.
     */
    private const INTERACTIVE_ALLOWED_TYPES = [
        'word_translation',
        'word_audio',
        'sentence_audio',
    ];

    /** Default priority for a manually enqueued task (front-of-queue is 100). */
    private const DEFAULT_PRIORITY = 50;
    private const MAX_PRIORITY = 1000;

    /**
     * POST /api/app_qy_v1/ai_tools/task/enqueue
     * Body: { task_type, payload?, priority?, timeout_seconds?, max_retries?, capability? }
     */
    public function enqueue(Request $request, TaskManagerService $taskManager): JsonResponse
    {
        $validated = $request->validate([
            'task_type' => 'required|string',
            'payload' => 'nullable|array',
            'priority' => 'nullable|integer|min:0|max:' . self::MAX_PRIORITY,
            'timeout_seconds' => 'nullable|integer|min:10|max:3600',
            'max_retries' => 'nullable|integer|min:0|max:10',
            // Optional capability tag (drift-proof against the model vocabulary).
            // When omitted, the new dedicated task types default to their pinned
            // provider tag (see TASK_TYPE_DEFAULT_CAPABILITY); others stay NULL.
            'capability' => ['nullable', 'string', Rule::in(GlobalTask::CAPABILITIES)],
            // "Jump to task-top": honored ONLY for the translate/audio privileged
            // types (see INTERACTIVE_ALLOWED_TYPES); ignored for everything else.
            'interactive' => 'nullable|boolean',
        ]);

        $taskType = $validated['task_type'];
        if (!array_key_exists($taskType, self::TASK_TYPE_EXECUTION)) {
            return $this->error(
                'Unsupported task_type. Allowed: ' . implode(', ', array_keys(self::TASK_TYPE_EXECUTION)),
                422
            );
        }

        $executionType = self::TASK_TYPE_EXECUTION[$taskType];
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

        $priority = $validated['priority'] ?? self::DEFAULT_PRIORITY;
        $timeout = $validated['timeout_seconds'] ?? 120;
        $maxRetries = $validated['max_retries'] ?? 3;

        // Capability: explicit request value wins; otherwise fall back to the
        // pinned default for the new dedicated task types (NULL = any-eligible).
        $capability = $validated['capability'] ?? (self::TASK_TYPE_DEFAULT_CAPABILITY[$taskType] ?? null);

        // Honor "jump to task-top" only for the privileged translate/audio types;
        // for everything else interactive is ignored so they keep their natural
        // lane/priority. createTask performs the remote_fast + PRIORITY_FAST rewrite.
        $interactive = ($validated['interactive'] ?? false)
            && in_array($taskType, self::INTERACTIVE_ALLOWED_TYPES, true);

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
        if ($taskType === 'notebooklm') {
            $hasQuestion = (isset($payload['question']) && is_string($payload['question']) && $payload['question'] !== '')
                || (isset($payload['source_text']) && is_string($payload['source_text']) && $payload['source_text'] !== '');
            if (!$hasQuestion) {
                return 'notebooklm payload requires a non-empty question or source_text';
            }
            return null;
        }

        if ($taskType === 'gemini_chat') {
            $hasQuestion = (isset($payload['question']) && is_string($payload['question']) && $payload['question'] !== '')
                || (isset($payload['source_text']) && is_string($payload['source_text']) && $payload['source_text'] !== '');
            if (!$hasQuestion) {
                return 'gemini_chat payload requires a non-empty question or source_text';
            }
            return null;
        }

        if ($taskType === 'gemini_image') {
            // HARD requirement: prompt (the only thing the worker needs to run).
            $hasPrompt = isset($payload['prompt']) && is_string($payload['prompt']) && $payload['prompt'] !== '';
            if (!$hasPrompt) {
                // The message also flags the SHOULD fields so an operator who
                // omits word/language understands the result would be dropped.
                return 'gemini_image payload requires a non-empty prompt; it SHOULD also include word + language, '
                    . 'otherwise the generated image has no dictionary row to attach to and the result is dropped '
                    . '(prompt-only = lane test).';
            }
            // Graceful: a prompt-only task is allowed (lane test) but the
            // generated image cannot be persisted without word/language — the
            // processor logs and drops it. Do NOT hard-fail here.
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
     *     inject `content` (the pycore edge-tts worker synthesizes payload.content).
     *   - poster: look up the media TITLE by media_type+id and inject `title`
     *     (+ `filename` fallback) so the pycore worker can call find_poster.
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
