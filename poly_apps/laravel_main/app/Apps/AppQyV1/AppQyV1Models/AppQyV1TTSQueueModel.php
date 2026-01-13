<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1TTSQueueModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
    }

    /**
     * Override getConnectionName to ensure connection is set for static methods
     * This is critical for static methods like getStats(), addToQueue(), etc.
     */
    public function getConnectionName()
    {
        if (!$this->connection) {
            $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        }
        return $this->connection;
    }

    /**
     * Override getTable to ensure table name is set for static methods
     * This is critical for static methods like getStats(), addToQueue(), etc.
     */
    public function getTable()
    {
        if (!$this->table) {
            $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
        }
        return $this->table;
    }

    /**
     * Override newModelQuery to ensure connection and table are set for static queries
     * This is called when Model::where() is used in static context
     */
    public function newModelQuery()
    {
        // Ensure connection and table are set before creating query
        if (!$this->connection) {
            $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        }
        if (!$this->table) {
            $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
        }
        return parent::newModelQuery();
    }

    protected $fillable = [
        'task_type',
        'content_text',
        'content_hash',
        'word',
        'word_md5',
        'language',
        'status',
        'priority',
        'retry_count',
        'error_message',
        'audio_path',
        'audio_files',
        'metadata',
        'requested_at',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'audio_files' => 'array',
        'metadata' => 'array',
        'requested_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    const TYPE_WORD = 'word';
    const TYPE_SENTENCE = 'sentence';
    const TYPE_ARTICLE = 'article';

    const MAX_RETRIES = 3;

    /**
     * Add word to queue if not exists
     */
    public static function addToQueue(string $word, string $language, int $priority = 0): self
    {
        $md5 = md5($word);

        $existing = self::where('word_md5', $md5)
            ->where('language', $language)
            ->first();

        if ($existing) {
            if ($existing->status === self::STATUS_FAILED && $existing->retry_count < self::MAX_RETRIES) {
                $existing->status = self::STATUS_PENDING;
                $existing->retry_count++;
                $existing->error_message = null;
                $existing->requested_at = now();
                $existing->save();
            } else {
                $existing->requested_at = now();
                $existing->save();
            }

            return $existing;
        }

        return self::create([
            'word' => $word,
            'word_md5' => $md5,
            'language' => $language,
            'status' => self::STATUS_PENDING,
            'priority' => $priority,
            'retry_count' => 0,
            'requested_at' => now(),
        ]);
    }

    /**
     * Get next pending items for processing
     */
    public static function getNextBatch(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return self::where('status', self::STATUS_PENDING)
            ->orderBy('priority', 'desc')
            ->orderBy('requested_at', 'asc')
            ->limit($limit)
            ->get();
    }

    /**
     * Mark as processing
     */
    public function markAsProcessing(): void
    {
        $this->status = self::STATUS_PROCESSING;
        $this->started_at = now();
        $this->save();
    }

    /**
     * Mark as completed
     */
    public function markAsCompleted(string $audioPath): void
    {
        $this->status = self::STATUS_COMPLETED;
        $this->audio_path = $audioPath;
        $this->completed_at = now();
        $this->save();
    }

    /**
     * Mark as failed
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->status = self::STATUS_FAILED;
        $this->error_message = $errorMessage;
        $this->save();
    }

    /**
     * Check if can retry
     */
    public function canRetry(): bool
    {
        return $this->retry_count < self::MAX_RETRIES;
    }

    /**
     * Clean completed items older than specified days
     */
    public static function cleanCompleted(int $days = 7): int
    {
        return self::where('status', self::STATUS_COMPLETED)
            ->where('completed_at', '<', now()->subDays($days))
            ->delete();
    }

    /**
     * Get queue statistics
     */
    public static function getStats(): array
    {
        return [
            'pending' => self::where('status', self::STATUS_PENDING)->count(),
            'processing' => self::where('status', self::STATUS_PROCESSING)->count(),
            'completed' => self::where('status', self::STATUS_COMPLETED)->count(),
            'failed' => self::where('status', self::STATUS_FAILED)->count(),
            'total' => self::count(),
        ];
    }
}
