<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppQyV1GroupWordModel extends Model
{
    protected $connection = 'appqyv1';
    protected $table = 'app_qy_v1_group_words';

    protected $fillable = [
        'group_id',
        'word_id',
        'language_code',
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

    public function word(): BelongsTo
    {
        return $this->belongsTo(AppQyV1VocabularyItemModel::class, 'word_id');
    }
}
