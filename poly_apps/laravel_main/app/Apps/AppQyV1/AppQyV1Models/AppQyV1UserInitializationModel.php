<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class AppQyV1UserInitializationModel extends AppQyV1Model
{
    use HasFactory;

    
    protected ?string $appTableSuffix = 'user_initializations';
    
    protected $fillable = [
        'user_id',
        'occupation',
        'daily_words_target',
        'daily_study_time',
        'preferences',
        'is_initialized',
        'initialization_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'preferences' => 'array',
            'is_initialized' => 'boolean',
            'initialization_completed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function forUser(int $userId): ?self
    {
        return static::query()->where('user_id', $userId)->first();
    }

    public static function saveForUser(int $userId, array $attributes): self
    {
        return static::query()->updateOrCreate(['user_id' => $userId], $attributes);
    }
}
