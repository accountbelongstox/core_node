<?php

namespace App\Services\Relay;

use App\Support\ServiceContract;

/**
 * Relay hub auth: short-lived, topic-scoped Mercure subscriber tokens.
 *
 * Identity resolves once (UI session or machine); the granted topic set is
 * computed server-side from that identity - never echoed from the request.
 * Non-browser clients (pycore) present the token as an Authorization Bearer
 * header; browsers additionally receive the hub-path cookie so a native
 * EventSource can subscribe through the configured secure cookie.
 */
final class RelayHubAuthService
{
    public static function issueForMachine(string $machineId): array
    {
        if (!RelayMachineRegistry::isValidId($machineId)) {
            throw new \InvalidArgumentException('Invalid machine id.');
        }

        return self::issue($machineId, array_merge(
            [
                RelayDispatcher::machinesTopic(),
                RelayDispatcher::pairTopic($machineId),
            ],
            self::queueCenterTopics()
        ));
    }

    public static function issueForSession(?string $machineId, ?string $subject = null): array
    {
        $topics = array_merge([RelayDispatcher::machinesTopic()], self::queueCenterTopics());
        if ($machineId !== null && RelayPairRegistry::isActive($machineId)) {
            $topics[] = RelayDispatcher::pairTopic($machineId);
        }

        return self::issue($subject !== null && $subject !== '' ? $subject : 'session', $topics);
    }

    /**
     * Queue Center realtime topics ride the same hub and the same token
     * surface (exact-match grants) - one authorization path for machines,
     * UI sessions and the Queue Center consumers.
     *
     * @return array<int, string>
     */
    private static function queueCenterTopics(): array
    {
        $topic = (string) (\App\Support\QueueCenterContract::realtime()['topic'] ?? '');

        return $topic !== '' ? [$topic] : [];
    }

    /**
     * Generic issuer for authenticated app scopes (wordnew social, future
     * consumers): exact-match grants, same token/cookie surface as machines
     * and UI sessions.
     *
     * @param array<int, string> $topics
     */
    public static function issueForTopics(string $subject, array $topics): array
    {
        return self::issue($subject, $topics);
    }

    /**
     * Attach the hub-path cookie (spec default name) to a JSON response so a
     * browser EventSource can authorize without headers.
     *
     * @param array<string, mixed> $token
     */
    public static function withHubCookie(\Illuminate\Http\JsonResponse $response, array $token): \Illuminate\Http\JsonResponse
    {
        return $response->cookie(
            new \Symfony\Component\HttpFoundation\Cookie(
                $token['cookie'],
                $token['token'],
                now()->addSeconds((int) $token['token_ttl_seconds'])->timestamp,
                parse_url($token['hub_url'], PHP_URL_PATH) ?: '/.well-known/mercure',
                null,
                true,
                true,
                false,
                'strict'
            )
        );
    }

    /**
     * Mercure subscription URL: one `topic` query parameter per selector.
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
            'cookie' => ServiceContract::string('realtime.mercure_cookie'),
            'subscribe_url' => self::buildSubscribeUrl($hubUrl, $topics),
        ];
    }

    /**
     * @param array<int, string> $topics
     */
    private static function buildSubscribeUrl(string $hubUrl, array $topics): string
    {
        $query = http_build_query(['topic' => $topics], '', '&', PHP_QUERY_RFC3986);

        return $hubUrl.'?'.preg_replace('/topic%5B\d+%5D=/', 'topic=', $query);
    }
}
