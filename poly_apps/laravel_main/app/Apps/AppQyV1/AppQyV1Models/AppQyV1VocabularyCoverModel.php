<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1VocabularyCoverModel extends Model
{
    use HasFactory;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
    }

    protected $fillable = [
        'library_id',
        'cover_filename',
        'status',
        'prompt',
        'description',
        'priority',
        'attempts',
        'error_message',
        'width',
        'height',
        'last_requested_at',
        'last_generated_at',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'priority' => 'integer',
        'attempts' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'last_requested_at' => 'datetime',
        'last_generated_at' => 'datetime',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
