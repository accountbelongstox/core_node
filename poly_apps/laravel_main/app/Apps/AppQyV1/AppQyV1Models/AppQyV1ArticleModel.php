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

use App\Utils\RunsModelTransactions;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1ArticleModel extends Model
{
    use RunsModelTransactions;

    public const TYPE_DAILY = 'daily';
    public const SOURCE_AGENT_HISTORY = 'agent_history';

    protected $appKey = AppKeys::APPQYV1;
    protected $table;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'articles');
    }

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

    public function isAgentHistoryDaily(): bool
    {
        return $this->source === self::SOURCE_AGENT_HISTORY
            && $this->article_type === self::TYPE_DAILY;
    }

    public function scopeSentenceAudioQueueEligible($query)
    {
        return $query->where(function ($eligibleQuery): void {
            $eligibleQuery
                ->whereNull('source')
                ->orWhere('source', '<>', self::SOURCE_AGENT_HISTORY)
                ->orWhereNull('article_type')
                ->orWhere('article_type', '<>', self::TYPE_DAILY);
        });
    }

    public function sentenceAudioScope(): string
    {
        return $this->article_type === self::TYPE_DAILY || (bool) $this->is_daily_reading
            ? self::TYPE_DAILY
            : self::SOURCE_AGENT_HISTORY;
    }

    /**
     * Get the words associated with this article
     */
    public function articleWords()
    {
        return $this->hasMany(AppQyV1ArticleWordModel::class, 'article_id', 'article_id');
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
