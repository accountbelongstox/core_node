<?php

namespace App\Console\Commands;

use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1DemoSeeder;
use Illuminate\Console\Command;

class CodeMartV1SeedDemoData extends Command
{
    protected $signature = 'sys:codemartinit';

    protected $description = 'Seed CodeMart demo accounts, projects, milestones, tasks, deposits, wallets and testimonials (idempotent)';

    public function handle(): int
    {
        $summary = (new CodeMartV1DemoSeeder())->seed(fn (string $message) => $this->line($message));

        $this->info('CodeMart demo data initialized.');
        $this->line('Demo accounts (password: ' . $summary['password'] . '):');
        $this->line('  ' . implode(' / ', $summary['accounts']));
        foreach ($summary['counts'] as $table => $count) {
            $this->line("  {$table}: {$count}");
        }

        return self::SUCCESS;
    }
}
