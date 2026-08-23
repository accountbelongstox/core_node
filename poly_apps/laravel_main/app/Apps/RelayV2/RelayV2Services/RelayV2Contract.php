<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class RelayV2Contract
{
    private static ?array $document = null;
    private static ?string $rawBytes = null;
    private static ?string $digest = null;

    public static function document(): array
    {
        self::load();

        return self::$document ?? [];
    }

    public static function digest(): string
    {
        self::load();

        return self::$digest ?? '';
    }

    public static function protocolVersion(): string
    {
        $document = self::document();

        return (string) ($document['protocol_version'] ?? '');
    }

    public static function header(string $name): string
    {
        $document = self::document();
        $value = (string) ($document['signature_profile']['headers'][$name] ?? '');
        if ($value === '') {
            throw new RelayV2DomainException('contract_header_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function duration(string $name): int
    {
        $document = self::document();
        $value = (int) ($document['durations'][$name] ?? 0);
        if ($value < 1) {
            throw new RelayV2DomainException('contract_duration_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function limit(string $name): int
    {
        $document = self::document();
        $value = (int) ($document['limits'][$name] ?? 0);
        if ($value < 1) {
            throw new RelayV2DomainException('contract_limit_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function event(string $name): string
    {
        $document = self::document();
        $value = (string) ($document['events'][$name] ?? '');
        if ($value === '') {
            throw new RelayV2DomainException('contract_event_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function endpoint(string $name): string
    {
        $document = self::document();
        $value = (string) ($document['endpoints'][$name] ?? '');
        if ($value === '') {
            throw new RelayV2DomainException('contract_endpoint_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function topic(string $name, array $tokens): string
    {
        $document = self::document();
        $template = (string) ($document['topics'][$name] ?? '');
        $resolved = $template;
        if ($template === '') {
            throw new RelayV2DomainException('contract_topic_missing', 500, ['name' => $name]);
        }
        foreach ($tokens as $key => $value) {
            $resolved = str_replace('{'.$key.'}', (string) $value, $resolved);
        }
        if (str_contains($resolved, '{')) {
            throw new RelayV2DomainException('contract_topic_token_missing', 500, ['name' => $name]);
        }

        return $resolved;
    }

    public static function allowedHeaders(string $direction): array
    {
        $document = self::document();
        $values = $document['headers'][$direction.'_allow'] ?? [];

        return array_values(array_map(
            static fn (mixed $value): string => strtolower((string) $value),
            is_array($values) ? $values : []
        ));
    }

    public static function filterHeaders(array $headers, string $direction): array
    {
        $allowed = array_flip(self::allowedHeaders($direction));
        $filtered = [];
        $name = '';
        $value = '';
        foreach ($headers as $rawName => $rawValue) {
            $name = strtolower(trim((string) $rawName));
            if (!is_scalar($rawValue)) {
                continue;
            }
            $value = trim((string) $rawValue);
            if (isset($allowed[$name]) && strlen($value) <= self::limit('header_value_bytes')) {
                $filtered[$name] = $value;
            }
        }
        ksort($filtered, SORT_STRING);

        return $filtered;
    }

    public static function routePolicy(string $path, string $method): array
    {
        $document = self::document();
        $normalizedPath = trim($path, '/');
        $normalizedMethod = strtoupper($method);
        $policies = is_array($document['route_policies'] ?? null) ? $document['route_policies'] : [];
        $profiles = is_array($document['route_policy_profiles'] ?? null) ? $document['route_policy_profiles'] : [];
        $methods = [];
        $matchKind = '';
        $matchValue = '';
        $matched = false;
        $profileName = '';
        $profile = [];
        foreach ($policies as $policy) {
            $methods = array_map('strtoupper', is_array($policy['methods'] ?? null) ? $policy['methods'] : []);
            if (!in_array($normalizedMethod, $methods, true)) {
                continue;
            }
            $matchKind = (string) ($policy['match'] ?? 'exact');
            $matchValue = trim((string) ($policy['value'] ?? ''), '/');
            $matched = $matchKind === 'exact'
                ? $normalizedPath === $matchValue
                : ($matchKind === 'prefix'
                    ? str_starts_with($normalizedPath, ltrim((string) ($policy['value'] ?? ''), '/'))
                    : ($matchKind === 'suffix'
                        ? str_ends_with($normalizedPath, rtrim((string) ($policy['value'] ?? ''), '/'))
                        : false));
            if (!$matched) {
                continue;
            }
            $profileName = (string) ($policy['profile'] ?? '');
            $profile = is_array($profiles[$profileName] ?? null) ? $profiles[$profileName] : [];

            return array_merge($policy, $profile);
        }
        $profile = is_array($profiles['denied'] ?? null) ? $profiles['denied'] : [];

        return array_merge([
            'match' => 'default',
            'value' => $normalizedPath,
            'methods' => [$normalizedMethod],
            'profile' => 'denied',
        ], $profile);
    }

    public static function canonicalPath(string $path): string
    {
        $oneSlashPath = '/'.ltrim($path, '/');
        $decoded = rawurldecode($oneSlashPath);
        $encoded = '';
        $character = '';
        $ordinal = 0;
        if (str_contains($path, '?') || str_contains($path, '#') || !mb_check_encoding($decoded, 'UTF-8')) {
            throw new RelayV2DomainException('signature_path_invalid', 400);
        }
        for ($index = 0, $length = strlen($decoded); $index < $length; $index++) {
            $character = $decoded[$index];
            $ordinal = ord($character);
            if (($ordinal >= 65 && $ordinal <= 90)
                || ($ordinal >= 97 && $ordinal <= 122)
                || ($ordinal >= 48 && $ordinal <= 57)
                || str_contains('/-._~', $character)) {
                $encoded .= $character;
            } else {
                $encoded .= sprintf('%%%02X', $ordinal);
            }
        }

        return $encoded;
    }

    public static function canonicalRawQuery(?string $rawQuery): string
    {
        $pairs = [];
        $segments = $rawQuery === null || $rawQuery === '' ? [] : explode('&', $rawQuery);
        $parts = [];
        $key = '';
        $value = '';
        foreach ($segments as $segment) {
            $parts = explode('=', $segment, 2);
            $key = urldecode((string) ($parts[0] ?? ''));
            $value = urldecode((string) ($parts[1] ?? ''));
            $pairs[] = [$key, $value];
        }
        usort($pairs, static function (array $left, array $right): int {
            $keyComparison = strcmp($left[0], $right[0]);

            return $keyComparison !== 0 ? $keyComparison : strcmp($left[1], $right[1]);
        });

        return implode('&', array_map(
            static fn (array $pair): string => self::formEncode($pair[0]).'='.self::formEncode($pair[1]),
            $pairs
        ));
    }

    public static function canonicalQuery(array $query): string
    {
        $pairs = [];
        $values = [];
        foreach ($query as $rawKey => $rawValue) {
            $values = is_array($rawValue) ? $rawValue : [$rawValue];
            foreach ($values as $rawItem) {
                if (!is_scalar($rawItem) && $rawItem !== null) {
                    throw new RelayV2DomainException('query_value_invalid', 422);
                }
                $pairs[] = [(string) $rawKey, (string) ($rawItem ?? '')];
            }
        }
        usort($pairs, static function (array $left, array $right): int {
            $keyComparison = strcmp($left[0], $right[0]);

            return $keyComparison !== 0 ? $keyComparison : strcmp($left[1], $right[1]);
        });

        return implode('&', array_map(
            static fn (array $pair): string => self::formEncode($pair[0]).'='.self::formEncode($pair[1]),
            $pairs
        ));
    }

    public static function requestDigest(
        string $method,
        string $path,
        array $query,
        array $headers,
        bool $bodyPresent,
        string $bodySha256,
        int $bodyLength
    ): string {
        $payload = [
            'method' => strtoupper($method),
            'path' => self::canonicalPath($path),
            'query' => self::canonicalQuery($query),
            'headers' => self::filterHeaders($headers, 'request'),
            'body_present' => $bodyPresent,
            'body_sha256' => strtolower($bodySha256),
            'body_length' => $bodyLength,
        ];

        return hash('sha256', self::canonicalJson($payload));
    }

    public static function resultDigest(
        int $status,
        array $headers,
        bool $bodyPresent,
        string $bodySha256,
        int $bodyLength
    ): string {
        $payload = [
            'status' => $status,
            'headers' => self::filterHeaders($headers, 'response'),
            'body_present' => $bodyPresent,
            'body_sha256' => strtolower($bodySha256),
            'body_length' => $bodyLength,
        ];

        return hash('sha256', self::canonicalJson($payload));
    }

    public static function canonicalJson(array $payload): string
    {
        $normalized = self::sortJsonValue($payload);

        return json_encode(
            $normalized,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR
        );
    }

    public static function transitionAllowed(string $source, string $target): bool
    {
        $document = self::document();
        $targets = is_array($document['operation_transitions'][$source] ?? null)
            ? $document['operation_transitions'][$source]
            : [];

        return in_array($target, $targets, true);
    }

    private static function load(): void
    {
        $root = PathMapper::getCoreNodeDir();
        $path = '';
        $bytes = false;
        $document = null;
        $requiredSections = [
            'signature_profile',
            'request_digest_profile',
            'response_digest_profile',
            'endpoints',
            'topics',
            'events',
            'mercure_profile',
            'lease_profile',
            'durations',
            'limits',
            'headers',
            'operation_states',
            'operation_transitions',
            'transition_guards',
            'result_outcomes',
            'route_policy_profiles',
            'route_policies',
        ];
        $requiredProfileFields = ['exposure', 'permission', 'payload', 'timeout_seconds', 'retry'];
        $profiles = [];
        $states = [];
        $transitionStates = [];
        if (self::$document !== null) {
            return;
        }
        if (!is_string($root) || $root === '') {
            throw new RelayV2DomainException('contract_root_missing', 500);
        }
        $path = $root.DIRECTORY_SEPARATOR.'config'.DIRECTORY_SEPARATOR.'pycore_relay_contract.json';
        $bytes = FileSystemManager::readFile($path, false);
        if (!is_string($bytes) || $bytes === '') {
            throw new RelayV2DomainException('contract_file_missing', 500);
        }
        $document = json_decode($bytes, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($document) || (int) ($document['schema_version'] ?? 0) !== 2) {
            throw new RelayV2DomainException('contract_schema_invalid', 500);
        }
        foreach ($requiredSections as $section) {
            if (!array_key_exists($section, $document)) {
                throw new RelayV2DomainException('contract_section_missing', 500, ['name' => $section]);
            }
        }
        $profiles = is_array($document['route_policy_profiles']) ? $document['route_policy_profiles'] : [];
        foreach ($document['route_policies'] as $policy) {
            $profileName = (string) ($policy['profile'] ?? '');
            $profile = is_array($profiles[$profileName] ?? null) ? $profiles[$profileName] : [];
            foreach ($requiredProfileFields as $field) {
                if (!array_key_exists($field, $profile)) {
                    throw new RelayV2DomainException('contract_route_profile_invalid', 500, ['name' => $profileName]);
                }
                if (array_key_exists($field, $policy) && $policy[$field] !== $profile[$field]) {
                    throw new RelayV2DomainException('contract_route_policy_conflict', 500, ['name' => (string) ($policy['value'] ?? '')]);
                }
            }
        }
        $states = array_values(array_map('strval', $document['operation_states']));
        $transitionStates = array_values(array_map('strval', array_keys($document['operation_transitions'])));
        sort($states, SORT_STRING);
        sort($transitionStates, SORT_STRING);
        if ($states !== $transitionStates) {
            throw new RelayV2DomainException('contract_transitions_invalid', 500);
        }
        self::$rawBytes = $bytes;
        self::$document = $document;
        self::$digest = hash('sha256', $bytes);
    }

    private static function formEncode(string $value): string
    {
        return str_replace('%20', '+', rawurlencode($value));
    }

    private static function sortJsonValue(mixed $value): mixed
    {
        $normalized = [];
        if (!is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            foreach ($value as $item) {
                $normalized[] = self::sortJsonValue($item);
            }

            return $normalized;
        }
        ksort($value, SORT_STRING);
        foreach ($value as $key => $item) {
            $normalized[(string) $key] = self::sortJsonValue($item);
        }

        return $normalized;
    }

    private function __construct()
    {
    }
}
