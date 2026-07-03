<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GlobalTask extends Model
{
    use HasFactory;

    protected $table = 'global_tasks';

    protected $fillable = [
        'task_id',
        'app_name',
        'task_type',
        'execution_type',
        'status',
        'assigned_to',
        'assigned_at',
        'timeout_at',
        'timeout_seconds',
        'priority',
        'retry_count',
        'max_retries',
        'progress',
        'payload',
        'steps',
        'result',
        'error',
        'queue_item_id',
        'completed_at',
        // Phase 2 — shared fast lane + capability routing.
        'capability',
        'is_fast_tier',
        // Phase 5 — substrate unification link back to the canonical dict row.
        'dict_row_id',
        'dict_language',
        'dict_row_table',
        'sync_to_dict_at',
        'group_key',
    ];

    protected $casts = [
        'payload' => 'array',
        'steps' => 'array',
        'result' => 'array',
        'progress' => 'float',
        'assigned_at' => 'datetime',
        'timeout_at' => 'datetime',
        'completed_at' => 'datetime',
        'priority' => 'integer',
        'retry_count' => 'integer',
        'max_retries' => 'integer',
        'timeout_seconds' => 'integer',
        // Phase 2 / Phase 5 additions.
        'is_fast_tier' => 'boolean',
        'dict_row_id' => 'integer',
        'sync_to_dict_at' => 'datetime',
    ];

    // Task status constants
    const STATUS_PENDING = 'pending';
    const STATUS_ASSIGNED = 'assigned';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_COMPLETED_DEMO = 'completed_demo';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';

    // Execution type constants
    const EXECUTION_LOCAL_TIMER = 'local_timer';
    const EXECUTION_REMOTE_CLIENT = 'remote_client';
    const EXECUTION_REMOTE_COMPUTE = 'remote_compute';
    const EXECUTION_REMOTE_OCR = 'remote_ocr';
    const EXECUTION_REMOTE_TRANSLATION = 'remote_translation';
    const EXECUTION_REMOTE_VIDEO = 'remote_video';
    const EXECUTION_REMOTE_IO = 'remote_io';
    // Local-TTS audio assist lane (pycore). word_audio tasks ride this so the
    // pycore audio worker can register/pull a dedicated audio queue, separate
    // from the chrome Bing assist (remote_client) lane.
    const EXECUTION_REMOTE_AUDIO = 'remote_audio';
    // Dedicated chrome Task Center lanes. The chrome side runs a SEPARATE worker
    // per processor type, and pull assigns by execution_type with an atomic
    // claim — so notebooklm / gemini_image MUST NOT share remote_client with
    // word_media, or the NotebookLM/Gemini workers would claim word_media tasks
    // (and each other's) and starve them until timeout. Each gets its own lane.
    const EXECUTION_REMOTE_NOTEBOOKLM = 'remote_notebooklm';
    const EXECUTION_REMOTE_GEMINI = 'remote_gemini';
    // Text-only Gemini completion lane (gemini_chat task_type), separate from
    // EXECUTION_REMOTE_GEMINI (gemini_image) for the same reason: pull assigns
    // by execution_type with an atomic claim, so a shared lane would let one
    // feature's worker claim and starve the other's tasks.
    const EXECUTION_REMOTE_GEMINI_TEXT = 'remote_gemini_text';
    // Dedicated chrome web-LLM "is this a real word?" validity-detection lane. A
    // batch of untranslated+unchecked words is classified valid/invalid by a web
    // LLM (Gemini/DeepSeek/ChatGPT) so the translation enqueue skips the junk.
    // MUST be its own lane (not remote_translation): pull assigns by
    // execution_type with no task_type filter, so co-mingling word_validity with
    // word_translation/prompt_translation would let each worker fail-release the
    // other's tasks (retry_count++ -> permanent failure within max_retries).
    const EXECUTION_REMOTE_VALIDITY = 'remote_validity';

    // Dedicated pycore-only retrieval/generation lanes. Kept OFF remote_fast so
    // they never starve the interactive fast lane; claimed via the normal
    // per-processor_type pull loop (a dedicated worker registers each lane).
    const EXECUTION_REMOTE_SUBTITLE = 'remote_subtitle';
    const EXECUTION_REMOTE_POSTER = 'remote_poster';
    const EXECUTION_REMOTE_SENTENCE_AUDIO = 'remote_sentence_audio';
    // Pycore-only speech-to-text (STT) transcription lane.
    const EXECUTION_REMOTE_STT = 'remote_stt';

    // Shared interactive fast lane. BOTH pycore and chrome-mcp register for this
    // single lane; the existing atomic pull (lockForUpdate + assignTo) already
    // guarantees first-idle-wins / runs-exactly-once. Which of the two actually
    // claims a given fast task is narrowed by the task's `capability` tag
    // (see capabilityMatches()).
    const EXECUTION_REMOTE_FAST = 'remote_fast';

    // The ONE canonical list of every execution_type lane. Validators derive
    // their allowed-value set from this array (Rule::in(EXECUTION_TYPES)) so a
    // newly-added lane const is automatically accepted everywhere and the two
    // request validators can never silently drift from the model.
    const EXECUTION_TYPES = [
        self::EXECUTION_LOCAL_TIMER,
        self::EXECUTION_REMOTE_CLIENT,
        self::EXECUTION_REMOTE_COMPUTE,
        self::EXECUTION_REMOTE_OCR,
        self::EXECUTION_REMOTE_TRANSLATION,
        self::EXECUTION_REMOTE_VIDEO,
        self::EXECUTION_REMOTE_IO,
        self::EXECUTION_REMOTE_AUDIO,
        self::EXECUTION_REMOTE_NOTEBOOKLM,
        self::EXECUTION_REMOTE_GEMINI,
        self::EXECUTION_REMOTE_GEMINI_TEXT,
        self::EXECUTION_REMOTE_VALIDITY,
        self::EXECUTION_REMOTE_FAST,
        self::EXECUTION_REMOTE_SUBTITLE,
        self::EXECUTION_REMOTE_POSTER,
        self::EXECUTION_REMOTE_SENTENCE_AUDIO,
        self::EXECUTION_REMOTE_STT,
    ];

    // Priority tiers (single integer `priority` column, ordered DESC on pull).
    // FAST == the existing "front of queue" value (resolve / library-words bumps
    // already use 100 and pending_urgent already counts it), so an interactive
    // request deterministically outranks background scans (0) and normal
    // enqueues without inventing a new range.
    const PRIORITY_FAST = 100;

    // Capability vocabulary (the ONE canonical set). A task's `capability` is one
    // of these or NULL (any). A worker advertises a subset via workers.capabilities.
    const CAPABILITY_AUDIO = 'audio';            // TTS / word_audio / article_audio — pycore
    const CAPABILITY_IMAGE = 'image';            // word_media / gemini_image — chrome
    const CAPABILITY_TRANSLATE = 'translate';    // word_translation — either client
    const CAPABILITY_SENTENCE_AUDIO = 'sentence_audio'; // chrome web-audio assist
    // BOTH pycore + chrome advertise ai_translate -> intelligent first-idle-wins
    // race on the shared fast lane (task_type stays word_translation).
    const CAPABILITY_AI_TRANSLATE = 'ai_translate';
    const CAPABILITY_SUBTITLE = 'subtitle';      // pycore-only subtitle retrieval
    const CAPABILITY_POSTER = 'poster';          // pycore-only movie poster (DISTINCT from 'image' = word art)
    const CAPABILITY_STT = 'stt';                // pycore-only speech-to-text transcription

    const CAPABILITIES = [
        self::CAPABILITY_AUDIO,
        self::CAPABILITY_IMAGE,
        self::CAPABILITY_TRANSLATE,
        self::CAPABILITY_SENTENCE_AUDIO,
        self::CAPABILITY_AI_TRANSLATE,
        self::CAPABILITY_SUBTITLE,
        self::CAPABILITY_POSTER,
        self::CAPABILITY_STT,
    ];

    /**
     * Whether a worker advertising $workerCapabilities is eligible to claim this
     * task on the shared fast lane. A NULL/empty task capability means ANY worker
     * may claim it (back-compat); otherwise the worker must advertise the tag.
     * Matching is done in PHP (after the lockForUpdate pull) so it behaves
     * identically on pgsql and sqlite — no JSON_CONTAINS in the WHERE clause.
     *
     * @param array<int,string> $workerCapabilities
     */
    public function capabilityMatches(array $workerCapabilities): bool
    {
        if ($this->capability === null || $this->capability === '') {
            return true;
        }
        return in_array($this->capability, $workerCapabilities, true);
    }

    /**
     * Scope: tasks on the shared fast lane (the remote_fast execution_type).
     */
    public function scopeFastLane($query)
    {
        return $query->where('execution_type', self::EXECUTION_REMOTE_FAST);
    }

    /**
     * Scope: tasks linked to a specific canonical dictionary row (Phase 5).
     */
    public function scopeByDictRow($query, string $language, int $rowId)
    {
        return $query->where('dict_language', $language)->where('dict_row_id', $rowId);
    }

    /**
     * Phase 5 — project this task's completion back onto its linked canonical
     * dictionary row (the substrate-B status columns) so the dict row stays in
     * sync during the dual-write window. FILL-MISSING and idempotent: it never
     * clobbers a row already marked complete (has_audio / has_image true or
     * status already 'completed'), and it is wrapped so it can never fail the
     * caller's result transaction. No-op when the task is not dict-linked.
     *
     * The actual media file persistence stays the responsibility of the existing
     * writeback/timer path; this only reflects completion STATUS. Double audio
     * synthesis is separately guarded by TaskManagerService::claimAudioLock().
     */
    public function syncToDictRow(): bool
    {
        if (empty($this->dict_row_id) || empty($this->dict_row_table) || empty($this->dict_language)) {
            return false;
        }

        try {
            $conn = \App\Providers\AppTablePrefixServiceProvider::getConnection(\App\Constants\AppKeys::APPQYV1);
            $schema = \Illuminate\Support\Facades\Schema::connection($conn);
            $table = $this->dict_row_table;

            if (!$schema->hasTable($table)) {
                return false;
            }

            $db = \Illuminate\Support\Facades\DB::connection($conn);
            $row = $db->table($table)->where('id', $this->dict_row_id)->first();
            if (!$row) {
                return false;
            }

            $update = [];
            $isAudio = $this->capability === self::CAPABILITY_AUDIO
                || in_array($this->task_type, ['word_audio', 'article_audio'], true);
            $isImage = $this->capability === self::CAPABILITY_IMAGE
                || in_array($this->task_type, ['word_media', 'gemini_image'], true);

            if ($isAudio && $schema->hasColumn($table, 'tts_status')) {
                $hasAudio = isset($row->has_audio) ? (bool) $row->has_audio : false;
                $ttsStatus = $row->tts_status ?? null;
                if (!$hasAudio && $ttsStatus !== 'completed') {
                    $update['tts_status'] = 'completed';
                    if ($schema->hasColumn($table, 'tts_completed_at')) {
                        $update['tts_completed_at'] = now();
                    }
                }
            } elseif ($isImage && $schema->hasColumn($table, 'image_status')) {
                $hasImage = isset($row->has_image) ? (bool) $row->has_image : false;
                $imageStatus = $row->image_status ?? null;
                if (!$hasImage && $imageStatus !== 'completed') {
                    $update['image_status'] = 'completed';
                    if ($schema->hasColumn($table, 'image_completed_at')) {
                        $update['image_completed_at'] = now();
                    }
                }
            }

            if (!empty($update)) {
                $db->table($table)->where('id', $this->dict_row_id)->update($update);
            }

            $this->sync_to_dict_at = now();
            $this->save();

            return true;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[GlobalTask] syncToDictRow failed', [
                'task_id' => $this->task_id,
                'dict_row_id' => $this->dict_row_id,
                'dict_row_table' => $this->dict_row_table,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Assign task to a worker
     */
    public function assignTo(string $workerId, ?int $timeoutSeconds = null)
    {
        $this->assigned_to = $workerId;
        $this->assigned_at = now();
        $this->status = self::STATUS_ASSIGNED;

        if ($timeoutSeconds) {
            $this->timeout_at = now()->addSeconds($timeoutSeconds);
            $this->timeout_seconds = $timeoutSeconds;
        }

        $this->save();
    }

    /**
     * Release assignment (for timeout or failure)
     */
    public function releaseAssignment()
    {
        $this->assigned_to = null;
        $this->assigned_at = null;
        $this->timeout_at = null;
        $this->status = self::STATUS_PENDING;
        $this->save();
    }

    /**
     * Mark as processing
     */
    public function startProcessing()
    {
        $this->status = self::STATUS_PROCESSING;
        $this->save();
    }

    /**
     * Complete the task with result
     */
    public function complete(array $result)
    {
        $this->status = self::STATUS_COMPLETED;
        $this->progress = 100.0;
        $this->result = $result;
        $this->save();
    }

    /**
     * Fail the task with error
     */
    public function fail(string $error)
    {
        $this->status = self::STATUS_FAILED;
        $this->error = $error;
        $this->retry_count++;
        $this->save();
    }

    /**
     * Check if task can be retried
     */
    public function canRetry(): bool
    {
        return $this->retry_count < $this->max_retries;
    }

    /**
     * Scope: Get pending tasks
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope: Get assigned tasks
     */
    public function scopeAssigned($query)
    {
        return $query->where('status', self::STATUS_ASSIGNED);
    }

    /**
     * Scope: Get timed out tasks
     *
     * Covers BOTH live worker-owned statuses: a worker that pulled a task
     * (assigned) or reported intermediate progress (processing) and then died
     * must have its task reclaimed either way. Matching only `assigned` let
     * `processing` tasks leak forever once their worker disappeared.
     */
    public function scopeTimedOut($query)
    {
        return $query->whereIn('status', [self::STATUS_ASSIGNED, self::STATUS_PROCESSING])
            ->whereNotNull('timeout_at')
            ->where('timeout_at', '<=', now());
    }
}
