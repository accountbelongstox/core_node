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


namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use App\Apps\DictV1\Utils\DictV1DatabaseBridge;

class Group extends Model
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
        $this->table = DictV1DatabaseBridge::getGlobalGroupsTableName();
    }

    protected $fillable = [
        'name',
        'identifier'
    ];

    protected $hidden = ['deleted_at'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($group) {
            // Generate unique identifier: group name/MD5/creation date
            $group->identifier = sprintf(
                '%s/%s/%s',
                Str::slug($group->name),
                md5($group->name . time()),
                now()->format('Ymd')
            );
        });
    }

            // Find group by hash ID
    public static function findByHash($hashId)
    {
        return static::where('hash_id', $hashId)->first();
    }

            // Reorder groups
    public static function reorder(array $ids)
    {
        foreach ($ids as $order => $id) {
            static::where('id', $id)->update(['order' => $order]);
        }
    }

    public function configs()
    {
        return $this->hasMany(Config::class, 'group_id');
    }
}
