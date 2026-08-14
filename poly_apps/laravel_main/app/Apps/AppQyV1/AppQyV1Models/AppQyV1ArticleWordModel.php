<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;

class AppQyV1ArticleWordModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'article_words');
    }
    
    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'article_id',
        'word_md5',
        'word',
        'language',
        'frequency',
        'is_new_for_user',
    ];

    protected $casts = [
        'is_new_for_user' => 'boolean',
    ];

    /**
     * Get the article that owns this word
     */
    public function article()
    {
        return $this->belongsTo(AppQyV1ArticleModel::class, 'article_id', 'article_id');
    }

    /**
     * Get the dictionary entry for this word
     */
    public function dictionaryEntry(string $langCode)
    {
        return AppQyV1MultiLangDictionaryModel::forLanguage($langCode)
            ->where('md5', $this->word_md5)
            ->first();
    }

    /**
     * Batch create article words
     * Uses DictionaryService to handle dictionary operations
     */
    public static function createFromArticleWords(string $articleId, array $words, array $wordFrequency, string $language): array
    {
        $langCode = self::mapLanguageToCode($language);
        $now = now();

        $insertData = [];
        $dictionaryWords = [];

        $dictionaryInfo = AppQyV1DictionaryService::queryAndAdd($language, $words);

        foreach ($words as $word) {
            // Canonical key convention: raw md5($content), matching the
            // dictionary tts_cache_{lang}.md5 column so dictionaryEntry() joins.
            $wordMd5 = md5($word);
            $frequency = $wordFrequency[$word] ?? 1;

            $insertData[] = [
                'article_id' => $articleId,
                'word_md5' => $wordMd5,
                'word' => $word,
                'language' => $langCode,
                'frequency' => $frequency,
                'is_new_for_user' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (!empty($insertData)) {
            self::insert($insertData);
        }

        return $dictionaryInfo;
    }

    /**
     * Normalize a language name OR code to the canonical CODE (§2 — codes only).
     * Delegates to AppQyV1TableMaps::normalizeLangCode so a code passes through
     * unchanged (the article pipeline now sends codes); falls back to 'en'.
     */
    private static function mapLanguageToCode(string $language): string
    {
        $code = AppQyV1TableMaps::normalizeLangCode($language);
        return $code !== '' ? $code : 'en';
    }

    public static function deleteForArticle(string $articleId): int
    {
        return self::query()->where('article_id', $articleId)->delete();
    }
}
