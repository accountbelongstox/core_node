<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;

class AppQyV1ArticleWord extends Model
{
    protected $connection = 'appqyv1';
    protected $table = 'app_qy_v1_article_words';

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
        return $this->belongsTo(AppQyV1Article::class, 'article_id', 'article_id');
    }

    /**
     * Get the dictionary entry for this word
     */
    public function dictionaryEntry(string $langCode)
    {
        return AppQyV1MultiLangDictionaryModel::query()
            ->connection('appqyv1')
            ->from(AppQyV1TableMaps::getDictionaryTableName($langCode))
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
            $wordMd5 = md5(strtolower($word));
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
            DB::connection('appqyv1')->table('app_qy_v1_article_words')->insert($insertData);
        }

        return $dictionaryInfo;
    }

    /**
     * Map language name to code
     */
    private static function mapLanguageToCode(string $language): string
    {
        $languageMap = [
            'english' => 'en',
            'chinese' => 'zh',
            'spanish' => 'es',
            'french' => 'fr',
            'german' => 'de',
            'japanese' => 'ja',
            'korean' => 'ko',
        ];

        return $languageMap[strtolower($language)] ?? 'en';
    }
}
