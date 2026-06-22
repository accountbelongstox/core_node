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

use Illuminate\Database\Eloquent\Model;
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * One purchase-order line within a batch.
 */
class PddToolV1BatchPurchaseOrderModel extends Model
{
    protected $appKey = AppKeys::PDDTOOLV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = PddToolV1TableMaps::getTableName('BATCH_PURCHASE_ORDERS');
    }

    protected $fillable = [
        'batch_id',
        'user_id',
        'purchase_order_no',
        'goods_id',
        'sku_id',
        'quantity',
        'status',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'quantity' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
