<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

class AppQyV1VocabularyCollectionModel extends Model
{
    use HasFactory, SoftDeletes;

    protected $connection = 'appqyv1';
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = AppQyV1TableMaps::getTableName('app_qy_v1_VOCABULARY_COLLECTIONS');
    }

    protected $fillable = [
        'collection_name',
        'lang_code',
        'source_type',
        'owner_id',
        'is_public',
        'description',
        'total_words',
        'meta_data',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'total_words' => 'integer',
        'meta_data' => 'json',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(AppQyV1VocabularyItemModel::class, 'collection_id', 'id');
    }

    public function selectedByUsers()
    {
        return $this->hasMany(AppQyV1UserSelectedLibraryModel::class, 'collection_id', 'id');
    }

    public static function getPublicCollections(string $langCode = null)
    {
        $query = self::where('is_public', true);

        if ($langCode) {
            $query->where('lang_code', $langCode);
        }

        return $query->orderBy('collection_name')->get();
    }

    public static function getUserCollections(int $userId, string $langCode = null)
    {
        $query = self::where('owner_id', $userId);

        if ($langCode) {
            $query->where('lang_code', $langCode);
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    public function updateWordCount(): int
    {
        $count = $this->items()->count();
        $this->total_words = $count;
        $this->save();
        return $count;
    }
}
