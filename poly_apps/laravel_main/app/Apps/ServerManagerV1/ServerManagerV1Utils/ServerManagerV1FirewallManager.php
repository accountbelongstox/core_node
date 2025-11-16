<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * Firewall Manager for ServerManagerV1
 *
 * Provides unified interface for managing firewall rules across different firewall systems.
 * Supports: UFW, firewalld, iptables
 *
 * IMPORTANT: Does NOT install firewall if not present - only manages existing installations
 *
 * This class wraps the functionality from:
 * /www/programing/core_node/scripts/shells/linux/common/firewall_manager.sh
 */
class ServerManagerV1FirewallManager
{
    /**
     * Firewall script path
     */
    private const FIREWALL_SCRIPT = '/www/programing/core_node/scripts/shells/linux/common/firewall_manager.sh';

    /**
     * Detect available and active firewalls
     *
     * @return array Firewall detection results
     */
    public static function detectFirewall(): array
    {
        $result = Process::run("bash -c 'source " . self::FIREWALL_SCRIPT . " && firewall_get_status'");

        $output = $result->output();

        $status = [
            'detected' => false,
            'active' => false,
            'type' => 'none',
            'available' => [
                'ufw' => false,
                'firewalld' => false,
                'iptables' => false,
            ],
            'raw_output' => $output,
        ];

        // Parse output
        if (str_contains($output, 'Active: true')) {
            $status['active'] = true;
            $status['detected'] = true;
        }

        if (preg_match('/Type:\s*(\w+)/', $output, $matches)) {
            $status['type'] = $matches[1];
        }

        if (str_contains($output, 'UFW: true')) {
            $status['available']['ufw'] = true;
        }

        if (str_contains($output, 'firewalld: true')) {
            $status['available']['firewalld'] = true;
        }

        if (str_contains($output, 'iptables: true')) {
            $status['available']['iptables'] = true;
        }

        Log::info('Firewall detection completed', $status);

        return $status;
    }

    /**
     * Allow single port through firewall
     *
     * @param int $port Port number (1-65535)
     * @param string $protocol Protocol (tcp, udp, or both)
     * @param string|null $comment Optional comment/description
     * @return bool True if successful or no firewall active
     */
    public static function allowPort(int $port, string $protocol = 'tcp', ?string $comment = null): bool
    {
        // Validate port
        if ($port < 1 || $port > 65535) {
            Log::error('Invalid port number', ['port' => $port]);
            return false;
        }

        // Validate protocol
        $protocol = strtolower($protocol);
        if (!in_array($protocol, ['tcp', 'udp', 'both'])) {
            Log::error('Invalid protocol', ['protocol' => $protocol]);
            return false;
        }

        $comment = $comment ?? "Port {$port}";

        Log::info('Adding firewall rule', [
            'port' => $port,
            'protocol' => $protocol,
            'comment' => $comment
        ]);

        $result = Process::run(
            "bash -c 'source " . self::FIREWALL_SCRIPT . " && firewall_allow_port {$port} {$protocol} \"" . addslashes($comment) . "\"'"
        );

        if ($result->successful() || str_contains($result->output(), 'No active firewall detected')) {
            Log::info('Firewall rule added', [
                'port' => $port,
                'protocol' => $protocol,
                'output' => $result->output()
            ]);
            return true;
        }

        Log::error('Failed to add firewall rule', [
            'port' => $port,
            'protocol' => $protocol,
            'output' => $result->output(),
            'error' => $result->errorOutput()
        ]);

        return false;
    }

    /**
     * Allow port range through firewall
     *
     * @param int $startPort Start port number
     * @param int $endPort End port number
     * @param string $protocol Protocol (tcp, udp, or both)
     * @param string|null $comment Optional comment/description
     * @return bool True if successful or no firewall active
     */
    public static function allowPortRange(int $startPort, int $endPort, string $protocol = 'tcp', ?string $comment = null): bool
    {
        // Validate ports
        if ($startPort < 1 || $startPort > 65535 || $endPort < 1 || $endPort > 65535) {
            Log::error('Invalid port range', ['start' => $startPort, 'end' => $endPort]);
            return false;
        }

        if ($startPort > $endPort) {
            Log::error('Start port must be less than or equal to end port', [
                'start' => $startPort,
                'end' => $endPort
            ]);
            return false;
        }

        $protocol = strtolower($protocol);
        if (!in_array($protocol, ['tcp', 'udp', 'both'])) {
            Log::error('Invalid protocol', ['protocol' => $protocol]);
            return false;
        }

        $comment = $comment ?? "Ports {$startPort}-{$endPort}";

        Log::info('Adding firewall rule for port range', [
            'start_port' => $startPort,
            'end_port' => $endPort,
            'protocol' => $protocol,
            'comment' => $comment
        ]);

        $result = Process::run(
            "bash -c 'source " . self::FIREWALL_SCRIPT . " && firewall_allow_port_range {$startPort} {$endPort} {$protocol} \"" . addslashes($comment) . "\"'"
        );

        if ($result->successful() || str_contains($result->output(), 'No active firewall detected')) {
            Log::info('Firewall rule added for port range', [
                'start_port' => $startPort,
                'end_port' => $endPort,
                'protocol' => $protocol,
                'output' => $result->output()
            ]);
            return true;
        }

        Log::error('Failed to add firewall rule for port range', [
            'start_port' => $startPort,
            'end_port' => $endPort,
            'protocol' => $protocol,
            'output' => $result->output(),
            'error' => $result->errorOutput()
        ]);

        return false;
    }

    /**
     * Remove port rule from firewall
     *
     * @param int $port Port number
     * @param string $protocol Protocol (tcp or udp)
     * @return bool True if successful or no firewall active
     */
    public static function removePort(int $port, string $protocol = 'tcp'): bool
    {
        if ($port < 1 || $port > 65535) {
            Log::error('Invalid port number', ['port' => $port]);
            return false;
        }

        $protocol = strtolower($protocol);
        if (!in_array($protocol, ['tcp', 'udp'])) {
            Log::error('Invalid protocol', ['protocol' => $protocol]);
            return false;
        }

        Log::info('Removing firewall rule', [
            'port' => $port,
            'protocol' => $protocol
        ]);

        $result = Process::run(
            "bash -c 'source " . self::FIREWALL_SCRIPT . " && firewall_remove_port {$port} {$protocol}'"
        );

        if ($result->successful() || str_contains($result->output(), 'No active firewall detected')) {
            Log::info('Firewall rule removed', [
                'port' => $port,
                'protocol' => $protocol,
                'output' => $result->output()
            ]);
            return true;
        }

        Log::warning('Failed to remove firewall rule (rule may not exist)', [
            'port' => $port,
            'protocol' => $protocol,
            'output' => $result->output()
        ]);

        return false;
    }

    /**
     * List all firewall rules
     *
     * @return array Firewall rules and status
     */
    public static function listRules(): array
    {
        $result = Process::run(
            "bash -c 'source " . self::FIREWALL_SCRIPT . " && firewall_list_rules'"
        );

        return [
            'success' => $result->successful(),
            'output' => $result->output(),
            'error' => $result->errorOutput(),
        ];
    }

    /**
     * Get comprehensive firewall status
     *
     * @return array Firewall status including detection, type, and available systems
     */
    public static function getStatus(): array
    {
        return self::detectFirewall();
    }

    /**
     * Check if firewall is active
     *
     * @return bool True if a firewall is active
     */
    public static function isActive(): bool
    {
        $status = self::detectFirewall();
        return $status['active'];
    }

    /**
     * Allow Octane/Swoole port through firewall
     *
     * @param int $port Swoole port number
     * @param string $description Service description
     * @return bool True if successful or no firewall active
     */
    public static function allowOctanePort(int $port, string $description = 'Laravel Octane'): bool
    {
        return self::allowPort($port, 'tcp', $description);
    }

    /**
     * Allow common web ports through firewall
     * Includes: 80 (HTTP), 443 (HTTPS)
     *
     * @return array Results for each port
     */
    public static function allowWebPorts(): array
    {
        $results = [];

        $results[80] = self::allowPort(80, 'tcp', 'HTTP');
        $results[443] = self::allowPort(443, 'tcp', 'HTTPS');

        Log::info('Web ports firewall rules configured', $results);

        return $results;
    }

    /**
     * Allow SSH port through firewall (safety check)
     *
     * @param int $port SSH port (default: 22)
     * @return bool True if successful or no firewall active
     */
    public static function allowSSH(int $port = 22): bool
    {
        Log::warning('Allowing SSH port through firewall', ['port' => $port]);
        return self::allowPort($port, 'tcp', 'SSH');
    }
}
