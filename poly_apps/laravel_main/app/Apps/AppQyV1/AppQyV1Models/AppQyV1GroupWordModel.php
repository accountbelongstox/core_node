<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppQyV1GroupWordModel extends Model
{
    protected $appKey = \App\Constants\AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = \App\Providers\AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_words');
    }
    
    public function getConnectionName()
    {
        return \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

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
