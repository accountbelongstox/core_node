<?php

namespace App\Apps\CodeMartV1\CodeMartV1Commands;

use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1AdminPassword;
use Illuminate\Console\Command;
use Symfony\Component\Console\Input\InputOption;

/**
 * codemart:admin-password --file <path>: applies the password in the secret
 * file (config/service_contract.json#codemart_admin_password) to every
 * account the CodeMart seeder creates. The rotator of those hashes; the seeder
 * reuses the same applier only when it creates a missing file.
 */
class CodeMartV1AdminPasswordCommand extends Command
{
    private const LANG_PREFIX = 'codemart.cli.admin_password.';
    private const OPTION_FILE = 'file';

    protected $name = 'codemart:admin-password';

    protected function configure(): void
    {
        $this->setDescription(__(self::LANG_PREFIX . 'description'));
        $this->addOption(self::OPTION_FILE, null, InputOption::VALUE_REQUIRED, __(self::LANG_PREFIX . 'option_file'));
    }

    public function handle(): int
    {
        $path = trim((string) $this->option(self::OPTION_FILE));
        $password = null;
        $results = [];
        $counts = [
            CodeMartV1AdminPassword::RESULT_UPDATED => 0,
            CodeMartV1AdminPassword::RESULT_UNCHANGED => 0,
            CodeMartV1AdminPassword::RESULT_MISSING => 0,
        ];

        if ($path === '') {
            $this->error(__(self::LANG_PREFIX . 'file_required'));

            return self::INVALID;
        }

        $password = CodeMartV1AdminPassword::read($path);
        if ($password === null) {
            $this->error(__(self::LANG_PREFIX . 'file_unreadable', ['path' => $path]));

            return self::FAILURE;
        }

        $results = CodeMartV1AdminPassword::apply($password);
        foreach ($results as $username => $result) {
            $counts[$result]++;
            $this->line(__(self::LANG_PREFIX . 'account_' . $result, ['username' => $username]));
        }

        $this->info(__(self::LANG_PREFIX . 'summary', [
            'updated' => $counts[CodeMartV1AdminPassword::RESULT_UPDATED],
            'unchanged' => $counts[CodeMartV1AdminPassword::RESULT_UNCHANGED],
            'missing' => $counts[CodeMartV1AdminPassword::RESULT_MISSING],
        ]));

        return self::SUCCESS;
    }
}
