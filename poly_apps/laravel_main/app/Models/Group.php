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
