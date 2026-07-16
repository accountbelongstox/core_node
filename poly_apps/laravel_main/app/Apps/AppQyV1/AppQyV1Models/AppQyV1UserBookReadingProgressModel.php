<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1UserBookReadingProgressModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    protected $fillable = [
        'user_id',
        'source_key',
        'chapter_index',
        'verse_seq',
        'grain',
        'page',
    ];

    protected $casts = [
        'chapter_index' => 'integer',
        'verse_seq' => 'integer',
        'page' => 'integer',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_book_reading_progress');
    }
}
