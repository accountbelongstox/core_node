<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppQyV1GroupLibraryModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries');
    }
    
    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

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
