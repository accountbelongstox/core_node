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
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Single-row gateway config (enable toggles + non-secret identifiers). The real
 * merchant secrets (private keys / api_v3_key) live in CoreNodeSecrets, NOT here.
 */
class PddToolV1PaymentSettingModel extends Model
{
    protected $appKey = AppKeys::PDDTOOLV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = PddToolV1TableMaps::getTableName('PAYMENT_SETTINGS');
    }

    protected $fillable = [
        'alipay_enabled',
        'alipay_app_id',
        'wechat_enabled',
        'wechat_mch_id',
        'wechat_app_id',
    ];

    protected $casts = [
        'alipay_enabled' => 'boolean',
        'wechat_enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function current(): ?self
    {
        return static::query()->first();
    }

    public static function currentOrNew(): self
    {
        return static::current() ?? new static();
    }
}
