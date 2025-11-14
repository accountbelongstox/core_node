<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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