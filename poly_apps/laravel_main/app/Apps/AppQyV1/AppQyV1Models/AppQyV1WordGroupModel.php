<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Models\User;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1CoverImageService;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Utils\RunsModelTransactions;
use Illuminate\Support\Facades\Cache;

class AppQyV1WordGroupModel extends Model
{
    use HasFactory, RunsModelTransactions, SoftDeletes;

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

    public static function cachedForUserByGid(int $userId, string $gid): ?self
    {
        return Cache::remember(
            "word_group:{$userId}:{$gid}",
            now()->addMinutes(10),
            fn () => self::query()->where('gid', $gid)->where('uid', $userId)->first()
        );
    }

    public static function cachedForUserByName(int $userId, string $name): ?self
    {
        return Cache::remember(
            "word_group_by_name:{$userId}:{$name}",
            now()->addMinutes(10),
            fn () => self::query()->where('gname', $name)->where('uid', $userId)->first()
        );
    }

    public static function findOwnedByReference(int $userId, string $reference): ?self
    {
        return self::query()
            ->where('uid', $userId)
            ->where(function ($query) use ($reference): void {
                $query->where('gid', $reference);
                if (ctype_digit($reference)) {
                    $query->orWhere('id', (int) $reference);
                }
            })
            ->first();
    }

    public static function findOwnedByGid(int $userId, string $gid): ?self
    {
        return static::query()->where('gid', $gid)->where('uid', $userId)->first();
    }

    public static function findOwnedByName(int $userId, string $name): ?self
    {
        return static::query()->where('gname', $name)->where('uid', $userId)->first();
    }

    public static function findByGid(string $gid, array $columns = ['*']): ?self
    {
        return static::query()->where('gid', $gid)->first($columns);
    }

    public static function findByNameOwner(string $name, ?int $userId, ?string $username): ?self
    {
        $query = static::query()->where('gname', $name);

        if ($userId !== null) {
            $query->where('uid', $userId);
        } elseif ($username !== null) {
            $query->where('username', $username);
        } else {
            return null;
        }

        return $query->first();
    }

    public static function pageWithProgress(?int $userId, int $start, int $limit, array $columns)
    {
        $query = static::query()->select($columns)->with('wordProgress:id,group_id,total_words');

        if ($userId !== null) {
            $query->where('uid', $userId);
        }

        return $query->orderByDesc('created_at')->skip($start)->take($limit)->get();
    }

    public static function userPageWithProgress(int $userId, int $start, int $limit)
    {
        return self::forUser($userId)
            ->select(['id', 'gid', 'gname', 'gwords', 'words_frequency', 'created_at', 'updated_at', 'uid'])
            ->with('wordProgress:id,group_id,total_words')
            ->orderByDesc('created_at')
            ->skip($start)
            ->take($limit)
            ->get();
    }

    public static function languageDefault(int $userId, string $language): ?self
    {
        return static::query()
            ->where('uid', $userId)
            ->where('language', $language)
            ->where('is_language_default', true)
            ->first();
    }

    public static function languageDefaultsForUsers(array $userIds)
    {
        return static::query()
            ->whereIn('uid', array_values(array_unique($userIds)))
            ->where('is_language_default', true)
            ->get();
    }

    public static function legacyDefault(int $userId, string $name): ?self
    {
        return static::query()->where('uid', $userId)->where('gname', $name)->first();
    }

    public static function legacyDefaultsForUsers(array $userIds, string $name)
    {
        return static::query()
            ->whereIn('uid', array_values(array_unique($userIds)))
            ->where('gname', $name)
            ->get();
    }

    public static function forUserLanguage(int $userId, string $language)
    {
        return static::query()
            ->where('uid', $userId)
            ->where('language', $language)
            ->orderByDesc('is_language_default')
            ->orderBy('created_at')
            ->get();
    }

    public static function touchById(int $groupId): int
    {
        return static::query()->whereKey($groupId)->update(['updated_at' => now()]);
    }

    public static function lockById(int $groupId): self
    {
        return self::query()->whereKey($groupId)->lockForUpdate()->firstOrFail();
    }

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
        static::saved(function (AppQyV1WordGroupModel $group) {
            self::forgetLookupCache(
                (int) $group->uid,
                (string) $group->gid,
                (string) $group->gname
            );
            self::forgetLookupCache(
                (int) $group->getOriginal('uid'),
                (string) $group->getOriginal('gid'),
                (string) $group->getOriginal('gname')
            );
        });

        static::created(function (AppQyV1WordGroupModel $group) {
            if (!$group->cover_image_uuid) {
                $group->generateCoverImage();
            }
        });

        // Group deletion cleanup: the per-group JSON progress row
        // (group_word_progress) is owned by the group and goes with it.
        // Fires on soft delete too (delete events run on SoftDeletes).
        static::deleted(function (AppQyV1WordGroupModel $group) {
            self::forgetLookupCache((int) $group->uid, (string) $group->gid, (string) $group->gname);
            AppQyV1GroupWordProgressModel::where('group_id', $group->id)->delete();
        });
    }

    private static function forgetLookupCache(int $userId, string $gid, string $name): void
    {
        if ($userId <= 0) {
            return;
        }
        if ($gid !== '') {
            Cache::forget("word_group:{$userId}:{$gid}");
        }
        if ($name !== '') {
            Cache::forget("word_group_by_name:{$userId}:{$name}");
        }
    }

    /**
     * Get the user that owns the word group.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'uid');
    }

    /**
     * The group's word membership + progress: ONE JSON row per group
     * (group_word_progress replaced the row-per-word group_words /
     * user_word_progress pair).
     */
    public function wordProgress()
    {
        return $this->hasOne(AppQyV1GroupWordProgressModel::class, 'group_id');
    }

    /**
     * Count of library/pivot words attached to this group - the JSON row's
     * total_words cache (count of map keys). Uses the eager-loaded relation
     * when present; otherwise one indexed single-row read. The displayed
     * group total stays the merged count(gwords) + this value.
     */
    public function pivotWordsCount(): int
    {
        if ($this->relationLoaded('wordProgress')) {
            $row = $this->getRelation('wordProgress');
        } else {
            $row = $this->wordProgress()->first();
        }
        if (!$row) {
            return 0;
        }
        return (int) $row->total_words;
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

        $wordCount = $this->pivotWordsCount();

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
