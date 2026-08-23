<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;

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

    public static function assertSameDigest(string $receivedDigest, array $context = []): void
    {
        $expected = self::digest();

        if (hash_equals($expected, $receivedDigest)) {
            return;
        }
        Log::warning('[RelayV2] Contract digest rejected', $context + [
            'expected_digest' => $expected,
            'received_digest' => $receivedDigest,
        ]);
        throw new RelayV2DomainException('contract_digest_conflict', 409);
    }

    public static function normalizeCapabilities(array $capabilities): array
    {
        $normalized = array_values(array_unique(array_map('strval', $capabilities)));
        sort($normalized, SORT_STRING);

        return $normalized;
    }

    public static function capabilityDigest(array $capabilities): string
    {
        return hash('sha256', implode("\n", self::normalizeCapabilities($capabilities)));
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

    public static function rateLimit(string $name): int
    {
        $document = self::document();
        $value = (int) ($document['rate_limits'][$name] ?? 0);
        if ($value < 1) {
            throw new RelayV2DomainException('contract_rate_limit_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function publicUrl(string $name): string
    {
        $document = self::document();
        $value = (string) ($document['public_urls'][$name] ?? '');
        if ($value === '') {
            throw new RelayV2DomainException('contract_public_url_missing', 500, ['name' => $name]);
        }

        return $value;
    }

    public static function eventPayloadFields(string $name): array
    {
        $document = self::document();
        $values = $document['event_payload_profiles'][$name] ?? [];
        if (!is_array($values) || $values === []) {
            throw new RelayV2DomainException('contract_event_payload_missing', 500, ['name' => $name]);
        }

        return array_values(array_map('strval', $values));
    }

    public static function generationFields(string $endpointName): array
    {
        $document = self::document();
        $profile = is_array($document['claim_generation_profile'] ?? null)
            ? $document['claim_generation_profile']
            : [];
        $endpoints = array_values(array_map('strval', is_array($profile['query_bound_endpoints'] ?? null)
            ? $profile['query_bound_endpoints']
            : []));
        $fields = array_values(array_map('strval', is_array($profile['fields'] ?? null)
            ? $profile['fields']
            : []));

        if (!in_array($endpointName, $endpoints, true)
            || $fields !== ['operation_revision', 'claim_epoch', 'lease_owner']) {
            throw new RelayV2DomainException('contract_generation_profile_invalid', 500, ['name' => $endpointName]);
        }

        return $fields;
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
        $tokens['laravel_api_origin'] = self::publicUrl('laravel_api_origin');
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
        $matching = is_array($document['route_policy_matching'] ?? null) ? $document['route_policy_matching'] : [];
        $precedenceValues = is_array($matching['precedence'] ?? null) ? $matching['precedence'] : [];
        $precedence = [];
        $methods = [];
        $matchKind = '';
        $matchValue = '';
        $matched = false;
        $profileName = '';
        $profile = [];
        $bestPolicy = null;
        $bestScore = null;
        $score = [];
        $defaultProfile = (string) ($matching['default_profile'] ?? '');
        foreach ($precedenceValues as $index => $kind) {
            $precedence[(string) $kind] = count($precedenceValues) - $index;
        }
        foreach ($policies as $declarationIndex => $policy) {
            $methods = array_map('strtoupper', is_array($policy['methods'] ?? null) ? $policy['methods'] : []);
            if (!in_array($normalizedMethod, $methods, true)) {
                continue;
            }
            $matchKind = (string) ($policy['match'] ?? 'exact');
            $matchValue = $matchKind === 'exact'
                ? trim((string) ($policy['value'] ?? ''), '/')
                : ($matchKind === 'prefix'
                    ? ltrim((string) ($policy['value'] ?? ''), '/')
                    : rtrim((string) ($policy['value'] ?? ''), '/'));
            $matched = $matchKind === 'exact'
                ? $normalizedPath === $matchValue
                : ($matchKind === 'prefix'
                    ? str_starts_with($normalizedPath, $matchValue)
                    : ($matchKind === 'suffix'
                        ? str_ends_with($normalizedPath, $matchValue)
                        : false));
            if (!$matched) {
                continue;
            }
            $score = [(int) ($precedence[$matchKind] ?? 0), strlen($matchValue), -$declarationIndex];
            if ($bestScore === null || self::routeScoreIsBetter($score, $bestScore)) {
                $bestScore = $score;
                $bestPolicy = $policy;
            }
        }
        if (is_array($bestPolicy)) {
            $profileName = (string) ($bestPolicy['profile'] ?? '');
            $profile = is_array($profiles[$profileName] ?? null) ? $profiles[$profileName] : [];

            return array_merge($bestPolicy, $profile);
        }
        $profile = is_array($profiles[$defaultProfile] ?? null) ? $profiles[$defaultProfile] : [];

        return array_merge([
            'match' => 'default',
            'value' => $normalizedPath,
            'methods' => [$normalizedMethod],
            'profile' => $defaultProfile,
        ], $profile);
    }

    public static function canonicalPath(string $path): string
    {
        $rawPath = $path;
        $oneSlashPath = '';
        $decoded = '';
        $encoded = '';
        $character = '';
        $ordinal = 0;
        $triplet = '';
        if (str_contains($rawPath, '?')
            || str_contains($rawPath, '#')
            || str_starts_with($rawPath, '//')
            || str_contains($rawPath, '\\')) {
            throw new RelayV2DomainException('signature_path_invalid', 400);
        }
        for ($index = 0, $length = strlen($rawPath); $index < $length; $index++) {
            if ($rawPath[$index] !== '%') {
                continue;
            }
            $triplet = substr($rawPath, $index + 1, 2);
            if (strlen($triplet) !== 2
                || !ctype_xdigit($triplet)
                || in_array(strtolower($triplet), ['2f', '5c'], true)) {
                throw new RelayV2DomainException('signature_path_invalid', 400);
            }
        }
        $oneSlashPath = '/'.ltrim($rawPath, '/');
        $decoded = rawurldecode($oneSlashPath);
        if (!mb_check_encoding($decoded, 'UTF-8')) {
            throw new RelayV2DomainException('signature_path_invalid', 400);
        }
        for ($index = 0, $length = strlen($decoded); $index < $length; $index++) {
            $character = $decoded[$index];
            $ordinal = ord($character);
            if ($ordinal < 32 || $ordinal === 127) {
                throw new RelayV2DomainException('signature_path_invalid', 400);
            }
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
            $key = self::decodeFormComponent((string) ($parts[0] ?? ''));
            $value = self::decodeFormComponent((string) ($parts[1] ?? ''));
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
            if (!is_string($rawKey)) {
                throw new RelayV2DomainException('query_key_invalid', 422);
            }
            $values = is_array($rawValue) ? $rawValue : [$rawValue];
            foreach ($values as $rawItem) {
                if (!is_string($rawItem)) {
                    throw new RelayV2DomainException('query_value_invalid', 422);
                }
                $pairs[] = [$rawKey, $rawItem];
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
            'public_urls',
            'topics',
            'events',
            'event_payload_profiles',
            'claim_generation_profile',
            'mercure_profile',
            'lease_profile',
            'durations',
            'limits',
            'rate_limits',
            'headers',
            'operation_states',
            'operation_transitions',
            'transition_guards',
            'result_outcomes',
            'retry_policies',
            'route_policy_matching',
            'route_policy_profiles',
            'route_policies',
            'capabilities',
        ];
        $requiredProfileFields = ['exposure', 'permission', 'payload', 'timeout_seconds', 'retry'];
        $requiredSignatureHeaders = [
            'protocol',
            'device_id',
            'credential_id',
            'credential_version',
            'timestamp',
            'nonce',
            'content_sha256',
            'signature',
        ];
        $requiredEndpoints = [
            'enrollment_create',
            'enrollment_status',
            'device_heartbeat',
            'device_event',
            'device_hub_authorization',
            'operation_claim',
            'operation_execution_start',
            'operation_lease_renew',
            'operation_result',
            'device_request_blob_download',
            'device_response_blob_allocate',
            'device_response_blob_chunk',
            'device_response_blob_finalize',
            'owner_enrollment_claim',
            'owner_device_roster',
            'owner_pairing_create',
            'owner_pairing_renew',
            'owner_pairing_revoke',
            'owner_hub_authorization',
            'owner_operation_admit',
            'owner_operation_status',
            'owner_operation_cancel',
            'owner_request_blob_allocate',
            'owner_request_blob_chunk',
            'owner_request_blob_finalize',
            'owner_response_blob_download',
        ];
        $requiredDurations = [
            'operation_lease_seconds',
            'signature_clock_skew_seconds',
            'nonce_retention_seconds',
            'enrollment_retention_seconds',
            'subscriber_token_seconds',
            'credential_lifetime_seconds',
            'pairing_lease_seconds',
            'operation_retention_seconds',
            'blob_retention_seconds',
            'outbox_retention_seconds',
            'outbox_retry_max_seconds',
        ];
        $requiredLimits = [
            'claim_batch',
            'inline_body_bytes',
            'blob_chunk_bytes',
            'request_body_bytes',
            'response_body_bytes',
            'header_value_bytes',
            'owner_blob_bytes',
            'owner_pending_operations',
            'device_active_leases',
            'device_event_payload_bytes',
            'outbox_publish_batch',
            'outbox_publish_attempts',
            'maintenance_row_batch',
            'maintenance_blob_batch',
        ];
        $requiredEvents = [
            'operation_available',
            'operation_status',
            'pairing_changed',
            'credential_revoked',
            'terminal_changed',
        ];
        $requiredTopics = ['device_wake', 'owner_roster', 'pairing_operation'];
        $requiredPublicUrls = ['laravel_api_origin', 'mercure_hub'];
        $requiredRateLimits = [
            'device_requests_per_minute',
            'owner_requests_per_minute',
            'enrollment_claims_per_minute',
        ];
        $profiles = [];
        $states = [];
        $transitionStates = [];
        $resultOutcomes = [];
        $retryPolicies = [];
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
        self::assertRequiredNames($document['signature_profile']['headers'] ?? [], $requiredSignatureHeaders, 'contract_header_missing');
        self::assertRequiredNames($document['endpoints'], $requiredEndpoints, 'contract_endpoint_missing');
        self::assertRequiredNames($document['public_urls'], $requiredPublicUrls, 'contract_public_url_missing');
        self::assertRequiredNames($document['topics'], $requiredTopics, 'contract_topic_missing');
        self::assertRequiredNames($document['events'], $requiredEvents, 'contract_event_missing');
        if (count(array_unique(array_values($document['events']), SORT_STRING)) !== count($document['events'])) {
            throw new RelayV2DomainException('contract_event_missing', 500, ['name' => 'unique_event_values']);
        }
        self::assertPositiveNames($document['durations'], $requiredDurations, 'contract_duration_missing');
        self::assertPositiveNames($document['limits'], $requiredLimits, 'contract_limit_missing');
        self::assertPositiveNames($document['rate_limits'], $requiredRateLimits, 'contract_rate_limit_missing');
        foreach ($requiredEvents as $eventName) {
            if (!is_array($document['event_payload_profiles'][$eventName] ?? null)
                || $document['event_payload_profiles'][$eventName] === []) {
                throw new RelayV2DomainException('contract_event_payload_missing', 500, ['name' => $eventName]);
            }
        }
        if (($document['claim_generation_profile']['fields'] ?? null) !== ['operation_revision', 'claim_epoch', 'lease_owner']
            || ($document['claim_generation_profile']['query_bound_endpoints'] ?? null)
                !== ['device_request_blob_download', 'device_response_blob_chunk']) {
            throw new RelayV2DomainException('contract_generation_profile_invalid', 500);
        }
        self::assertPublicUrls($document);
        if (($document['route_policy_matching']['precedence'] ?? null) !== ['exact', 'prefix', 'suffix']
            || (string) ($document['route_policy_matching']['tie_breaker'] ?? '') !== 'longest-value-then-first-declared'
            || !array_key_exists((string) ($document['route_policy_matching']['default_profile'] ?? ''), $document['route_policy_profiles'])) {
            throw new RelayV2DomainException('contract_route_profile_invalid', 500, ['name' => 'route_policy_matching']);
        }
        if ((string) ($document['signature_profile']['algorithm'] ?? '') !== 'ed25519') {
            throw new RelayV2DomainException('contract_signature_profile_invalid', 500);
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
        foreach ($document['operation_transitions'] as $targets) {
            if (!is_array($targets) || array_diff(array_map('strval', $targets), $states) !== []) {
                throw new RelayV2DomainException('contract_transitions_invalid', 500);
            }
        }
        $resultOutcomes = array_values(array_map('strval', $document['result_outcomes']));
        if ($resultOutcomes === [] || array_diff($resultOutcomes, $states) !== []) {
            throw new RelayV2DomainException('contract_result_outcomes_invalid', 500);
        }
        $retryPolicies = array_values(array_map('strval', $document['retry_policies']));
        if ($retryPolicies === []) {
            throw new RelayV2DomainException('contract_retry_policies_invalid', 500);
        }
        foreach ($profiles as $profile) {
            if (!is_array($profile)
                || !in_array((string) ($profile['retry'] ?? ''), $retryPolicies, true)) {
                throw new RelayV2DomainException('contract_retry_policies_invalid', 500);
            }
        }
        self::$rawBytes = $bytes;
        self::$document = $document;
        self::$digest = hash('sha256', $bytes);
    }

    private static function formEncode(string $value): string
    {
        return str_replace('%20', '+', rawurlencode($value));
    }

    private static function decodeFormComponent(string $value): string
    {
        $triplet = '';
        $decoded = '';

        for ($index = 0, $length = strlen($value); $index < $length; $index++) {
            if ($value[$index] !== '%') {
                continue;
            }
            $triplet = substr($value, $index + 1, 2);
            if (strlen($triplet) !== 2 || !ctype_xdigit($triplet)) {
                throw new RelayV2DomainException('signature_query_invalid', 400);
            }
        }
        $decoded = urldecode($value);
        if (!mb_check_encoding($decoded, 'UTF-8')) {
            throw new RelayV2DomainException('signature_query_invalid', 400);
        }

        return $decoded;
    }

    private static function routeScoreIsBetter(array $candidate, array $current): bool
    {
        if ($candidate[0] !== $current[0]) {
            return $candidate[0] > $current[0];
        }
        if ($candidate[1] !== $current[1]) {
            return $candidate[1] > $current[1];
        }

        return $candidate[2] > $current[2];
    }

    private static function assertPublicUrls(array $document): void
    {
        $origin = (string) $document['public_urls']['laravel_api_origin'];
        $hub = (string) $document['public_urls']['mercure_hub'];
        $originParts = parse_url($origin);
        $hubParts = parse_url($hub);
        $hubPath = (string) ($document['mercure_profile']['hub_path'] ?? '');

        if (!is_array($originParts)
            || ($originParts['scheme'] ?? '') !== 'https'
            || (string) ($originParts['host'] ?? '') === ''
            || isset($originParts['user'])
            || isset($originParts['pass'])
            || (string) ($originParts['path'] ?? '') !== ''
            || isset($originParts['query'])
            || isset($originParts['fragment'])) {
            throw new RelayV2DomainException('contract_public_url_invalid', 500, ['name' => 'laravel_api_origin']);
        }
        if (!is_array($hubParts)
            || ($hubParts['scheme'] ?? '') !== ($originParts['scheme'] ?? '')
            || ($hubParts['host'] ?? '') !== ($originParts['host'] ?? '')
            || ($hubParts['port'] ?? null) !== ($originParts['port'] ?? null)
            || (string) ($hubParts['path'] ?? '') !== $hubPath
            || isset($hubParts['user'])
            || isset($hubParts['pass'])
            || isset($hubParts['query'])
            || isset($hubParts['fragment'])) {
            throw new RelayV2DomainException('contract_public_url_invalid', 500, ['name' => 'mercure_hub']);
        }
    }

    private static function assertRequiredNames(mixed $section, array $names, string $errorCode): void
    {
        $values = is_array($section) ? $section : [];

        foreach ($names as $name) {
            if (!is_string($values[$name] ?? null) || trim((string) $values[$name]) === '') {
                throw new RelayV2DomainException($errorCode, 500, ['name' => $name]);
            }
        }
    }

    private static function assertPositiveNames(mixed $section, array $names, string $errorCode): void
    {
        $values = is_array($section) ? $section : [];

        foreach ($names as $name) {
            if ((int) ($values[$name] ?? 0) < 1) {
                throw new RelayV2DomainException($errorCode, 500, ['name' => $name]);
            }
        }
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
