<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\InviteCodeInitializer;

class InitInviteCodes extends Command
{
    protected $signature = 'invite-codes:init';

    protected $description = 'Initialize invite code tables and generate default codes';

    public function handle()
    {
        $this->info('Initializing invite code tables...');
        $this->newLine();

        $results = InviteCodeInitializer::ensureTablesExist();

        foreach (['invite_codes', 'invite_code_usage', 'default_codes'] as $key) {
            if (isset($results[$key])) {
                $status = $results[$key];
                $icon = $status === 'created' ? '✅' : ($status === 'exists' ? '✓' : '❌');
                $this->line("  {$icon} {$key}: {$status}");
            }
        }

        if (isset($results['codes'])) {
            $this->newLine();
            $this->info('Generated Invite Codes:');
            foreach ($results['codes'] as $type => $code) {
                $this->line("  • <fg=cyan>{$type}</>: <fg=yellow>{$code}</>");
            }
        }

        if (isset($results['error'])) {
            $this->newLine();
            $this->error("Error: {$results['error']}");
            return Command::FAILURE;
        }

        $this->newLine();
        $stats = InviteCodeInitializer::getTableStats();

        if (!isset($stats['error'])) {
            $this->info('Statistics:');
            $this->line("  Total codes: {$stats['invite_codes']['total']}");
            $this->line("  Active: {$stats['invite_codes']['active']}");
            $this->line("  Inactive: {$stats['invite_codes']['inactive']}");

            if (!empty($stats['invite_codes']['by_type'])) {
                $this->newLine();
                $this->line('  <fg=cyan>By Type:</>');
                foreach ($stats['invite_codes']['by_type'] as $type => $count) {
                    $this->line("    • {$type}: {$count}");
                }
            }

            $this->line("  Total usages: {$stats['invite_code_usage']['total']}");
        }

        $this->newLine();
        $this->info('✅ Invite code system initialized successfully!');

        return Command::SUCCESS;
    }
}
