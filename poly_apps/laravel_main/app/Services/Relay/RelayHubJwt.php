<?php

namespace App\Services\Relay;

use App\Support\QueueCenterContract;
use App\Support\RuntimeConfigurationStore;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;

/**
 * Shared Mercure JWT facility (Mercure 1.0, RFC 9068 access tokens).
 *
 * Publisher and subscriber tokens are RFC 9068 JWTs ("at+jwt") carrying an
 * RFC 9396 authorization_details claim - the 1.0 shape the hub validates
 * natively. One HS256 signer, one key source (RuntimeConfigurationStore),
 * no hand-rolled cryptography anywhere in the relay.
 */
final class RelayHubJwt
{
    public const PUBLISHER_KEY = 'MERCURE_PUBLISHER_JWT';
    public const SUBSCRIBER_KEY = 'MERCURE_SUBSCRIBER_JWT';
    public const TRUSTED_ISSUER_KEY = 'MERCURE_TRUSTED_ISSUERS';
    public const AUTH_DETAIL_TYPE = 'https://mercure.rocks/authorization-detail';
    private const PUBLISHER_TTL_SECONDS = 300;

    public static function publisherToken(): string
    {
        return self::build(
            'publisher',
            self::detail(['publish'], [['match' => '*']]),
            self::PUBLISHER_TTL_SECONDS,
            self::PUBLISHER_KEY
        );
    }

    /**
     * @param array<int, string> $topics
     */
    public static function subscriberToken(string $subject, array $topics): string
    {
        $matchers = [];
        foreach (array_values(array_unique($topics)) as $topic) {
            $matchers[] = ['match' => $topic];
        }

        return self::build($subject, self::detail(['subscribe'], $matchers), QueueCenterContract::relayHubInt('token_ttl_seconds'), self::SUBSCRIBER_KEY);
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
     * @param array<int, array<string, mixed>> $topics
     * @return array<string, mixed>
     */
    private static function detail(array $actions, array $topics): array
    {
        return [
            'type' => self::AUTH_DETAIL_TYPE,
            'actions' => $actions,
            'topics' => $topics,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $authorizationDetails
     */
    private static function build(string $subject, array $authorizationDetails, int $ttlSeconds, string $keyName): string
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
            ->withClaim('authorization_details', $authorizationDetails)
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
