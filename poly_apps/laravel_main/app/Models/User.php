<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Laravel\Sanctum\HasApiTokens;


class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    use HasApiTokens;


    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'username',
        'nickname',
        'name',
        'avatar',
        'email_verified_at',
        'email',
        'password',
        'rolelevel',
        'rolename',
        'learning_languages',
        'native_language',
        'preferences',
        'bio',
        'location',
        'phone',
        // OAuth / social-login identity (shared across all apps) — see
        // global_2026_06_20_000001_add_oauth_to_users_table.php.
        'google_id',
        'github_id',
        'oauth_provider',
        'oauth_avatar',
        'phone_verified_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'learning_languages' => 'array',
            'preferences' => 'array',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->rolelevel >= 10;
    }

    public function isSuperAdmin(): bool
    {
        return $this->rolelevel >= 100;
    }

    public function hasRole(string $roleName): bool
    {
        return strtolower($this->rolename) === strtolower($roleName);
    }

    public function hasMinimumRoleLevel(int $level): bool
    {
        return $this->rolelevel >= $level;
    }

    public static function indexedByIds(array $userIds, array $columns = ['*']): Collection
    {
        $normalizedIds = [];

        $normalizedIds = array_values(array_unique(array_map('intval', $userIds)));
        if (empty($normalizedIds)) {
            return collect();
        }

        return static::query()
            ->whereIn('id', $normalizedIds)
            ->get($columns)
            ->keyBy('id');
    }

    public static function findById(int $userId): ?self
    {
        return static::query()->find($userId);
    }

    public static function searchSocialProfiles(
        int $excludedUserId,
        string $search,
        string $nativeLanguage,
        string $targetLanguage,
        int $limit
    ): Collection {
        $query = null;

        $query = static::query()
            ->where('id', '!=', $excludedUserId)
            ->profileSearchInsensitive($search);

        if ($nativeLanguage !== '') {
            $query->nativeLanguageInsensitive($nativeLanguage);
        }
        if ($targetLanguage !== '') {
            $query->learningLanguage($targetLanguage);
        }

        return $query
            ->orderBy('username')
            ->limit($limit)
            ->get(['id', 'username', 'nickname', 'name', 'avatar', 'native_language', 'learning_languages']);
    }

    public static function discoverSocialProfiles(
        array $excludedUserIds,
        string $search,
        string $nativeLanguage,
        string $targetLanguage,
        int $limit
    ): Collection {
        $normalizedExcludedIds = [];
        $query = null;

        $normalizedExcludedIds = array_values(array_unique(array_map('intval', $excludedUserIds)));
        $query = static::query()->whereNotIn('id', $normalizedExcludedIds);

        if ($search !== '') {
            $query->profileSearchInsensitive($search);
        }
        if ($nativeLanguage !== '') {
            $query->nativeLanguageInsensitive($nativeLanguage);
        }
        if ($targetLanguage !== '') {
            $query->learningLanguage($targetLanguage);
        }

        return $query
            ->orderByDesc('id')
            ->limit(max(1, min(100, $limit)) * 3)
            ->get(['id', 'username', 'nickname', 'name', 'avatar', 'native_language', 'learning_languages']);
    }

    public function scopeProfileSearchInsensitive($query, string $value)
    {
        $needle = '%' . strtolower($value) . '%';

        return $query->where(function ($builder) use ($needle) {
            $builder->whereRaw('LOWER(username) LIKE ?', [$needle])
                ->orWhereRaw('LOWER(nickname) LIKE ?', [$needle])
                ->orWhereRaw('LOWER(name) LIKE ?', [$needle]);
        });
    }

    public function scopeNativeLanguageInsensitive($query, string $language)
    {
        return $query->whereRaw('LOWER(native_language) = ?', [strtolower($language)]);
    }

    public function scopeLearningLanguage($query, string $language)
    {
        $code = strtolower($language);
        $like = '%"' . $code . '"%';

        return $query->where(function ($builder) use ($code, $like) {
            $builder->whereJsonContains('learning_languages', $code)
                ->orWhereRaw('LOWER(CAST(learning_languages AS CHAR(500))) LIKE ?', [$like]);
        });
    }
}
