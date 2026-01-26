<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Models\User;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1CoverImageService;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\DB;

class AppQyV1WordGroupModel extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The database connection name for the model.
     *
     * @var string
     */
    protected $appKey = AppKeys::APPQYV1;
    
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table;

    /**
     * Constructor to set connection and table name
     */
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('WORD_GROUPS');
    }
    
    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'gid',
        'uid',
        'gname',
        'gcontent',
        'gwords',
        'words_frequency',
        'cover_image_uuid',
        'cover_category',
        'cover_url',
        'thumbnail_url',
        'language',
        'is_language_default',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'gwords' => 'array',
        'words_frequency' => 'array',
        'is_language_default' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::created(function (AppQyV1WordGroupModel $group) {
            if (!$group->cover_image_uuid) {
                $group->generateCoverImage();
            }
        });
    }

    /**
     * Get the user that owns the word group.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'uid');
    }

    /**
     * Get group words (many-to-many relationship)
     */
    public function groupWords()
    {
        return $this->hasMany(AppQyV1GroupWordModel::class, 'group_id');
    }

    /**
     * Get words through group_words pivot table
     */
    public function words()
    {
        return $this->belongsToMany(
            AppQyV1VocabularyItemModel::class,
            AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_words'),
            'group_id',
            'word_id',
            'id',
            'id'
        )->withTimestamps()
         ->withPivot('language_code', 'added_at')
         ->using(AppQyV1GroupWordModel::class);
    }

    /**
     * Get libraries through group_libraries pivot table
     */
    public function libraries()
    {
        return $this->belongsToMany(
            AppQyV1VocabularyLibraryModel::class,
            AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries'),
            'group_id',
            'library_id',
            'id',
            'id'
        )->withTimestamps()
         ->withPivot('added_at')
         ->using(AppQyV1GroupLibraryModel::class);
    }

    /**
     * Get user progress for this group
     */
    public function userProgress()
    {
        return $this->hasMany(AppQyV1UserWordProgressModel::class, 'group_id');
    }

    /**
     * Scope: Get groups for a specific user
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('uid', $userId);
    }

    /**
     * Scope: Get group by gid
     */
    public function scopeByGid($query, string $gid)
    {
        return $query->where('gid', $gid);
    }

    /**
     * Get words array from gwords text field
     *
     * @return array
     */
    public function getWordsArray() : array | string
    {
        if (empty($this->gwords)) {
            return [];
        }
        return $this->gwords;
    }

    /**
     * Add words to already read words
     *
     * @param array|string $words
     * @return void
     */
    public function addToWordsFrequency($words): void
    {
        $currentWords = $this->words_frequency ?? [];
        $newWords = is_array($words) ? $words : explode(',', $words);
        $this->words_frequency = array_values(array_unique(array_merge($currentWords, array_filter(array_map('trim', $newWords)))));
    }

    /**
     * Remove words from words frequency
     *
     * @param array|string $words
     * @return void
     */
    public function removeFromWordsFrequency($words): void
    {
        $currentWords = $this->words_frequency ?? [];
        $wordsToRemove = is_array($words) ? $words : explode(',', $words);
        $this->words_frequency = array_values(array_diff($currentWords, array_filter(array_map('trim', $wordsToRemove))));
    }

    /**
     * Generate cover image for this group
     */
    public function generateCoverImage(): bool
    {
        $category = AppQyV1CoverImageService::inferCategory($this->gname);

        $wordCount = $this->groupWords()->count();

        $result = AppQyV1CoverImageService::generateGroupCover(
            $this->gname,
            $category,
            $wordCount,
            true
        );

        if ($result['success']) {
            $this->cover_image_uuid = $result['uuid'];
            $this->cover_category = $result['category'];
            $this->cover_url = $result['main']['url'];
            $this->thumbnail_url = $result['thumbnail']['url'] ?? null;
            $this->saveQuietly();  // Save without triggering events

            return true;
        }

        return false;
    }
}
