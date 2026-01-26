<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppQyV1VocabularyWordModel extends Model
{
    use HasFactory;

    protected $appKey = \App\Constants\AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = \App\Providers\AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_words');
    }
    
    public function getConnectionName()
    {
        return \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'library_id',
        'word_index',
        'word',
    ];

    protected $casts = [
        'library_id' => 'integer',
        'word_index' => 'integer',
        'created_at' => 'datetime',
    ];

    public function library()
    {
        return $this->belongsTo(AppQyV1VocabularyLibraryModel::class, 'library_id');
    }
}

