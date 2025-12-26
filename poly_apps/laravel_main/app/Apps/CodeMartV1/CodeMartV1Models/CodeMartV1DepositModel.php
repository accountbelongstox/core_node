<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;

class CodeMartV1DepositModel extends Model
{
    protected $connection = 'codemartv1';
    protected $table = 'codemart_v1_deposits';

    protected $fillable = [
        'user_id',
        'role_type',
        'amount',
        'payment_method',
        'status',
        'payment_url',
        'paid_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];
}
