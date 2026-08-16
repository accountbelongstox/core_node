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
