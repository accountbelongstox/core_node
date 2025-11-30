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
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Models\User;

class AppQyV1PersonalDictionariesModel extends Model
{
    use HasFactory, SoftDeletes;

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
        $this->table = AppQyV1TableMaps::getTableName('app_qy_v1_PERSONAL_DICTIONARIES');
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

