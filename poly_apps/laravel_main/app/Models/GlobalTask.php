<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GlobalTask extends Model
{
    use HasFactory;

    protected $table = 'global_tasks';

    protected $fillable = [
        'task_id',
        'app_name',
        'task_type',
        'status',
        'progress',
        'payload',
        'steps',
        'result',
        'error',
        'queue_item_id',
    ];

    protected $casts = [
        'payload' => 'array',
        'steps' => 'array',
        'result' => 'array',
        'progress' => 'float',
    ];
}
