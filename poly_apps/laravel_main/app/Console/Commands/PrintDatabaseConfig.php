<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;

class PrintDatabaseConfig extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'database:config';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prints the current database configuration.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $defaultConnection = Config::get('database.default');
        $connections = Config::get('database.connections');

        $this->info('Current Database Configuration:');
        $this->line('');
        $this->info("Default Connection: <comment>{$defaultConnection}</comment>");
        $this->line('');
        $this->line('<fg=yellow>Connections:</>');

        foreach ($connections as $name => $config) {
            $this->line("<fg=green>  {$name}:</>");
            foreach ($config as $key => $value) {
                if (is_scalar($value)) {
                    $this->line("    <comment>{$key}:</comment> {$value}");
                } elseif (is_array($value)) {
                    $this->line("    <comment>{$key}:</comment> " . json_encode($value));
                }
            }
            $this->line('');
        }

        return Command::SUCCESS;
    }
}