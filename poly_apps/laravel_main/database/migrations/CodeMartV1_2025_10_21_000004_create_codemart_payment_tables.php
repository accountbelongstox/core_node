<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Wallets table
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_wallets')) {
        Schema::connection('codemartv1')->create('codemart_v1_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->onDelete('cascade');
            $table->decimal('balance', 15, 2)->default(0);
            $table->decimal('available_balance', 15, 2)->default(0);
            $table->decimal('frozen_balance', 15, 2)->default(0);
            $table->string('currency')->default('CNY');
            $table->timestamps();
            $table->index('user_id');
        });
        }

        // Wallet transactions
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_wallet_transactions')) {
        Schema::connection('codemartv1')->create('codemart_v1_wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained('codemart_v1_wallets')->onDelete('cascade');
            $table->enum('type', ['deposit', 'withdrawal', 'payment', 'refund', 'earning', 'escrow_hold', 'escrow_release'])->default('payment');
            $table->decimal('amount', 15, 2);
            $table->decimal('balance_after', 15, 2);
            $table->text('description')->nullable();
            $table->json('metadata')->nullable(); // Additional data like payment method, order ID
            $table->enum('status', ['pending', 'success', 'failed', 'cancelled'])->default('pending');
            $table->timestamps();
            $table->index('wallet_id');
            $table->index('type');
            $table->index('status');
        });
        }

        // Payments table
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_payments')) {
        Schema::connection('codemartv1')->create('codemart_v1_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('payee_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('project_id')->nullable()->constrained('codemart_v1_projects')->onDelete('set null');
            $table->foreignId('milestone_id')->nullable()->constrained('codemart_v1_milestones')->onDelete('set null');
            $table->decimal('amount', 15, 2);
            $table->string('currency')->default('CNY');
            $table->enum('type', ['milestone', 'hourly', 'refund', 'bonus'])->default('milestone');
            $table->enum('status', ['pending', 'completed', 'failed', 'cancelled', 'disputed'])->default('pending');
            $table->enum('payment_method', ['wallet', 'credit_card', 'bank_transfer', 'alipay', 'wechat'])->nullable();
            $table->string('transaction_id')->nullable()->unique();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index('payer_id');
            $table->index('payee_id');
            $table->index('project_id');
            $table->index('status');
        });
        }

        // Escrow accounts
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_escrows')) {
        Schema::connection('codemartv1')->create('codemart_v1_escrows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('codemart_v1_projects')->onDelete('cascade');
            $table->foreignId('payer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('payee_id')->constrained('users')->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->string('currency')->default('CNY');
            $table->enum('status', ['held', 'released', 'refunded', 'disputed'])->default('held');
            $table->datetime('released_at')->nullable();
            $table->text('release_reason')->nullable();
            $table->timestamps();
            $table->index('project_id');
            $table->index('payer_id');
            $table->index('payee_id');
            $table->index('status');
        });
        }

        // Invoices
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_invoices')) {
        Schema::connection('codemartv1')->create('codemart_v1_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('codemart_v1_payments')->onDelete('cascade');
            $table->string('invoice_number')->unique();
            $table->foreignId('issued_by')->constrained('users')->onDelete('cascade');
            $table->text('description')->nullable();
            $table->json('line_items')->nullable(); // Array of invoice items
            $table->decimal('subtotal', 15, 2);
            $table->decimal('tax', 15, 2)->default(0);
            $table->decimal('total', 15, 2);
            $table->date('issued_date');
            $table->date('due_date')->nullable();
            $table->enum('status', ['draft', 'sent', 'paid', 'cancelled', 'overdue'])->default('draft');
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index('payment_id');
            $table->index('invoice_number');
            $table->index('status');
        });
        }

        // Refunds
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_refunds')) {
        Schema::connection('codemartv1')->create('codemart_v1_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('codemart_v1_payments')->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->enum('status', ['pending', 'approved', 'rejected', 'completed'])->default('pending');
            $table->text('reason');
            $table->text('notes')->nullable();
            $table->datetime('requested_at');
            $table->datetime('processed_at')->nullable();
            $table->timestamps();
            $table->index('payment_id');
            $table->index('status');
        });
        }
    }

    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_refunds');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_invoices');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_escrows');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_payments');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_wallet_transactions');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_wallets');
    }
};
