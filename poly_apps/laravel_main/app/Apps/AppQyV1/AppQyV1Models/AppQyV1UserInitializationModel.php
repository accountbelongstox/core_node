<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppQyV1UserInitializationModel extends Model
{
    use HasFactory;

    protected $appKey = \App\Constants\AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = \App\Providers\AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_initializations');
    }
    
    public function getConnectionName()
    {
        return \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
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
}
