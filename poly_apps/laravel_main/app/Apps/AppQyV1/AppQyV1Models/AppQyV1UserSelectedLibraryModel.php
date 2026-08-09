<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Utils\RunsModelTransactions;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1UserSelectedLibraryModel extends Model
{
    use RunsModelTransactions;
    use HasFactory;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('USER_SELECTED_LIBRARIES');
    }

    protected $fillable = [
        'user_id',
        'collection_id',
        'lang_code',
        'is_active',
        'selected_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'collection_id' => 'integer',
        'is_active' => 'boolean',
        'selected_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Selected library. The column name collection_id is historical: it
     * stores a vocabulary_libraries id (vocabulary_collections was merged
     * into vocabulary_libraries by the Wave A/B consolidation and dropped).
     */
    public function collection()
    {
        return $this->belongsTo(AppQyV1VocabularyLibraryModel::class, 'collection_id', 'id');
    }

    public static function getUserSelectedLibraries(int $userId, ?string $langCode = null, bool $activeOnly = true)
    {
        $query = self::with('collection')
            ->where('user_id', $userId);

        if ($langCode) {
            $query->where('lang_code', $langCode);
        }

        if ($activeOnly) {
            $query->where('is_active', true);
        }

        return $query->orderBy('selected_at', 'desc')->get();
    }

    public static function selectLibrary(int $userId, int $collectionId, string $langCode)
    {
        return self::updateOrCreate(
            [
                'user_id' => $userId,
                'collection_id' => $collectionId,
            ],
            [
                'lang_code' => $langCode,
                'is_active' => true,
                'selected_at' => now(),
            ]
        );
    }

    public static function deselectLibrary(int $userId, int $collectionId)
    {
        return self::where('user_id', $userId)
            ->where('collection_id', $collectionId)
            ->update(['is_active' => false]);
    }
}
