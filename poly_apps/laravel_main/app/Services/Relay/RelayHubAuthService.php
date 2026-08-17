<?php

namespace App\Services\Relay;

/**
 * Relay hub auth: short-lived, topic-scoped Mercure 1.0 subscriber tokens.
 *
 * Identity resolves once (UI session or machine); the granted topic set is
 * computed server-side from that identity - never echoed from the request.
 * Non-browser clients (pycore) present the token as an Authorization Bearer
 * header; browsers additionally receive the hub-path cookie so a native
 * EventSource can subscribe (the cookie name is the hub default
 * __Secure-mercure_access_token).
 */
final class RelayHubAuthService
{
    public static function issueForMachine(string $machineId): array
    {
        if (!RelayMachineRegistry::isValidId($machineId)) {
            throw new \InvalidArgumentException('Invalid machine id.');
        }

        return self::issue($machineId, [
            RelayDispatcher::machinesTopic(),
            RelayDispatcher::pairTopic($machineId),
        ]);
    }

    public static function issueForSession(?string $machineId, ?string $subject = null): array
    {
        $topics = [RelayDispatcher::machinesTopic()];
        if ($machineId !== null && RelayPairRegistry::isActive($machineId)) {
            $topics[] = RelayDispatcher::pairTopic($machineId);
        }

        return self::issue($subject !== null && $subject !== '' ? $subject : 'session', $topics);
    }

    /**
     * Mercure 1.0 subscription URL: one `match` (exact) query parameter per
     * topic - matchers route only; the token governs private updates.
     *
     * @param array<string, mixed> $token
     */
    public static function subscribeUrl(array $token): string
    {
        return self::buildSubscribeUrl($token['hub_url'], $token['topics']);
    }

    /**
     * @param array<int, string> $topics
     */
    private static function issue(string $subject, array $topics): array
    {
        $topics = array_values(array_unique($topics));
        $hubUrl = RelayHubJwt::hubUrl();
        $token = RelayHubJwt::subscriberToken($subject, $topics);

        return [
            'transport' => 'mercure',
            'hub_url' => $hubUrl,
            'topics' => $topics,
            'token' => $token,
            'token_ttl_seconds' => \App\Support\QueueCenterContract::relayHubInt('token_ttl_seconds'),
            'cookie' => \App\Support\QueueCenterContract::relayHubString('cookie'),
            'subscribe_url' => self::buildSubscribeUrl($hubUrl, $topics),
        ];
    }

    /**
     * @param array<int, string> $topics
     */
    private static function buildSubscribeUrl(string $hubUrl, array $topics): string
    {
        return $hubUrl.'?match='.implode('&match=', array_map('rawurlencode', $topics));
    }
}
