<?php

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