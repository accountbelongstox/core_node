<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1UserInitializationModel extends Model
{
    use HasFactory;

    protected $appKey = AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_initializations');
    }
    
    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'user_id',
        'occupation',
        'daily_words_target',
        'daily_study_time',
        'preferences',
        'is_initialized',
        'initialization_completed_at',
    ];

    protected $casts = [
        'preferences' => 'array',
        'is_initialized' => 'boolean',
        'initialization_completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function forUser(int $userId): ?self
    {
        return static::query()->where('user_id', $userId)->first();
    }

    public static function saveForUser(int $userId, array $attributes): self
    {
        return static::query()->updateOrCreate(['user_id' => $userId], $attributes);
    }
}
