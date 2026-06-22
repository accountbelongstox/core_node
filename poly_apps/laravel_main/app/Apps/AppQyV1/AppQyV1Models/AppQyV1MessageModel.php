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
 * Chat message (SOCIAL_FEATURE_SPECIFICATION.md §1/§2). Append-only;
 * created_at only (no updated_at). Paginated by the (conversation_id, id) cursor.
 */
class AppQyV1MessageModel extends Model
{
    public const TYPE_TEXT = 'text';
    public const TYPE_IMAGE = 'image';
    public const TYPE_VOICE = 'voice';

    // created_at only (append-only); no updated_at column.
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('MESSAGES');
    }

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'type',
        'metadata',
        'created_at',
    ];

    protected $casts = [
        'conversation_id' => 'integer',
        'sender_id' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];
}
