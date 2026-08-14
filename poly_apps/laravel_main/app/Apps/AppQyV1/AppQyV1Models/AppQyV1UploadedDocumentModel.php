<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Plain-text documents uploaded through POST /learning/upload, persisted so
 * the /vocabulary/document/{id}/extract-words and
 * /vocabulary/document/{id}/extract-sentences endpoints can re-process the
 * original content later.
 */
class AppQyV1UploadedDocumentModel extends Model
{
    public const BROWSE_SORT_KEYS = [
        'title',
        'language',
        'words',
        'uploaded',
    ];

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'uploaded_documents');
    }

    protected $fillable = [
        'user_id',
        'collection_id',
        'original_name',
        'language',
        'content',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'collection_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Wave A consolidation: collection_id now stores a vocabulary_libraries
     * id (the legacy column NAME is kept for API/byte compatibility; the
     * conversion migration remapped any pre-existing collection ids).
     */
    public function scopeBrowseOrder($query, string $sortKey, string $direction)
    {
        $order = strtolower($direction) === 'desc' ? 'desc' : 'asc';

        if ($sortKey === 'title') {
            $query->orderBy('original_name', $order);
        } elseif ($sortKey === 'language') {
            $query->orderBy('language', $order);
        } elseif ($sortKey === 'words') {
            $documentTable = $query->getModel()->getTable();
            $libraryModel = new AppQyV1VocabularyLibraryModel();
            $libraryTable = $libraryModel->getTable();
            $wordCountQuery = $libraryModel->newQuery()
                ->select('total_words')
                ->whereColumn("{$libraryTable}.id", "{$documentTable}.collection_id")
                ->limit(1);
            $query->orderBy($wordCountQuery, $order);
        } elseif ($sortKey === 'uploaded') {
            $query->orderBy('created_at', $order);
        } else {
            return $query->orderByDesc('created_at')->orderBy('id');
        }

        return $query->orderBy('id', $order);
    }

    public function library()
    {
        return $this->belongsTo(AppQyV1VocabularyLibraryModel::class, 'collection_id', 'id');
    }

    public static function deleteById(int $documentId): int
    {
        return self::query()->whereKey($documentId)->delete();
    }

    public static function findById(int $documentId): ?self
    {
        return self::query()->find($documentId);
    }

    public static function browseForUser(
        int $userId,
        ?string $language,
        ?string $search,
        string $sortKey,
        string $direction,
        int $perPage
    ) {
        $query = self::query()->where('user_id', $userId);

        if ($language !== null && $language !== '') {
            $query->where('language', $language);
        }
        if ($search !== null && $search !== '') {
            $query->where('original_name', 'like', '%' . $search . '%');
        }

        return $query->browseOrder($sortKey, $direction)->with('library')->paginate($perPage);
    }

    public static function findOwned(int $documentId, int $userId): ?self
    {
        return self::query()->whereKey($documentId)->where('user_id', $userId)->first();
    }
}
