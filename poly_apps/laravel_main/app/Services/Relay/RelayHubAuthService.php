<?php

namespace App\Services\Relay;

use App\Support\QueueCenterContract;
use App\Support\ServiceContract;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Issues short-lived, identity-scoped Mercure subscriber credentials.
 * Topic grants are derived server-side and never accepted from clients.
 */
final class RelayHubAuthService
{
    public static function issueForMachine(string $machineId): array
    {
        if (!RelayMachineRegistry::isValidId($machineId)) {
            throw new \InvalidArgumentException(__('relay.invalid_machine_id'));
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
        $resolvedSubject = $subject !== null && $subject !== '' ? $subject : 'session';
        $topics = array_merge([RelayDispatcher::machinesTopic()], self::queueCenterTopics());

        if ($machineId !== null && RelayPairRegistry::isActive($machineId, $resolvedSubject)) {
            $topics[] = RelayDispatcher::pairTopic($machineId);
        }

        return self::issue($resolvedSubject, $topics);
    }

    /**
     * @param array<int, string> $topics
     */
    public static function issueForTopics(string $subject, array $topics): array
    {
        return self::issue($subject, $topics);
    }

    /**
     * @param array<string, mixed> $token
     */
    public static function withHubCookie(JsonResponse $response, array $token): JsonResponse
    {
        return $response->cookie(new Cookie(
            (string) $token['cookie'],
            (string) $token['token'],
            now()->addSeconds((int) $token['token_ttl_seconds'])->timestamp,
            parse_url((string) $token['hub_url'], PHP_URL_PATH) ?: '/.well-known/mercure',
            null,
            parse_url((string) $token['hub_url'], PHP_URL_SCHEME) === 'https',
            true,
            false,
            'strict'
        ));
    }

    /**
     * @param array<string, mixed> $token
     */
    public static function subscribeUrl(array $token): string
    {
        return self::buildSubscribeUrl((string) $token['hub_url'], (array) $token['topics']);
    }

    /**
     * @return array<int, string>
     */
    private static function queueCenterTopics(): array
    {
        $topic = (string) (QueueCenterContract::realtime()['topic'] ?? '');

        return $topic !== '' ? [$topic] : [];
    }

    /**
     * @param array<int, string> $topics
     */
    private static function issue(string $subject, array $topics): array
    {
        $topics = array_values(array_unique(array_filter(
            $topics,
            static fn (mixed $topic): bool => is_string($topic) && $topic !== ''
        )));
        $hubUrl = RelayHubJwt::hubUrl();

        return [
            'transport' => 'mercure',
            'hub_url' => $hubUrl,
            'topics' => $topics,
            'token' => RelayHubJwt::subscriberToken($subject, $topics, $hubUrl),
            'token_ttl_seconds' => QueueCenterContract::relayHubInt('token_ttl_seconds'),
            'cookie' => ServiceContract::string('realtime.mercure_cookie'),
            'subscribe_url' => self::buildSubscribeUrl($hubUrl, $topics),
        ];
    }

    /**
     * @param array<int, string> $topics
     */
    private static function buildSubscribeUrl(string $hubUrl, array $topics): string
    {
        $query = array_map(
            static fn (string $topic): string => 'topic='.rawurlencode($topic),
            $topics
        );

        return $hubUrl.'?'.implode('&', $query);
    }
}
