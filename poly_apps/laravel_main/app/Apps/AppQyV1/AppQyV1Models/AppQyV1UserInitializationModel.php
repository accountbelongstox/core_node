<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppQyV1UserInitializationModel extends Model
{
    use HasFactory;

    protected $connection = 'AppQyV1';
    protected $table = 'app_qy_v1_user_initializations';

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
