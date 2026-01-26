<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'codemartv1';

    public function up(): void
    {
        $this->createWalletsTable();
        $this->createWalletTransactionsTable();
        $this->createPaymentsTable();
        $this->createEscrowsTable();
        $this->createInvoicesTable();
        $this->createRefundsTable();
    }

    private function createWalletsTable(): void
    {
        $tableName = 'codemart_v1_wallets';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'unique' => true],
                'balance' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'available_balance' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'frozen_balance' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'currency' => ['type' => 'string', 'nullable' => false, 'default' => 'CNY'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createWalletTransactionsTable(): void
    {
        $tableName = 'codemart_v1_wallet_transactions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'wallet_id' => ['type' => 'foreignId', 'nullable' => false],
                'type' => ['type' => 'enum', 'values' => ['deposit', 'withdrawal', 'payment', 'refund', 'earning', 'escrow_hold', 'escrow_release'], 'nullable' => false, 'default' => 'payment'],
                'amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'balance_after' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => true],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'status' => ['type' => 'enum', 'values' => ['pending', 'success', 'failed', 'cancelled'], 'nullable' => false, 'default' => 'pending'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['wallet_id']],
                ['columns' => ['type']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'wallet_id',
                    'references' => 'codemart_v1_wallets',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createPaymentsTable(): void
    {
        $tableName = 'codemart_v1_payments';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'payer_id' => ['type' => 'foreignId', 'nullable' => false],
                'payee_id' => ['type' => 'foreignId', 'nullable' => false],
                'project_id' => ['type' => 'foreignId', 'nullable' => true],
                'milestone_id' => ['type' => 'foreignId', 'nullable' => true],
                'amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'currency' => ['type' => 'string', 'nullable' => false, 'default' => 'CNY'],
                'type' => ['type' => 'enum', 'values' => ['milestone', 'hourly', 'refund', 'bonus'], 'nullable' => false, 'default' => 'milestone'],
                'status' => ['type' => 'enum', 'values' => ['pending', 'completed', 'failed', 'cancelled', 'disputed'], 'nullable' => false, 'default' => 'pending'],
                'payment_method' => ['type' => 'enum', 'values' => ['wallet', 'credit_card', 'bank_transfer', 'alipay', 'wechat'], 'nullable' => true],
                'transaction_id' => ['type' => 'string', 'nullable' => true, 'unique' => true],
                'description' => ['type' => 'text', 'nullable' => true],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['payer_id']],
                ['columns' => ['payee_id']],
                ['columns' => ['project_id']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'payer_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'payee_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'project_id',
                    'references' => 'codemart_v1_projects',
                    'on' => 'id',
                    'onDelete' => 'set null',
                ],
                [
                    'column' => 'milestone_id',
                    'references' => 'codemart_v1_milestones',
                    'on' => 'id',
                    'onDelete' => 'set null',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createEscrowsTable(): void
    {
        $tableName = 'codemart_v1_escrows';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'project_id' => ['type' => 'foreignId', 'nullable' => false],
                'payer_id' => ['type' => 'foreignId', 'nullable' => false],
                'payee_id' => ['type' => 'foreignId', 'nullable' => false],
                'amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'currency' => ['type' => 'string', 'nullable' => false, 'default' => 'CNY'],
                'status' => ['type' => 'enum', 'values' => ['held', 'released', 'refunded', 'disputed'], 'nullable' => false, 'default' => 'held'],
                'released_at' => ['type' => 'dateTime', 'nullable' => true],
                'release_reason' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['project_id']],
                ['columns' => ['payer_id']],
                ['columns' => ['payee_id']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'project_id',
                    'references' => 'codemart_v1_projects',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'payer_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'payee_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createInvoicesTable(): void
    {
        $tableName = 'codemart_v1_invoices';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'payment_id' => ['type' => 'foreignId', 'nullable' => false],
                'invoice_number' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'issued_by' => ['type' => 'foreignId', 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => true],
                'line_items' => ['type' => 'json', 'nullable' => true],
                'subtotal' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'tax' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'total' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'issued_date' => ['type' => 'date', 'nullable' => false],
                'due_date' => ['type' => 'date', 'nullable' => true],
                'status' => ['type' => 'enum', 'values' => ['draft', 'sent', 'paid', 'cancelled', 'overdue'], 'nullable' => false, 'default' => 'draft'],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['payment_id']],
                ['columns' => ['invoice_number']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'payment_id',
                    'references' => 'codemart_v1_payments',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'issued_by',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createRefundsTable(): void
    {
        $tableName = 'codemart_v1_refunds';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'payment_id' => ['type' => 'foreignId', 'nullable' => false],
                'amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['pending', 'approved', 'rejected', 'completed'], 'nullable' => false, 'default' => 'pending'],
                'reason' => ['type' => 'text', 'nullable' => false],
                'notes' => ['type' => 'text', 'nullable' => true],
                'requested_at' => ['type' => 'dateTime', 'nullable' => false],
                'processed_at' => ['type' => 'dateTime', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['payment_id']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'payment_id',
                    'references' => 'codemart_v1_payments',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('codemart_v1_refunds');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_invoices');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_escrows');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_payments');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_wallet_transactions');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_wallets');
    }
};
