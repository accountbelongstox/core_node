<?php

namespace App\Support;

use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Symfony\Component\Yaml\Yaml;

/**
 * Headscale control server facts and actions for the mesh login guide
 * (contract access.mesh.headscale). Runs the local `headscale` CLI, so it is
 * available only on the host that serves the control server. Command output
 * is never logged: it can carry pre-auth keys.
 */
final class MeshHeadscale
{
    private const COMMAND_TIMEOUT_SECONDS = 20;

    public static function available(): bool
    {
        return self::binary() !== null && is_readable(self::configFile());
    }

    /**
     * Login server, MagicDNS domain, user and the live node list, read from the
     * running server's own config and CLI.
     *
     * @return array<string, mixed>
     */
    public static function guide(): array
    {
        $headscale = ServiceContract::section('access.mesh.headscale');
        $config = self::config();
        $nodes = self::json(['nodes', 'list']);

        return [
            'login_server' => (string) ($config['server_url'] ?? ''),
            'mesh_domain' => (string) ($config['dns']['base_domain'] ?? ''),
            'user' => (string) $headscale['user'],
            'key_expiration' => (string) $headscale['guide_key_expiration'],
            'mobile_clients' => $headscale['mobile_clients'],
            'nodes' => array_map(static fn (array $node): array => [
                'name' => (string) ($node['given_name'] ?? $node['name'] ?? ''),
                'ip_addresses' => array_values($node['ip_addresses'] ?? []),
                'online' => (bool) ($node['online'] ?? false),
                'last_seen' => isset($node['last_seen']['seconds']) ? date(DATE_ATOM, (int) $node['last_seen']['seconds']) : null,
            ], is_array($nodes) ? $nodes : []),
        ];
    }

    /**
     * A new single-use pre-auth key for the contract user; null on failure.
     *
     * @return array{key: string, expiration: string|null}|null
     */
    public static function createPreauthKey(): ?array
    {
        $userId = self::userId();
        $created = null;

        if ($userId === null) {
            return null;
        }
        $created = self::json([
            'preauthkeys', 'create',
            '--user', (string) $userId,
            '--expiration', ServiceContract::string('access.mesh.headscale.guide_key_expiration'),
        ]);
        if (!is_array($created) || empty($created['key'])) {
            return null;
        }

        return [
            'key' => (string) $created['key'],
            'expiration' => isset($created['expiration']['seconds']) ? date(DATE_ATOM, (int) $created['expiration']['seconds']) : null,
        ];
    }

    /** Approves a pending interactive login (the auth ID from the client's register URL). */
    public static function register(string $authId): bool
    {
        return self::run([
            'auth', 'register',
            '--auth-id', $authId,
            '--user', ServiceContract::string('access.mesh.headscale.user'),
        ])['success'];
    }

    private static function userId(): ?int
    {
        $name = ServiceContract::string('access.mesh.headscale.user');

        foreach ((array) self::json(['users', 'list']) as $user) {
            if (is_array($user) && ($user['name'] ?? '') === $name && isset($user['id'])) {
                return (int) $user['id'];
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    private static function config(): array
    {
        $parsed = is_readable(self::configFile()) ? Yaml::parseFile(self::configFile()) : [];

        return is_array($parsed) ? $parsed : [];
    }

    private static function configFile(): string
    {
        return rtrim(ServiceContract::string('access.mesh.headscale.config_dir'), '/')
            .'/'.ServiceContract::string('access.mesh.headscale.config_file');
    }

    private static function binary(): ?string
    {
        return (new ExecutableFinder())->find('headscale');
    }

    private static function json(array $arguments): mixed
    {
        $result = self::run(array_merge($arguments, ['-o', 'json']));

        return $result['success'] ? json_decode($result['output'], true) : null;
    }

    /** @return array{success: bool, output: string} */
    private static function run(array $arguments): array
    {
        $binary = self::binary();
        $process = null;

        if ($binary === null) {
            return ['success' => false, 'output' => ''];
        }
        $process = new Process(array_merge([$binary, '--config', self::configFile()], $arguments));
        $process->setTimeout(self::COMMAND_TIMEOUT_SECONDS);
        $process->run();

        return ['success' => $process->isSuccessful(), 'output' => $process->getOutput()];
    }
}
