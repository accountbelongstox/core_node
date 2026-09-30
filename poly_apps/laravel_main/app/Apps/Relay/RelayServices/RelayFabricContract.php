<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Read-only adapter for config/pycore_relay_fabric_contract.json (Relay Fabric
 * V3). A separate file from the V2 relay contract keeps the V2 digest, and
 * every connected V2 device, untouched.
 */
final class RelayFabricContract
{
    private const FILE = 'pycore_relay_fabric_contract.json';
    private const REQUIRED_SECTIONS = ['endpoints', 'topics', 'event_types', 'envelope', 'limits', 'durations', 'lanes', 'errors'];

    private static ?array $document = null;
    private static string $digest = '';
    private static string $signature = '';

    public static function document(): array
    {
        self::load();

        return self::$document ?? [];
    }

    public static function digest(): string
    {
        self::load();

        return self::$digest;
    }

    public static function protocolVersion(): string
    {
        return (string) (self::document()['protocol_version'] ?? '');
    }

    public static function assertSameDigest(string $received): void
    {
        if (hash_equals(self::digest(), $received)) {
            return;
        }
        Log::warning('[RelayFabric] Contract digest rejected', [
            'expected_digest' => self::digest(),
            'received_digest' => $received,
        ]);
        throw new RelayDomainException('fabric_digest_conflict', 409);
    }

    public static function endpoint(string $name): string
    {
        return self::string('endpoints', $name);
    }

    public static function eventType(string $name): string
    {
        return self::string('event_types', $name);
    }

    public static function limit(string $name): int
    {
        return self::positiveInt('limits', $name);
    }

    public static function duration(string $name): int
    {
        return self::positiveInt('durations', $name);
    }

    public static function lane(string $profile): string
    {
        $lanes = self::document()['lanes'] ?? [];
        $profiles = is_array($lanes['route_policy_profiles'] ?? null) ? $lanes['route_policy_profiles'] : [];

        return (string) ($profiles[$profile] ?? ($lanes['default'] ?? 'durable'));
    }

    /**
     * @return array<int, string>
     */
    public static function fastRetryPolicies(): array
    {
        $lanes = self::document()['lanes'] ?? [];

        return array_values(array_map('strval', is_array($lanes['fast_retry_policies'] ?? null) ? $lanes['fast_retry_policies'] : []));
    }

    /**
     * @param array<string, string> $tokens
     */
    public static function topic(string $name, array $tokens): string
    {
        $template = self::string('topics', $name);
        $tokens['laravel_api_origin'] = RelayContract::publicUrl('laravel_api_origin');

        foreach ($tokens as $key => $value) {
            $template = str_replace('{'.$key.'}', (string) $value, $template);
        }
        if (str_contains($template, '{')) {
            throw new RelayDomainException('contract_topic_token_missing', 500, ['name' => $name]);
        }

        return $template;
    }

    private static function string(string $section, string $name): string
    {
        $value = self::document()[$section][$name] ?? '';

        if (!is_string($value) || $value === '') {
            throw new RelayDomainException('fabric_contract_invalid', 500, ['name' => $section.'.'.$name]);
        }

        return $value;
    }

    private static function positiveInt(string $section, string $name): int
    {
        $value = self::document()[$section][$name] ?? null;

        if (!is_int($value) || $value < 1) {
            throw new RelayDomainException('fabric_contract_invalid', 500, ['name' => $section.'.'.$name]);
        }

        return $value;
    }

    private static function load(): void
    {
        $path = rtrim(PathMapper::getCoreNodeDir(), '/\\').DIRECTORY_SEPARATOR.'config'.DIRECTORY_SEPARATOR.self::FILE;
        $signature = '';
        $bytes = false;
        $document = null;

        if (!is_file($path)) {
            throw new RelayDomainException('fabric_contract_invalid', 500, ['name' => self::FILE]);
        }
        $signature = ((string) filemtime($path)).':'.((string) filesize($path));
        if (self::$document !== null && self::$signature === $signature) {
            return;
        }
        $bytes = file_get_contents($path);
        $document = is_string($bytes) ? json_decode($bytes, true) : null;
        if (!is_array($document)) {
            throw new RelayDomainException('fabric_contract_invalid', 500, ['name' => self::FILE]);
        }
        foreach (self::REQUIRED_SECTIONS as $section) {
            if (!is_array($document[$section] ?? null)) {
                throw new RelayDomainException('fabric_contract_invalid', 500, ['name' => $section]);
            }
        }
        self::$document = $document;
        self::$signature = $signature;
        self::$digest = hash('sha256', str_replace("\r\n", "\n", $bytes));
    }

    private function __construct()
    {
    }
}
