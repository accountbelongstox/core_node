<?php

namespace App\Services\Relay;

use App\Support\QueueCenterContract;
use App\Support\RuntimeConfigurationStore;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;

/**
 * Shared JWT facility for the Mercure hub embedded in FrankenPHP.
 *
 * FrankenPHP v1.12.7 embeds dunglas/mercure v0.24.2, whose native grant is
 * the `mercure.publish` / `mercure.subscribe` claim. One HS256 signer and one
 * key source are shared by every relay publisher and subscriber.
 */
final class RelayHubJwt
{
    public const PUBLISHER_KEY = 'MERCURE_PUBLISHER_JWT';
    public const SUBSCRIBER_KEY = 'MERCURE_SUBSCRIBER_JWT';
    public const TRUSTED_ISSUER_KEY = 'MERCURE_TRUSTED_ISSUERS';
    private const PUBLISHER_TTL_SECONDS = 300;

    public static function publisherToken(): string
    {
        return self::build(
            'publisher',
            ['publish' => ['*']],
            self::PUBLISHER_TTL_SECONDS,
            self::PUBLISHER_KEY
        );
    }

    /**
     * @param array<int, string> $topics
     */
    public static function subscriberToken(string $subject, array $topics): string
    {
        return self::build(
            $subject,
            ['subscribe' => array_values(array_unique($topics))],
            QueueCenterContract::relayHubInt('token_ttl_seconds'),
            self::SUBSCRIBER_KEY
        );
    }

    public static function hubUrl(): string
    {
        return self::servingOrigin().QueueCenterContract::relayHubString('path');
    }

    /**
     * Origin the hub is reached through: the live request's scheme + host
     * (same-origin SSE rule - the cookie and the stream ride one origin),
     * falling back to the configured app URL outside request context
     * (CLI, queues). One derivation for aud, hub_url and subscribe URLs.
     */
    public static function servingOrigin(): string
    {
        if (!function_exists('app') || !app()->runningInConsole()) {
            try {
                $request = app('request');
                if ($request instanceof \Illuminate\Http\Request && $request->getHost() !== '') {
                    return $request->getSchemeAndHttpHost();
                }
            } catch (\Throwable) {
                // No request context bound - fall through to the app URL.
            }
        }

        return rtrim((string) config('app.url'), '/');
    }

    /**
     * @param array{publish?: array<int, string>, subscribe?: array<int, string>} $grant
     */
    private static function build(string $subject, array $grant, int $ttlSeconds, string $keyName): string
    {
        $now = new \DateTimeImmutable();
        $issuer = self::trustedIssuer();
        $key = RuntimeConfigurationStore::get($keyName, '');
        if ($key === '') {
            throw new \RuntimeException("Mercure key {$keyName} is not provisioned.");
        }
        $configuration = Configuration::forSymmetricSigner(new Sha256(), InMemory::plainText($key));

        $token = $configuration->builder()
            ->withHeader('typ', 'at+jwt')
            ->issuedBy($issuer)
            ->identifiedBy('urn:uuid:'.(string) \Illuminate\Support\Str::uuid())
            ->permittedFor(self::hubUrl())
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
        if ($issuer !== '') {
            return $issuer;
        }

        $issuer = self::servingOrigin();
        RuntimeConfigurationStore::put(self::TRUSTED_ISSUER_KEY, $issuer);

        return $issuer;
    }
}
