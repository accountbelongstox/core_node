<?php

namespace App\Services\AiGateway;

class AiRequestFailure
{
    private const RULES = [
        ['local_rate_limit', ['rate limit (', 'provider cooldown'], true, false],
        ['dns', ['could not resolve host', 'getaddrinfo failed', 'failed to resolve'], true, false],
        ['connect_timeout', ['connect timeout', 'connection timed out'], true, false],
        ['connection', ['failed to connect', 'connection refused', 'no route to host', 'network is unreachable'], true, false],
        ['read_timeout', ['operation timed out', 'curl error 28', 'read timed out'], true, true],
        ['quota', ['requests/day exceeded', 'daily request limit', 'quota exceeded', 'insufficient quota'], true, true],
        ['rate_limit', ['http 429', 'too many requests', 'rate_limit', 'ratelimit'], true, true],
        ['authentication', ['http 401', 'http 403', 'invalid api key', 'invalid_api_key'], false, true],
        ['provider_unavailable', ['http 500', 'http 502', 'http 503', 'http 504', 'overloaded', 'service unavailable', 'bad gateway'], true, true],
        ['empty_response', ['empty response from provider'], true, true],
    ];

    public static function classify(?string $error): array
    {
        $normalized = strtolower(trim((string) $error));
        if ($normalized === '') {
            return ['code' => null, 'retriable' => false, 'provider_reached' => true];
        }
        foreach (self::RULES as [$code, $marks, $retriable, $providerReached]) {
            foreach ($marks as $mark) {
                if (str_contains($normalized, $mark)) {
                    return [
                        'code' => $code,
                        'retriable' => $retriable,
                        'provider_reached' => $providerReached,
                    ];
                }
            }
        }
        return ['code' => 'unknown', 'retriable' => false, 'provider_reached' => true];
    }
}
