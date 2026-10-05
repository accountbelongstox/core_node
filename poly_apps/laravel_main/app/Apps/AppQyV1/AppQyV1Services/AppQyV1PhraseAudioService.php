<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangPhraseModel as LangPhrase;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Services\WorkLeases\WorkLeaseLanes;
use App\Services\WorkLeases\WorkLeaseService;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;

/**
 * Phrase audio surface (lane phrase_audio, docs_fix/DESIGN_PHRASE_PIPELINE.md §5):
 * the content-keyed report a node delivers a phrase clip through and the
 * file-first resolve. The file at PathMapper::getAppQyV1PhraseSoundsDir()
 * "<lang>/<content_id>.mp3" is the source of truth; has_audio/audio cache it.
 * Phrase audio has no quality floor (CPU engines are accepted).
 */
final class AppQyV1PhraseAudioService
{
    /** Public serve route of the phrase sounds dir (routes/static.php). */
    public const URL_PREFIX = '/static/app_qy_v1/phrase_sounds/';
    public const MIN_AUDIO_BYTES = 100;
    private const AUDIO_EXTENSION = '.mp3';
    private const STATUS_PENDING = 'pending';
    private const STATUS_COMPLETED = 'completed';
    private const STATUS_FAILED = 'failed';
    private const ERROR_MAX_CHARS = 2000;
    private const PROVIDER_MAX_CHARS = 100;

    /** @var array<string,bool> phrase table existence per language (one probe per worker) */
    private static array $tables = [];

    /** "<lang>/<content_id>.mp3" relative to the phrase sounds dir. */
    public static function relativePathFor(string $language, string $contentId): string
    {
        return $language . '/' . $contentId . self::AUDIO_EXTENSION;
    }

    /** Server-relative public URL of a relative phrase audio path. */
    public static function urlFor(string $relativePath): string
    {
        return self::URL_PREFIX . ltrim($relativePath, '/');
    }

    public static function fullPathFor(string $relativePath): string
    {
        return PathMapper::getAppQyV1PhraseSoundsDir($relativePath);
    }

    /**
     * Ingests one node-reported phrase result (audio_phrase_report). Success writes the MP3 once
     * (a file already on disk acks already_done and is never clobbered), marks the row done,
     * clears the lease, notes the completion and emits clip.ready. An unknown phrase reported
     * with its text is created (origin adhoc). Failure clears the lease and spends one attempt,
     * unless the error is a contract repool code (back to the pool, no attempt).
     *
     * @return array{ok:bool,status:string,http_status:int,already_done?:bool,audio_url?:string,error?:string}
     */
    public function report(string $contentId, string $language, string $workerId, bool $success, ?string $audioBinary, ?string $provider, ?string $error, ?string $text): array
    {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        $contentId = strtolower(trim($contentId));
        $text = trim((string) $text);
        $relativePath = '';
        $fullPath = '';

        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'status' => 'not_found', 'error' => __('app_qy_v1.messages.phrase_audio_unknown_language', ['language' => $language]), 'http_status' => 422];
        }
        $phrase = LangPhrase::findByContentId($language, $contentId);
        if ($phrase === null && $success && $text !== '') {
            if (!hash_equals(MediaIngestService::computeContentId($text), $contentId)) {
                return ['ok' => false, 'status' => 'invalid', 'error' => __('audio_orchestration.content_id_mismatch'), 'http_status' => 422];
            }
            $phrase = $this->ensureRow($language, $contentId, $text);
        }
        if ($phrase === null) {
            return ['ok' => false, 'status' => 'not_found', 'error' => __('app_qy_v1.messages.phrase_audio_not_found', ['content_id' => $contentId]), 'http_status' => 404];
        }

        if (!$success) {
            $phrase->fill(WorkLeaseService::clearedLease());
            if (WorkLeaseService::isRepoolError($error)) {
                $phrase->tts_status = self::STATUS_PENDING;
            } else {
                $phrase->tts_error = mb_substr($error ?: (string) __('app_qy_v1.messages.phrase_audio_worker_failed'), 0, self::ERROR_MAX_CHARS);
                $phrase->tts_attempts = (int) $phrase->tts_attempts + 1;
                $phrase->tts_status = $phrase->tts_attempts >= AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS ? self::STATUS_FAILED : self::STATUS_PENDING;
            }
            $phrase->saveRecord();

            return ['ok' => true, 'status' => (string) $phrase->tts_status, 'http_status' => 200];
        }

        $relativePath = self::relativePathFor($language, $contentId);
        $fullPath = self::fullPathFor($relativePath);
        clearstatcache(true, $fullPath);
        if (is_file($fullPath) && filesize($fullPath) > 0) {
            $this->markDone($phrase, $relativePath, null);
            $this->announce($language, $contentId);

            return ['ok' => true, 'status' => self::STATUS_COMPLETED, 'already_done' => true, 'audio_url' => self::urlFor($relativePath), 'http_status' => 200];
        }

        if ($audioBinary === null || strlen($audioBinary) < self::MIN_AUDIO_BYTES || !AppQyV1DictionaryTTSCoordinator::looksLikeMp3($audioBinary)) {
            $phrase->fill(WorkLeaseService::clearedLease());
            $phrase->tts_error = (string) __('app_qy_v1.messages.phrase_audio_payload_invalid', ['min' => self::MIN_AUDIO_BYTES]);
            $phrase->tts_attempts = (int) $phrase->tts_attempts + 1;
            $phrase->tts_status = $phrase->tts_attempts >= AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS ? self::STATUS_FAILED : self::STATUS_PENDING;
            $phrase->saveRecord();

            return ['ok' => false, 'status' => 'invalid', 'error' => (string) $phrase->tts_error, 'http_status' => 422];
        }

        clearstatcache(true, $fullPath);
        if (!FileSystemManager::writeFileAtomic($fullPath, $audioBinary) || !is_file($fullPath) || filesize($fullPath) !== strlen($audioBinary)) {
            return ['ok' => false, 'status' => 'error', 'error' => __('app_qy_v1.messages.phrase_audio_persist_failed', ['path' => $relativePath]), 'http_status' => 500];
        }
        $this->markDone($phrase, $relativePath, $provider ?: ('worker:' . $workerId));
        WorkLeaseService::noteCompletion($workerId);
        $this->announce($language, $contentId);
        Log::info('[PhraseAudio] node result accepted', ['content_id' => $contentId, 'language' => $language, 'worker' => $workerId, 'bytes' => strlen($audioBinary)]);

        return ['ok' => true, 'status' => self::STATUS_COMPLETED, 'audio_url' => self::urlFor($relativePath), 'http_status' => 200];
    }

    /**
     * File-first resolve of one phrase (audio_phrase_audio) by content_id or text. A missing
     * clip is promoted to the front of lane phrase_audio unless $passive (an unknown phrase with
     * its text is created first, origin adhoc).
     *
     * @return array{success:bool,exists:bool,content_id:string,language:string,url?:string,path?:string,queued?:bool,tts_status?:?string,error?:string}
     */
    public function resolve(?string $contentId, ?string $text, string $language, bool $passive): array
    {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        $text = trim((string) $text);
        $contentId = $text !== '' ? MediaIngestService::computeContentId($text) : strtolower(trim((string) $contentId));
        $base = ['content_id' => $contentId, 'language' => $language];
        $phrase = null;
        $relativePath = self::relativePathFor($language, $contentId);
        $fullPath = self::fullPathFor($relativePath);
        $promoted = false;

        if ($language === '' || !$this->tableExists($language)) {
            return $base + ['success' => false, 'exists' => false, 'error' => __('app_qy_v1.messages.phrase_audio_unknown_language', ['language' => $language])];
        }
        $phrase = LangPhrase::findByContentId($language, $contentId);
        clearstatcache(true, $fullPath);
        if (is_file($fullPath) && filesize($fullPath) > 0) {
            if ($phrase !== null && (!$phrase->has_audio || $phrase->audio !== $relativePath)) {
                $this->markDone($phrase, $relativePath, null);
            }

            return $base + ['success' => true, 'exists' => true, 'url' => self::urlFor($relativePath), 'path' => $fullPath, 'tts_status' => $phrase?->tts_status ?? self::STATUS_COMPLETED];
        }
        if (!$passive) {
            if ($phrase === null && $text !== '') {
                $phrase = $this->ensureRow($language, $contentId, $text);
            }
            if ($phrase !== null) {
                $promoted = app(WorkLeaseService::class)->promote(WorkLeaseLanes::PHRASE_AUDIO, $language, $contentId);
            }
            if ($promoted) {
                app(QueueCenterRealtimeService::class)->publishWorkNodes('pool');
            }
        }

        return $base + ['success' => false, 'exists' => false, 'queued' => $promoted, 'tts_status' => $phrase?->tts_status, 'error' => __('app_qy_v1.messages.phrase_audio_missing', ['content_id' => $contentId])];
    }

    /** Marks the row done for the clip at $relativePath and clears its lease (provider null keeps the stored one). */
    private function markDone(LangPhrase $phrase, string $relativePath, ?string $provider): void
    {
        $phrase->fill(WorkLeaseService::clearedLease());
        $phrase->audio = $relativePath;
        $phrase->has_audio = true;
        $phrase->tts_status = self::STATUS_COMPLETED;
        $phrase->tts_error = null;
        $phrase->tts_completed_at ??= now();
        if ($provider !== null) {
            $phrase->audio_files = [[
                'path' => $relativePath,
                'has_file' => true,
                'provider' => mb_substr($provider, 0, self::PROVIDER_MAX_CHARS),
                'uploaded_at' => now()->toIso8601String(),
            ]];
        }
        $phrase->saveRecord();
    }

    /** clip.ready for the phrase resource id sha256("phrase:<lang>:<content_id>"). */
    private function announce(string $language, string $contentId): void
    {
        AppQyV1ClipReadyPublisher::publish(WorkLeaseLanes::resourceKind(WorkLeaseLanes::PHRASE_AUDIO), $language, $contentId);
    }

    /** Creates an unknown phrase from its text (origin adhoc; a concurrent insert wins) and returns the row. */
    private function ensureRow(string $language, string $contentId, string $text): ?LangPhrase
    {
        $now = now();

        LangPhrase::onLang($language)->insertOrIgnore([
            'content_id' => $contentId,
            'text' => $text,
            'language' => $language,
            'origin' => LangPhrase::ORIGIN_ADHOC,
            'has_audio' => false,
            'tts_status' => self::STATUS_PENDING,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return LangPhrase::findByContentId($language, $contentId);
    }

    private function tableExists(string $language): bool
    {
        return self::$tables[$language] ??= LangPhrase::tableExists($language);
    }
}
