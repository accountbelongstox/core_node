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

    /**
     * Adds readable labels (project_title, task_title, user_name) next to the
     * ids in description_params so the ledger text names what it refers to.
     *
     * @param array<int, self> $transactions
     * @return array<int, array>
     */
    public static function withReferenceLabels(array $transactions): array
    {
        $ids = ['project_id' => [], 'task_id' => [], 'user_id' => []];
        foreach ($transactions as $transaction) {
            foreach (array_keys($ids) as $key) {
                $value = (int) (($transaction->description_params ?? [])[$key] ?? 0);
                if ($value > 0) {
                    $ids[$key][] = $value;
                }
            }
        }
        $projects = CodeMartV1ProjectModel::query()->whereIn('id', array_unique($ids['project_id']))->pluck('title', 'id')->all();
        $tasks = CodeMartV1TaskModel::query()->whereIn('id', array_unique($ids['task_id']))->pluck('title', 'id')->all();
        $users = CodeMartV1UserModel::query()->whereIn('id', array_unique($ids['user_id']))->get(['id', 'name', 'username'])
            ->mapWithKeys(static fn (CodeMartV1UserModel $user): array => [(int) $user->id => $user->name ?: $user->username])
            ->all();

        return array_map(static function (self $transaction) use ($projects, $tasks, $users): array {
            $params = (array) ($transaction->description_params ?? []);
            foreach (['project_id' => [$projects, 'project_title'], 'task_id' => [$tasks, 'task_title'], 'user_id' => [$users, 'user_name']] as $key => [$labels, $labelKey]) {
                if (isset($params[$key])) {
                    $params[$labelKey] = $labels[(int) $params[$key]] ?? ('#' . $params[$key]);
                }
            }
            // Set the augmented params on the model BEFORE serializing so the
            // description accessor renders names, not raw placeholders.
            $transaction->description_params = $params;
            return $transaction->toArray();
        }, $transactions);
    }

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
