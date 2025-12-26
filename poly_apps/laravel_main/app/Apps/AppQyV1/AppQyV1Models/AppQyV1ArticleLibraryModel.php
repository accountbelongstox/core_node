<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Multi-Language Article Library Model
 *
 * Operates on language-specific article library tables: app_qy_v1_{lang}_article_library
 * Used for article TTS generation, storage, and management
 */
class AppQyV1ArticleLibraryModel extends Model
{
    protected $connection = 'appqyv1';
    protected $table;
    protected $langCode;

    protected $fillable = [
        'content',
        'md5',
        'title',
        'source',
        'owner',
        'has_audio',
        'audio_files',
        'tts_provider',
        'metadata',
        'added_at',
    ];

    protected $casts = [
        'audio_files' => 'array',
        'metadata' => 'array',
        'has_audio' => 'boolean',
        'added_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        if (isset($attributes['lang_code'])) {
            $this->setLanguage($attributes['lang_code']);
        }
    }

    public function setLanguage(string $langCode): self
    {
        $this->langCode = strtolower($langCode);
        $this->table = "app_qy_v1_{$this->langCode}_article_library";
        return $this;
    }

    public function getLanguage(): ?string
    {
        return $this->langCode;
    }

    public static function forLanguage(string $langCode): self
    {
        $instance = new self();
        $instance->setLanguage($langCode);
        return $instance;
    }

    public static function findByMd5(string $langCode, string $md5)
    {
        return self::forLanguage($langCode)
            ->where('md5', $md5)
            ->first();
    }

    public static function findByContent(string $langCode, string $content)
    {
        $md5 = md5($content);
        return self::findByMd5($langCode, $md5);
    }

    public static function createOrFind(string $langCode, string $content, array $data = []): self
    {
        $md5 = md5($content);

        $existing = self::findByMd5($langCode, $md5);
        if ($existing) {
            return $existing;
        }

        $instance = self::forLanguage($langCode);
        $instance->content = $content;
        $instance->md5 = $md5;
        $instance->title = $data['title'] ?? null;
        $instance->source = $data['source'] ?? 'unknown';
        $instance->owner = $data['owner'] ?? 'system';
        $instance->has_audio = false;
        $instance->added_at = now();
        $instance->save();

        return $instance;
    }

    public function addAudioFiles(array $audioFiles): void
    {
        $this->audio_files = $audioFiles;
        $this->has_audio = !empty($audioFiles);
        $this->tts_provider = 'edge-tts';
        $this->save();
    }

    public function hasAudioFile(): bool
    {
        return !empty($this->audio_files);
    }

    public static function getArticlesWithoutAudio(string $langCode, int $limit = 10, bool $skipQueued = true): \Illuminate\Database\Eloquent\Collection
    {
        $query = self::forLanguage($langCode)
            ->where('has_audio', false);

        if ($skipQueued) {
            $queuedHashes = DB::connection('appqyv1')
                ->table('appqyv1_tts_queue')
                ->where('task_type', 'article')
                ->where('language', $langCode)
                ->whereIn('status', ['pending', 'processing'])
                ->pluck('content_hash')
                ->toArray();

            if (!empty($queuedHashes)) {
                $query->whereNotIn('md5', $queuedHashes);
            }
        }

        return $query->orderBy('added_at', 'desc')
            ->limit($limit)
            ->get();
    }

    public static function updateHasAudio(string $langCode, string $md5, bool $hasAudio): void
    {
        $table = "app_qy_v1_{$langCode}_article_library";

        DB::connection('appqyv1')
            ->table($table)
            ->where('md5', $md5)
            ->update([
                'has_audio' => $hasAudio,
                'updated_at' => now()
            ]);
    }
}
