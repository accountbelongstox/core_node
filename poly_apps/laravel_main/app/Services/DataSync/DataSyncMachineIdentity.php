<?php

namespace App\Services\DataSync;

use App\Utils\FileSystemManager;

/**
 * Stable per-machine identifier used to decide whether two sync endpoints are
 * the same physical machine. Replicates pycore pyfoundations.machine_id
 * get_machine_id(): sha256 over the OS installation id (Windows MachineGuid,
 * Linux /etc/machine-id), so both stacks derive the identical code. IP or host
 * comparison cannot be used here: loopback port-forwards and LAN addresses say
 * nothing about which machine answers.
 */
final class DataSyncMachineIdentity
{
    private const WINDOWS_GUID_COMMAND = 'reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid 2>nul';

    public function code(): string
    {
        return hash('sha256', $this->rawId());
    }

    private function rawId(): string
    {
        $raw = PHP_OS_FAMILY === 'Windows'
            ? $this->windowsMachineGuid()
            : $this->linuxMachineId();

        return $raw !== null && $raw !== ''
            ? $raw
            : (string) gethostname();
    }

    private function linuxMachineId(): ?string
    {
        foreach (['/etc/machine-id', '/var/lib/dbus/machine-id'] as $path) {
            $content = FileSystemManager::readFile($path, false);
            if (is_string($content) && trim($content) !== '') {
                return trim($content);
            }
        }

        return null;
    }

    private function windowsMachineGuid(): ?string
    {
        $output = shell_exec(self::WINDOWS_GUID_COMMAND);
        if (!is_string($output) || $output === '') {
            return null;
        }

        return preg_match('/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/', $output, $matches) === 1
            ? $matches[1]
            : null;
    }
}
