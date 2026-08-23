<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserPresenceModel;
use App\Models\User;
use App\Services\AvatarService;

final class AppQyV1SocialPresenter
{
    private const XP_PER_LEARNED_WORD = 10;
    private const XP_PER_MASTERED_WORD = 30;
    private const XP_PER_CORRECT_ANSWER = 2;

    public static function aggregateProgressStats(?array $userIds, $since): array
    {
        $rows = AppQyV1UserLearningProgressModel::aggregateProgressStats($userIds, $since);
        $result = [];

        foreach ($rows as $row) {
            $result[(int) $row->user_id] = [
                'total_words' => (int) $row->total_words,
                'learned_words' => (int) $row->learned_words,
                'mastered_words' => (int) $row->mastered_words,
                'correct_answers' => (int) $row->correct_answers,
            ];
        }

        return $result;
    }

    public static function statsRow(array $statsByUser, int $userId): array
    {
        $stats = $statsByUser[$userId] ?? [];

        return [
            'total_words' => (int) ($stats['total_words'] ?? 0),
            'learned_words' => (int) ($stats['learned_words'] ?? 0),
            'mastered_words' => (int) ($stats['mastered_words'] ?? 0),
        ];
    }

    public static function xp(array $statsByUser, int $userId): int
    {
        $stats = $statsByUser[$userId] ?? null;

        if ($stats === null) {
            return 0;
        }

        return ($stats['learned_words'] * self::XP_PER_LEARNED_WORD)
            + ($stats['mastered_words'] * self::XP_PER_MASTERED_WORD)
            + ($stats['correct_answers'] * self::XP_PER_CORRECT_ANSWER);
    }

    public static function presenceStatus(User $user, bool $isStudying, array $presenceMap = []): string
    {
        $entry = $presenceMap[(int) $user->id] ?? null;
        $status = $entry !== null
            ? (string) $entry['status']
            : AppQyV1UserPresenceModel::STATUS_OFFLINE;

        if ($isStudying && $status !== AppQyV1UserPresenceModel::STATUS_OFFLINE) {
            return AppQyV1UserPresenceModel::STATUS_STUDYING;
        }

        return $status;
    }

    public static function normalizeLanguages(mixed $value): array
    {
        $languages = [];
        $normalized = [];

        if (is_array($value)) {
            $languages = $value;
        } elseif (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $languages = is_array($decoded) ? $decoded : array_map('trim', explode(',', $value));
        }
        foreach ($languages as $code) {
            if (is_string($code) && $code !== '') {
                $normalized[] = strtolower($code);
            }
        }

        return array_values(array_unique($normalized));
    }

    public static function displayName(User $user): string
    {
        if (!empty($user->nickname)) {
            return $user->nickname;
        }
        if (!empty($user->name)) {
            return $user->name;
        }

        return (string) $user->username;
    }

    public static function avatarUrl(User $user): ?string
    {
        return !empty($user->avatar) ? AvatarService::getAvatarUrl($user->avatar) : null;
    }
}
