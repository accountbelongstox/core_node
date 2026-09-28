<?php

namespace App\Models;

use App\Models\Concerns\UsesMainConnection;
use App\Models\Model;

class DownloadTask extends Model
{
    use UsesMainConnection;

    protected $fillable = [
        'url',
        'save_path',
        'filename',
        'status',
        'progress',
        'total_size',
        'downloaded_size',
        'error_message'
    ];

    protected function casts(): array
    {
        return [
            'total_size' => 'integer',
            'downloaded_size' => 'integer',
            'progress' => 'integer',
        ];
    }

    public function getProgressPercentageAttribute()
    {
        if ($this->total_size > 0) {
            return round(($this->downloaded_size / $this->total_size) * 100);
        }
        return 0;
    }

    public static function newestFirst()
    {
        return self::query()->orderByDesc('created_at')->get();
    }
} 
