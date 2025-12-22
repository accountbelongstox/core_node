<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppQyV1GroupLibraryModel extends Model
{
    protected $connection = 'appqyv1';
    protected $table = 'app_qy_v1_group_libraries';

    protected $fillable = [
        'group_id',
        'library_id',
        'added_at',
    ];

    protected $casts = [
        'added_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(AppQyV1WordGroupModel::class, 'group_id');
    }

    public function library(): BelongsTo
    {
        return $this->belongsTo(AppQyV1VocabularyLibraryModel::class, 'library_id');
    }
}
