<?php

namespace App\Services\Relay;

use App\Support\QueueCenterContract;
use App\Support\RuntimeConfigurationStore;
use Illuminate\Http\Request;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;

/**
 * Shared JWT facility for the Mercure hub embedded in FrankenPHP.
 *
 * FrankenPHP v1.12.7 embeds dunglas/mercure v0.24.2, whose native grant is
 * the `mercure.publish` and `mercure.subscribe` claims. Separate HS256 keys
 * keep publisher and subscriber authority isolated.
 */
final class RelayHubJwt
{
    public const PUBLISHER_KEY = 'MERCURE_PUBLISHER_JWT';
    public const SUBSCRIBER_KEY = 'MERCURE_SUBSCRIBER_JWT';
    public const TRUSTED_ISSUER_KEY = 'MERCURE_TRUSTED_ISSUERS';
    private const PUBLISHER_TTL_SECONDS = 300;

    public static function publisherToken(?string $hubUrl = null): string
    {
        return self::build(
            'publisher',
            ['publish' => ['*']],
            self::PUBLISHER_TTL_SECONDS,
            self::PUBLISHER_KEY,
            $hubUrl
        );
    }

    /**
     * @param array<int, string> $topics
     */
    public static function subscriberToken(string $subject, array $topics, ?string $hubUrl = null): string
    {
        return self::build(
            $subject,
            ['subscribe' => array_values(array_unique($topics))],
            QueueCenterContract::relayHubInt('token_ttl_seconds'),
            self::SUBSCRIBER_KEY,
            $hubUrl
        );
    }

    public static function hubUrl(): string
    {
        return self::servingOrigin().QueueCenterContract::relayHubString('path');
    }

    /**
     * Origin the hub is reached through: the live request's scheme + host,
     * falling back to the configured app URL outside request context
     * (CLI, queues). One derivation for aud, hub_url and subscribe URLs.
     */
    public static function servingOrigin(): string
    {
        $request = null;
        $issuer = '';

        if (function_exists('app') && app()->bound('request')) {
            $request = app('request');
            if ($request instanceof Request) {
                if ($request->server->has('HTTP_HOST') && $request->getHost() !== '') {
                    return $request->getSchemeAndHttpHost();
                }
            }
        }

        $issuer = RuntimeConfigurationStore::get(self::TRUSTED_ISSUER_KEY, '');
        if ($issuer !== '') {
            return rtrim($issuer, '/');
        }

        return rtrim((string) config('app.url'), '/');
    }

    /**
     * @param array{publish?: array<int, string>, subscribe?: array<int, string>} $grant
     */
    private static function build(
        string $subject,
        array $grant,
        int $ttlSeconds,
        string $keyName,
        ?string $hubUrl = null,
    ): string
    {
        $now = new \DateTimeImmutable();
        $issuer = self::trustedIssuer();
        $key = RuntimeConfigurationStore::get($keyName, '');
        if ($key === '') {
            throw new \RuntimeException(__('relay.mercure_key_missing', ['key' => $keyName]));
        }
        $configuration = Configuration::forSymmetricSigner(new Sha256(), InMemory::plainText($key));

        $token = $configuration->builder()
            ->withHeader('typ', 'at+jwt')
            ->issuedBy($issuer)
            ->identifiedBy('urn:uuid:'.(string) \Illuminate\Support\Str::uuid())
            ->permittedFor($hubUrl ?? self::hubUrl())
            ->relatedTo($subject)
            ->issuedAt($now)
            ->expiresAt($now->modify('+'.$ttlSeconds.' seconds'))
            ->withClaim('client_id', $issuer)
            ->withClaim('mercure', $grant)
            ->getToken($configuration->signer(), $configuration->signingKey());

        return $token->toString();
    }

    /**
     * The `iss` this app signs with and the hub trusts. Single source: the
     * secret store (provisioned first by the server runtime, which knows the
     * public site host); self-bootstraps from the serving origin when absent
     * so every launch surface (worker, CLI, local dev) can issue tokens.
     */
    public static function trustedIssuer(): string
    {
        $issuer = RuntimeConfigurationStore::get(self::TRUSTED_ISSUER_KEY, '');
        $stored = '';

        if ($issuer !== '') {
            return $issuer;
        }

        $issuer = self::servingOrigin();
        RuntimeConfigurationStore::put(self::TRUSTED_ISSUER_KEY, $issuer);
        $stored = RuntimeConfigurationStore::get(self::TRUSTED_ISSUER_KEY, '');
        if ($stored === '' || !hash_equals($issuer, $stored)) {
            throw new \RuntimeException(__('relay.mercure_issuer_missing'));
        }

        return $stored;
    }
}
