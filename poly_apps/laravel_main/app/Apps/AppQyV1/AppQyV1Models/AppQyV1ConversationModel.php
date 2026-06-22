<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Chat conversation (SOCIAL_FEATURE_SPECIFICATION.md §1/§2). Direct (1:1) or
 * group; direct threads dedupe via the dkey (min_max user-id pair).
 */
class AppQyV1ConversationModel extends Model
{
    public const TYPE_DIRECT = 'direct';
    public const TYPE_GROUP = 'group';

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('CONVERSATIONS');
    }

    protected $fillable = [
        'type',
        'created_by',
        'dkey',
        'last_message_at',
    ];

    protected $casts = [
        'created_by' => 'integer',
        'last_message_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** Stable direct-conversation dedupe key for an unordered user pair. */
    public static function directKey(int $a, int $b): string
    {
        $lo = min($a, $b);
        $hi = max($a, $b);
        return $lo . '_' . $hi;
    }
}
