<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DownloadTask extends Model
{
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

    protected $casts = [
        'total_size' => 'integer',
        'downloaded_size' => 'integer',
        'progress' => 'integer',
    ];

    public function getProgressPercentageAttribute()
    {
        if ($this->total_size > 0) {
            return round(($this->downloaded_size / $this->total_size) * 100);
        }
        return 0;
    }
} 