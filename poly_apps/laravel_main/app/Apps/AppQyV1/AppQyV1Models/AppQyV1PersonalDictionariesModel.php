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
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Models\User;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1PersonalDictionariesModel extends Model
{
    use HasFactory, SoftDeletes;

    protected $appKey = AppKeys::APPQYV1;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table;

    /**
     * Constructor to set table name from database bridge
     */
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('PERSONAL_DICTIONARIES');
    }

    protected $fillable = [
        'uid',
        'personal_dicts',
    ];

    protected $casts = [
        'personal_dicts' => 'json',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'uid');
    }

    public function addPersonalWords($words): array
    {
        $currentWords = $this->personal_dicts ?? [];
        $newWords = is_array($words) ? $words : StrTool::extractWords($words);
        $this->personal_dicts = array_values(array_unique(array_merge($currentWords, $newWords)));
        $this->save();
        
        return $this->personal_dicts;
    }

    public function removePersonalWords($words): array
    {
        $currentWords = $this->personal_dicts ?? [];
        $removeWords = is_array($words) ? $words : StrTool::extractWords($words);
        $this->personal_dicts = array_values(array_diff($currentWords, $removeWords));
        $this->save();
        
        return $this->personal_dicts;
    }

    public function hasPersonalWord(string $word): bool
    {
        return in_array($word, $this->personal_dicts ?? []);
    }

    public function getStats(): array
    {
        return [
            'total_personal_dicts' => count($this->personal_dicts ?? []),
        ];
    }
}

