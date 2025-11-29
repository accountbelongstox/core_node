<?php

namespace App\PassiveQueue;

use Illuminate\Database\Eloquent\Model;

class PassiveQueueJob extends Model
{
    protected $table = 'app_passive_queue_jobs';

    protected $fillable = [
        'job_class',
        'payload',
        'status',
        'attempts',
        'error_message',
        'available_at',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'available_at' => 'datetime',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
