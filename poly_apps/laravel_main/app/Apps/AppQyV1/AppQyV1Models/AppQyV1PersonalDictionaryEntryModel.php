<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\User;

class AppQyV1PersonalDictionaryEntryModel extends AppQyV1Model
{
    use HasFactory, SoftDeletes;

    /**
     * The application key for connection / table resolution.
     *
     * @var string
     */

    /**
     * The table associated with the model.
     *
     * @var string
     */

    /**
     * Constructor to set connection and table name from the table bridge.
     */
    protected ?string $appTableMapKey = 'PERSONAL_DICTIONARY_ENTRIES';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'uid',
        'word',
        'language',
        'definition',
        'example',
        'notes',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'uid');
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function wordContainsInsensitive(\Illuminate\Database\Eloquent\Builder $query, string $word): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereLike('word', "%{$word}%", caseSensitive: false);
    }

    public static function searchForUser(
        int $userId,
        ?string $word,
        ?string $language,
        int $offset,
        int $limit
    ) {
        $query = static::query()->where('uid', $userId);

        if ($word !== null && $word !== '') {
            $query->wordContainsInsensitive($word);
        }
        if ($language !== null && $language !== '') {
            $query->where('language', $language);
        }

        return $query->orderByDesc('id')->offset($offset)->limit($limit)->get();
    }

    public static function forUserWords(int $userId, array $words)
    {
        return static::query()
            ->where('uid', $userId)
            ->whereIn('word', $words)
            ->orderByDesc('id')
            ->get();
    }

    public static function deleteForUser(int $userId, ?int $entryId = null): int
    {
        $query = static::query()->where('uid', $userId);

        if ($entryId !== null) {
            $query->whereKey($entryId);
        }

        return $query->delete();
    }
}
