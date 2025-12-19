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

class AppQyV1Article extends Model
{
    protected $connection = 'appqyv1';
    protected $table = 'app_qy_v1_articles';

    protected $fillable = [
        'article_id',
        'user_id',
        'title',
        'content',
        'language',
        'article_type',
        'source',
        'difficulty_level',
        'word_count',
        'unique_word_count',
        'sentence_count',
        'is_daily_reading',
        'reading_date',
        'task_id',
        'tts_generated',
        'metadata',
    ];

    protected $casts = [
        'is_daily_reading' => 'boolean',
        'tts_generated' => 'boolean',
        'reading_date' => 'date',
        'metadata' => 'array',
    ];

    /**
     * Get the words associated with this article
     */
    public function articleWords()
    {
        return $this->hasMany(AppQyV1ArticleWord::class, 'article_id', 'article_id');
    }

    /**
     * Create article from task data
     */
    public static function createFromTaskData(string $articleId, string $taskId, array $articleData): self
    {
        return self::create([
            'article_id' => $articleId,
            'user_id' => $articleData['user_id'],
            'task_id' => $taskId,
            'title' => $articleData['title'] ?? null,
            'content' => $articleData['article_text'],
            'language' => $articleData['language'],
            'article_type' => $articleData['article_type'] ?? 'general',
            'source' => $articleData['source'] ?? null,
            'difficulty_level' => $articleData['difficulty_level'] ?? null,
            'word_count' => $articleData['total_words'],
            'unique_word_count' => $articleData['unique_words'],
            'sentence_count' => $articleData['total_sentences'],
            'is_daily_reading' => $articleData['is_daily_reading'] ?? false,
            'reading_date' => $articleData['reading_date'] ?? null,
            'tts_generated' => true,
            'metadata' => [
                'sentence_audio_count' => count($articleData['sentence_audio_urls'] ?? []),
                'word_audio_count' => count($articleData['word_audio_urls'] ?? []),
            ],
        ]);
    }
}
