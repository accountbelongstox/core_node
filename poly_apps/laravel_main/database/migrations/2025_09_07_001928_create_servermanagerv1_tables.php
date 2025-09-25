<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Nginx Sites Table
        Schema::create('servermanagerv1_nginx_sites', function (Blueprint $table) {
            $table->id();
            $table->string('site_name')->unique();
            $table->string('domain');
            $table->enum('site_type', ['php', 'laravel', 'static', 'proxy']);
            $table->string('document_root')->nullable();
            $table->string('php_version')->nullable();
            $table->boolean('ssl_enabled')->default(false);
            $table->string('ssl_cert_path')->nullable();
            $table->string('ssl_key_path')->nullable();
            $table->string('proxy_pass')->nullable();
            $table->longText('config_content');
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });

        // Execution Logs Table
        Schema::create('servermanagerv1_execution_logs', function (Blueprint $table) {
            $table->id();
            $table->string('script_id');
            $table->string('script_name');
            $table->string('script_category');
            $table->text('command');
            $table->json('arguments')->nullable();
            $table->longText('output')->nullable();
            $table->longText('error_output')->nullable();
            $table->integer('exit_code');
            $table->float('execution_time');
            $table->bigInteger('memory_usage');
            $table->string('user_ip');
            $table->string('user_agent')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        // SSL Certificates Table
        Schema::create('servermanagerv1_certificates', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('certificate_path');
            $table->string('private_key_path');
            $table->string('chain_path')->nullable();
            $table->string('issuer')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->timestamp('last_renewed_at')->nullable();
            $table->integer('renewal_attempts')->default(0);
            $table->enum('status', ['active', 'expired', 'pending', 'failed']);
            $table->timestamps();
        });

        // System Snapshots Table
        Schema::create('servermanagerv1_system_snapshots', function (Blueprint $table) {
            $table->id();
            $table->enum('snapshot_type', ['scheduled', 'manual', 'alert']);
            $table->float('cpu_usage')->nullable();
            $table->bigInteger('memory_total')->nullable();
            $table->bigInteger('memory_used')->nullable();
            $table->bigInteger('memory_free')->nullable();
            $table->bigInteger('disk_total')->nullable();
            $table->bigInteger('disk_used')->nullable();
            $table->bigInteger('disk_free')->nullable();
            $table->json('load_average')->nullable();
            $table->integer('process_count')->nullable();
            $table->json('network_info')->nullable();
            $table->json('service_status')->nullable();
            $table->timestamps();
        });

        // File Access Logs Table
        Schema::create('servermanagerv1_file_access_logs', function (Blueprint $table) {
            $table->id();
            $table->enum('action', ['browse', 'download', 'preview', 'info']);
            $table->text('file_path');
            $table->bigInteger('file_size')->nullable();
            $table->string('file_type')->nullable();
            $table->string('user_ip');
            $table->string('user_agent')->nullable();
            $table->boolean('success');
            $table->text('error_message')->nullable();
            $table->timestamps();
        });

        // Predefined Scripts Table
        Schema::create('servermanagerv1_predefined_scripts', function (Blueprint $table) {
            $table->id();
            $table->string('script_name')->unique();
            $table->string('script_category');
            $table->text('description');
            $table->text('command');
            $table->json('arguments')->nullable();
            $table->string('working_directory')->nullable();
            $table->integer('timeout')->default(300);
            $table->boolean('requires_sudo')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('servermanagerv1_predefined_scripts');
        Schema::dropIfExists('servermanagerv1_file_access_logs');
        Schema::dropIfExists('servermanagerv1_system_snapshots');
        Schema::dropIfExists('servermanagerv1_certificates');
        Schema::dropIfExists('servermanagerv1_execution_logs');
        Schema::dropIfExists('servermanagerv1_nginx_sites');
    }
};
