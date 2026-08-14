<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Models;

use App\Models\Model;
use Illuminate\Support\Collection;
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * A membership tier / price package (TRIAL|PRO|PRO_PLUS|ULTIMATE).
 */
class PddToolV1PackageModel extends Model
{
    protected $appKey = AppKeys::PDDTOOLV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = PddToolV1TableMaps::getTableName('PACKAGES');
    }

    protected $fillable = [
        'code',
        'name',
        'price_month',
        'price_year',
        'max_orders',
        'max_pdd_accounts',
        'enabled',
    ];

    protected $casts = [
        'price_month' => 'float',
        'price_year' => 'float',
        'max_orders' => 'integer',
        'max_pdd_accounts' => 'integer',
        'enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function ordered(): Collection
    {
        return static::query()->orderBy('id')->get();
    }

    public static function findByCodeOrNew(string $code): self
    {
        return static::query()->where('code', $code)->first() ?? new static();
    }

    public static function findByCode(string $code): ?self
    {
        return static::query()->where('code', $code)->first();
    }

    public static function enabledPackages(): Collection
    {
        return static::query()->where('enabled', true)->orderBy('id')->get();
    }

    public static function anyExists(): bool
    {
        return static::query()->exists();
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }
}
