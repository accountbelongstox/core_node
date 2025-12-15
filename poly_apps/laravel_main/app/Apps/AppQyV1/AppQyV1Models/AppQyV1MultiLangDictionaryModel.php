<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

class AppQyV1MultiLangDictionaryModel extends Model
{
    use HasFactory;

    protected $connection = 'AppQyV1';
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
        'is_exist_local' => 'boolean',
        'has_operations' => 'boolean',
        'last_modified' => 'datetime',
        'last_query_time' => 'datetime',
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
        
        if (!AppQyV1TableMaps::isLanguageSupported($this->langCode)) {
            throw new \InvalidArgumentException("Language code '{$this->langCode}' is not supported");
        }
        
        $this->table = AppQyV1TableMaps::getDictionaryTableName($this->langCode);
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

    public static function countAll(string $langCode): int
    {
        return self::forLanguage($langCode)->count();
    }

    public static function countByTranslation(string $langCode): int
    {
        $hasTranslationField = AppQyV1TableMaps::getDictionaryFieldName('has_translation');
        return self::forLanguage($langCode)->where($hasTranslationField, true)->count();
    }

    public function incrementQueryCount()
    {
        $queryCountField = AppQyV1TableMaps::getDictionaryFieldName('query_count');
        $lastQueryTimeField = AppQyV1TableMaps::getDictionaryFieldName('last_query_time');
        
        $this->increment($queryCountField);
        $this->update([$lastQueryTimeField => now()]);
    }

    public static function findByContent(string $langCode, string $content)
    {
        $contentField = AppQyV1TableMaps::getDictionaryFieldName('content');
        return self::forLanguage($langCode)->where($contentField, $content)->first();
    }

    public static function findByMd5(string $langCode, string $md5)
    {
        $md5Field = AppQyV1TableMaps::getDictionaryFieldName('md5');
        return self::forLanguage($langCode)->where($md5Field, $md5)->first();
    }

    public static function findMissingEntries(string $langCode, array $contentArray): array
    {
        $contentField = AppQyV1TableMaps::getDictionaryFieldName('content');
        $existingEntries = self::forLanguage($langCode)
            ->whereIn($contentField, $contentArray)
            ->pluck($contentField)
            ->toArray();
        return array_diff($contentArray, $existingEntries);
    }

    public static function createOrUpdate(string $langCode, array $data): self
    {
        $md5Field = AppQyV1TableMaps::getDictionaryFieldName('md5');
        $contentField = AppQyV1TableMaps::getDictionaryFieldName('content');

        if (!isset($data['md5'])) {
            $data['md5'] = md5($data['content']);
        }

        $existing = self::forLanguage($langCode)->where($md5Field, $data['md5'])->first();

        if ($existing) {
            $existing->update($data);
            return $existing;
        }

        if (!isset($data['has_translation'])) {
            $data['has_translation'] = false;
        }
        if (!isset($data['translations'])) {
            $data['translations'] = null;
        }
        if (!isset($data['tts_files'])) {
            $data['tts_files'] = [];
        }

        $instance = self::forLanguage($langCode);
        $instance->fill($data);
        $instance->save();

        return $instance;
    }

    public static function batchCreateOrUpdate(string $langCode, array $items): array
    {
        $results = [];
        foreach ($items as $item) {
            $results[] = self::createOrUpdate($langCode, $item);
        }
        return $results;
    }

    public static function getWordsNeedingTranslation(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        return self::forLanguage($langCode)
            ->where(function($query) {
                $query->where('has_translation', false)
                    ->orWhereNull('translations');
            })
            ->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }

    public static function getWordsNeedingTTS(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        return self::forLanguage($langCode)
            ->where(function($query) {
                $query->whereJsonLength('tts_files', '=', 0)
                    ->orWhereNull('tts_files');
            })
            ->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }

    public static function updateWord(string $langCode, string $md5, array $data): bool
    {
        $word = self::findByMd5($langCode, $md5);
        if ($word) {
            $word->update($data);
            return true;
        }
        return false;
    }

    public static function getTopQueried(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        $queryCountField = AppQyV1TableMaps::getDictionaryFieldName('query_count');
        return self::forLanguage($langCode)
            ->orderBy($queryCountField, 'desc')
            ->limit($limit)
            ->get();
    }

    public static function searchByContent(string $langCode, string $keyword, int $limit = 50): \Illuminate\Database\Eloquent\Collection
    {
        $contentField = AppQyV1TableMaps::getDictionaryFieldName('content');
        return self::forLanguage($langCode)
            ->where($contentField, 'LIKE', "%{$keyword}%")
            ->limit($limit)
            ->get();
    }

    public function addTranslation(string $targetLang, string $translation, ?string $provider = null): self
    {
        $translations = $this->translations ?? [];
        
        $translations[$targetLang] = [
            'text' => $translation,
            'provider' => $provider,
            'updated_at' => now()->toDateTimeString()
        ];
        
        $this->translations = $translations;
        $this->has_translation = true;
        $this->save();
        
        return $this;
    }

    public function addTTSFile(string $filePath, ?string $provider = null, array $metadata = []): self
    {
        $ttsFiles = $this->tts_files ?? [];
        
        $ttsFiles[] = [
            'path' => $filePath,
            'provider' => $provider,
            'metadata' => $metadata,
            'created_at' => now()->toDateTimeString()
        ];
        
        $this->tts_files = $ttsFiles;
        $this->tts_provider = $provider;
        $this->save();
        
        return $this;
    }
}
