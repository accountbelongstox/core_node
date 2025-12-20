<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1LanguageEnum;
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProficiencyLevelEnum;

class AppQyV1UserWordProgressModel extends Model
{
    protected $connection = 'appqyv1';
    protected $table = 'app_qy_v1_user_word_progress';

    protected $fillable = [
        'user_id',
        'word_id',
        'group_id',
        'language_code',
        'first_read_at',
        'last_read_at',
        'last_review_at',
        'next_review_at',
        'read_count',
        'review_count',
        'weight',
        'proficiency',
    ];

    protected $casts = [
        'first_read_at' => 'datetime',
        'last_read_at' => 'datetime',
        'last_review_at' => 'datetime',
        'next_review_at' => 'datetime',
        'read_count' => 'integer',
        'review_count' => 'integer',
        'weight' => 'integer',
        'proficiency' => 'decimal:2',
        'language_code' => AppQyV1LanguageEnum::class,
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $attributes = [
        'proficiency' => 0,
        'read_count' => 0,
        'review_count' => 0,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(AppQyV1VocabularyItemModel::class, 'word_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(AppQyV1WordGroupModel::class, 'group_id');
    }

    public function calculateNextReviewTime(): void
    {
        $level = AppQyV1ProficiencyLevelEnum::fromProficiency($this->proficiency);
        $this->next_review_at = now()->addDays($level->reviewIntervalDays());
    }

    public function getProficiencyLevelAttribute(): AppQyV1ProficiencyLevelEnum
    {
        return AppQyV1ProficiencyLevelEnum::fromProficiency($this->proficiency);
    }

    public function updateProficiency(bool $isCorrect): void
    {
        if ($isCorrect) {
            $this->proficiency = min(100, $this->proficiency + 5);
        } else {
            $this->proficiency = max(0, $this->proficiency - 10);
        }
    }

    /**
     * Scope: Get progress for specific user
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope: Get progress for specific group
     */
    public function scopeForGroup($query, int $groupId)
    {
        return $query->where('group_id', $groupId);
    }

    /**
     * Scope: Get words due for review
     */
    public function scopeDueForReview($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('next_review_at')
              ->orWhere('next_review_at', '<=', now());
        });
    }

    /**
     * Scope: Get words by proficiency level
     */
    public function scopeByProficiency($query, ?float $min = null, ?float $max = null)
    {
        if ($min !== null) {
            $query->where('proficiency', '>=', $min);
        }
        if ($max !== null) {
            $query->where('proficiency', '<=', $max);
        }
        return $query;
    }

    /**
     * Scope: Get mastered words (proficiency >= 90)
     */
    public function scopeMastered($query)
    {
        return $query->where('proficiency', '>=', 90);
    }

    /**
     * Scope: Get learning words (60 <= proficiency < 90)
     */
    public function scopeLearning($query)
    {
        return $query->whereBetween('proficiency', [60, 89.99]);
    }

    /**
     * Scope: Get struggling words (proficiency < 60)
     */
    public function scopeStruggling($query)
    {
        return $query->where('proficiency', '<', 60);
    }
}
