<?php

namespace App\Console\Commands;

use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1DemoSeeder;
use Illuminate\Console\Command;

class CodeMartV1SeedDemoData extends Command
{
    private const LANG_PREFIX = 'codemart.cli.seed.';

    protected $signature = 'sys:codemartinit';

    protected function configure(): void
    {
        $this->setDescription(__(self::LANG_PREFIX . 'description'));
    }

    public function handle(): int
    {
        $summary = (new CodeMartV1DemoSeeder())->seed(fn (string $message) => $this->line($message));

        $this->info(__(self::LANG_PREFIX . 'initialized'));
        $this->displayPassword($summary);
        $this->line(__(self::LANG_PREFIX . 'account_list', ['accounts' => implode(' / ', $summary['accounts'])]));
        foreach ($summary['counts'] as $table => $count) {
            $this->line("  {$table}: {$count}");
        }

        return self::SUCCESS;
    }

    private function displayPassword(array $summary): void
    {
        $this->line(__(self::LANG_PREFIX . 'password_file', ['path' => $summary['password_file']]));
        $this->line(__(self::LANG_PREFIX . 'password_current', ['password' => $summary['password']]));
    }
}
