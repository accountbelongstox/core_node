<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-Language Article Library Model
 *
 * Operates on language-specific article library tables: {prefix}_{lang}_article_library
 * Used for article TTS generation, storage, and management
 * Table prefix is obtained from key center (AppTablePrefixServiceProvider)
 */
class AppQyV1ArticleLibraryModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
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
        // TTS generation process state (queue-less coordination).
        'tts_status',
        'tts_attempts',
        'tts_error',
        'tts_locked_at',
        'tts_locked_by',
        'tts_priority',
        'tts_requested_at',
        'tts_completed_at',
    ];

    protected $casts = [
        'audio_files' => 'array',
        'metadata' => 'array',
        'has_audio' => 'boolean',
        'added_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'tts_attempts' => 'integer',
        'tts_priority' => 'integer',
        'tts_locked_at' => 'datetime',
        'tts_requested_at' => 'datetime',
        'tts_completed_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);

        if (isset($attributes['lang_code'])) {
            $this->setLanguage($attributes['lang_code']);
        }
    }
    
    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function setLanguage(string $langCode): self
    {
        $this->langCode = strtolower($langCode);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, "{$this->langCode}_article_library");
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
        // Queue-less coordination: "queued" now means an unstale processing
        // claim on the article row itself (tts_status/tts_locked_at).
        $query = self::forLanguage($langCode)
            ->where('has_audio', false);

        if ($skipQueued) {
            $staleBefore = now()->subMinutes(10);
            $query->where(function ($q) use ($staleBefore) {
                $q->whereNull('tts_status')
                    ->orWhere('tts_status', 'pending')
                    ->orWhere(function ($qq) use ($staleBefore) {
                        $qq->where('tts_status', 'processing')
                            ->where('tts_locked_at', '<', $staleBefore);
                    });
            });
        }

        return $query->orderBy('added_at', 'desc')
            ->limit($limit)
            ->get();
    }

    public static function updateHasAudio(string $langCode, string $md5, bool $hasAudio): void
    {
        self::forLanguage($langCode)
            ->where('md5', $md5)
            ->update([
                'has_audio' => $hasAudio,
                'updated_at' => now()
            ]);
    }

    public static function aggregateStats(string $langCode): array
    {
        $model = self::forLanguage($langCode);
        $connectionName = $model->getConnectionName();
        $table = $model->getTable();

        if (!Schema::connection($connectionName)->hasTable($table)) {
            return ['articles' => 0, 'audio' => 0];
        }

        $row = $model->newQuery()
            ->selectRaw('COUNT(*) as articles, SUM(CASE WHEN has_audio = true THEN 1 ELSE 0 END) as audio')
            ->first();

        return [
            'articles' => (int) ($row->articles ?? 0),
            'audio' => (int) ($row->audio ?? 0),
        ];
    }
}
