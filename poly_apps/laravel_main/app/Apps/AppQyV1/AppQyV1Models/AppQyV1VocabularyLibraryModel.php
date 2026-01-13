<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppQyV1VocabularyLibraryModel extends Model
{
    use HasFactory;

    protected $appKey = \App\Constants\AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = \App\Providers\AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
    }
    
    public function getConnectionName()
    {
        return \App\Providers\AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'name',
        'description',
        'language',
        'total_words',
        'is_public',
        'owner_user_id',
        'source',
        'difficulty_level',
        'category',
        'image_url',
        'is_recommended',
        'tags',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'is_recommended' => 'boolean',
        'tags' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function scopePublic($query)
    {
        return $query->where('is_public', 1);
    }

    public function scopeForLanguage($query, ?string $language)
    {
        if ($language) {
            $query->where('language', $language);
        }

        return $query;
    }

    /**
     * Get words belonging to this library
     */
    public function words()
    {
        return $this->hasMany(AppQyV1VocabularyItemModel::class, 'library_id');
    }

    /**
     * Get groups that use this library (many-to-many)
     */
    public function groups()
    {
        return $this->belongsToMany(
            AppQyV1WordGroupModel::class,
            \App\Providers\AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries'),
            'library_id',
            'group_id',
            'id',
            'id'
        )->withTimestamps()
         ->withPivot('added_at');
    }
}
