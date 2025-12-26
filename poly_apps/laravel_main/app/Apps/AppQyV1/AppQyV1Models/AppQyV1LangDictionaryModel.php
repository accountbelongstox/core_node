<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Multi-Language Dictionary Model
 *
 * Operates on language-specific dictionary tables: app_qy_v1_{lang}_dictionaries
 * Used for TTS caching, translations, and word metadata
 */
class AppQyV1LangDictionaryModel extends Model
{
    protected $connection = 'appqyv1';
    protected $table;
    protected $langCode;

    protected $fillable = [
        'content',
        'md5',
        'translations',
        'has_translation',
        'translation_provider',
        'phonetic',
        'us_phonetic',
        'uk_phonetic',
        'tts_files',
        'tts_provider',
        'has_audio',
        'image_files',
        'image_provider',
        'word_details',
        'is_exist_local',
        'has_operations',
        'query_count',
        'last_modified',
        'last_query_time',
    ];

    protected $casts = [
        'translations' => 'json',
        'tts_files' => 'json',
        'image_files' => 'json',
        'word_details' => 'json',
        'has_translation' => 'boolean',
        'has_audio' => 'boolean',
        'is_exist_local' => 'boolean',
        'has_operations' => 'boolean',
        'query_count' => 'integer',
        'last_modified' => 'datetime',
        'last_query_time' => 'datetime',
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
        $this->table = "app_qy_v1_{$this->langCode}_dictionaries";
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

    public static function createOrFind(string $langCode, string $content): self
    {
        $md5 = md5($content);

        $existing = self::findByMd5($langCode, $md5);
        if ($existing) {
            return $existing;
        }

        $instance = self::forLanguage($langCode);
        $instance->content = $content;
        $instance->md5 = $md5;
        $instance->has_translation = false;
        $instance->query_count = 0;
        $instance->save();

        return $instance;
    }

    public static function updateWord(string $langCode, string $md5, array $data): void
    {
        $table = "app_qy_v1_{$langCode}_dictionaries";

        DB::connection('appqyv1')
            ->table($table)
            ->where('md5', $md5)
            ->update(array_merge($data, ['updated_at' => now()]));
    }

    public function incrementQueryCount(): void
    {
        $this->increment('query_count');
        $this->update(['last_query_time' => now()]);
    }

    public function addTTSFile(string $path, string $speedKey = 'p0pct', string $type = 'word'): void
    {
        $ttsFiles = $this->tts_files ?? [];

        $ttsFiles[] = [
            'path' => $path,
            'speed_key' => $speedKey,
            'type' => $type,
            'provider' => 'edge-tts',
            'created_at' => now()->toDateTimeString(),
        ];

        $this->tts_files = $ttsFiles;
        $this->tts_provider = 'edge-tts';
        $this->save();
    }

    public function getTTSFile(string $speedKey = 'p0pct'): ?array
    {
        if (empty($this->tts_files)) {
            return null;
        }

        foreach ($this->tts_files as $ttsFile) {
            if (isset($ttsFile['speed_key']) && $ttsFile['speed_key'] === $speedKey) {
                return $ttsFile;
            }
        }

        return null;
    }

    public function hasTTSFile(string $speedKey = 'p0pct'): bool
    {
        return $this->getTTSFile($speedKey) !== null;
    }

    public static function getWordsWithoutTTS(string $langCode, int $limit = 20, bool $skipQueued = true): \Illuminate\Database\Eloquent\Collection
    {
        $query = self::forLanguage($langCode)
            ->where('has_audio', false);

        if ($skipQueued) {
            $queuedHashes = DB::connection('appqyv1')
                ->table('appqyv1_tts_queue')
                ->where('task_type', 'word')
                ->where('language', $langCode)
                ->whereIn('status', ['pending', 'processing'])
                ->pluck('content_hash')
                ->toArray();

            if (!empty($queuedHashes)) {
                $query->whereNotIn('md5', $queuedHashes);
            }
        }

        return $query->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }
}
