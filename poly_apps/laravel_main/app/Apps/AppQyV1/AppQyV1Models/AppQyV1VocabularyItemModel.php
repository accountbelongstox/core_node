<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

class AppQyV1VocabularyItemModel extends Model
{
    use HasFactory;

    protected $connection = 'appqyv1';
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = AppQyV1TableMaps::getTableName('app_qy_v1_VOCABULARY_ITEMS');
    }

    protected $fillable = [
        'collection_id',
        'lang_code',
        'word_content',
        'word_md5',
        'word_index',
        'extra_data',
    ];

    protected $casts = [
        'collection_id' => 'integer',
        'word_index' => 'integer',
        'extra_data' => 'json',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function collection()
    {
        return $this->belongsTo(AppQyV1VocabularyCollectionModel::class, 'collection_id', 'id');
    }

    public static function getWordsForCollection(int $collectionId, int $limit = null, int $offset = 0)
    {
        $query = self::where('collection_id', $collectionId)
            ->orderBy('word_index');

        if ($limit) {
            $query->limit($limit)->offset($offset);
        }

        return $query->get();
    }

    public static function createBatch(int $collectionId, string $langCode, array $words)
    {
        $items = [];
        $timestamp = now();

        foreach ($words as $index => $word) {
            $items[] = [
                'collection_id' => $collectionId,
                'lang_code' => $langCode,
                'word_content' => $word,
                'word_md5' => md5($word),
                'word_index' => $index,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        return self::insert($items);
    }
}
