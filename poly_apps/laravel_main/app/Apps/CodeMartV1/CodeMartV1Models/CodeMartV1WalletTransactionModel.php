<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1WalletTransactionModel extends CodeMartV1Model
{
    private const DESCRIPTION_LANG_PREFIX = 'codemart.ledger.';

    protected $table = 'codemart_v1_wallet_transactions';

    protected $fillable = [
        'wallet_id',
        'type',
        'amount',
        'balance_after',
        'description',
        'description_code',
        'description_params',
        'metadata',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'description_params' => 'json',
        'metadata' => 'json',
    ];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1WalletModel::class, 'wallet_id');
    }

    /**
     * Rows with a description code are translated in the request locale;
     * rows written before the codes keep their stored text.
     */
    protected function description(): Attribute
    {
        return Attribute::get(function (?string $value): ?string {
            $code = (string) ($this->attributes['description_code'] ?? '');
            if ($code === '') {
                return $value;
            }

            return __(self::DESCRIPTION_LANG_PREFIX . $code, (array) ($this->description_params ?? []));
        });
    }
}
