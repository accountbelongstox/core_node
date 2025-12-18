<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppQyV1VocabularyLibraryModel extends Model
{
    use HasFactory;

    protected $connection = 'appqyv1';
    protected $table = 'app_qy_v1_vocabulary_libraries';

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
}
