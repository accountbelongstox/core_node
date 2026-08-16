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

use Closure;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Concerns\UsesMainConnection;
use App\Models\Concerns\HasModelOperations;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\TransientToken;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Laravel\Sanctum\HasApiTokens;


class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, HasModelOperations, Notifiable, RunsModelTransactions, UsesMainConnection;

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

    public static function usernamesByIds(array $userIds): array
    {
        return static::indexedByIds($userIds, ['id', 'username'])
            ->map(fn (self $user): string => (string) $user->username)
            ->all();
    }

    public static function usernameById(int $userId): string
    {
        return (string) (static::query()->whereKey($userId)->value('username') ?? '');
    }

    public static function idsMatchingUsername(string $search): array
    {
        return static::query()
            ->whereLike('username', '%' . $search . '%', caseSensitive: false)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    public static function existsById(int $userId): bool
    {
        return static::query()->whereKey($userId)->exists();
    }

    public static function findByUsernameOrEmail(string $identity): ?self
    {
        return static::query()
            ->where('username', $identity)
            ->orWhere('email', $identity)
            ->first();
    }

    public static function findByUsernameEmailOrPhone(string $identity): ?self
    {
        return static::query()
            ->where('username', $identity)
            ->orWhere('email', $identity)
            ->orWhere('phone', $identity)
            ->first();
    }

    public static function findByUserToken(string $token): ?self
    {
        return static::query()->where('user_token', $token)->first();
    }

    public static function findByEmail(string $email): ?self
    {
        return static::query()->where('email', $email)->first();
    }

    public static function findByPhone(string $phone): ?self
    {
        return static::query()->where('phone', $phone)->first();
    }

    public static function usernameExists(string $username): bool
    {
        return static::query()->where('username', $username)->exists();
    }

    public static function emailExists(string $email): bool
    {
        return static::query()->where('email', $email)->exists();
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

    public static function highestRoleUser(): ?self
    {
        return static::query()->orderByDesc('rolelevel')->orderBy('id')->first();
    }

    public function existingColumnAttributes(array $attributes, array $excludedColumns = []): array
    {
        $schema = Schema::connection($this->getConnectionName());
        $filtered = [];

        foreach ($attributes as $key => $value) {
            if (!is_string($key) || in_array($key, $excludedColumns, true)) {
                continue;
            }
            if ($schema->hasColumn($this->getTable(), $key)) {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }

    public static function chunkLearningLanguages(Closure $callback): void
    {
        self::query()
            ->select(['id', 'learning_languages'])
            ->orderBy('id')
            ->chunkById(200, $callback);
    }

    public static function findByUsername(string $username): ?self
    {
        return static::query()->where('username', $username)->first();
    }

    public static function findExistingIdentity(string $username, ?string $email): ?self
    {
        return static::query()
            ->where(function ($query) use ($username, $email): void {
                $query->where('username', $username);
                if ($email !== null && $email !== '') {
                    $query->orWhere('email', $email);
                }
            })
            ->first();
    }

    public static function updateById(int $userId, array $attributes): int
    {
        return static::query()->whereKey($userId)->update($attributes);
    }

    public static function grantSuperAdmin(int $userId): ?self
    {
        self::query()->whereKey($userId)->update([
            'rolelevel' => 100,
            'rolename' => 'Super Administrator',
        ]);

        return self::query()->find($userId);
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

    public function revokeAllAccessTokens(): int
    {
        return $this->tokens()->delete();
    }

    public function revokeCurrentAccessToken(): bool
    {
        $token = $this->currentAccessToken();

        if ($token === null || $token instanceof TransientToken) {
            return false;
        }

        return (bool) $token->delete();
    }

    #[Scope]
    protected function profileSearchInsensitive(Builder $query, string $value): Builder
    {
        $needle = '%' . $value . '%';

        return $query->where(function (Builder $builder) use ($needle): void {
            $builder->whereLike('username', $needle, caseSensitive: false)
                ->orWhereLike('nickname', $needle, caseSensitive: false)
                ->orWhereLike('name', $needle, caseSensitive: false);
        });
    }

    #[Scope]
    protected function nativeLanguageInsensitive(Builder $query, string $language): Builder
    {
        return $query->whereLike('native_language', $language, caseSensitive: false);
    }

    #[Scope]
    protected function learningLanguage(Builder $query, string $language): Builder
    {
        $code = strtolower($language);

        return $query->whereJsonContains('learning_languages', $code);
    }
}
