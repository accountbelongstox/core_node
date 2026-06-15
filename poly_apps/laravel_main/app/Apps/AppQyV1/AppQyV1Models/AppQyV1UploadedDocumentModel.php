<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
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
    public function library()
    {
        return $this->belongsTo(AppQyV1VocabularyLibraryModel::class, 'collection_id', 'id');
    }
}
