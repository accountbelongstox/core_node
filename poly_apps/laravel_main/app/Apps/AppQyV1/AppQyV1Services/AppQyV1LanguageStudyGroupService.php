<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

/**
 * Language study group service
 * Refactor: use the unified AppQyV1LanguageConfigService instead of duplicate language configs
 */
class AppQyV1LanguageStudyGroupService
{
    private const DEFAULT_VOCABULARY_GROUP_NAME = 'Default Vocabulary Group';

    /**
     * Get the default group name
     * Delegates to AppQyV1LanguageConfigService
     */
    public static function getDefaultGroupName(string $language, string $locale = 'zh'): string
    {
        return AppQyV1LanguageConfigService::getDefaultGroupName($language, $locale);
    }

    /**
     * Get the language icon
     * Delegates to AppQyV1LanguageConfigService
     */
    public static function getLanguageIcon(string $language): string
    {
        return AppQyV1LanguageConfigService::getLanguageIcon($language);
    }

    /**
     * Get the language color
     * Delegates to AppQyV1LanguageConfigService
     */
    public static function getLanguageColor(string $language): string
    {
        return AppQyV1LanguageConfigService::getLanguageColor($language);
    }

    /**
     * Validate whether this is a valid study language
     * Delegates to AppQyV1LanguageConfigService
     */
    public static function isValidLanguage(string $language): bool
    {
        return AppQyV1LanguageConfigService::isValidStudyLanguage($language);
    }

    public static function createLanguageDefaultGroup(int $userId, string $language): ?AppQyV1WordGroupModel
    {
        $existing = AppQyV1WordGroupModel::languageDefault($userId, $language);
        if ($existing) {
            return $existing;
        }

        $legacyDefault = $language === 'en'
            ? AppQyV1WordGroupModel::legacyDefault($userId, self::DEFAULT_VOCABULARY_GROUP_NAME)
            : null;

        return self::createLanguageDefaultGroupResolved($userId, $language, null, $legacyDefault);
    }

    private static function createLanguageDefaultGroupResolved(
        int $userId,
        string $language,
        ?AppQyV1WordGroupModel $existing,
        ?AppQyV1WordGroupModel $legacyDefault
    ): ?AppQyV1WordGroupModel {

        if ($existing) {
            return $existing;
        }

        if ($language === 'en' && $legacyDefault) {
            $legacyDefault->language = 'en';
            $legacyDefault->is_language_default = true;
            $legacyDefault->saveRecord();
            return $legacyDefault;
        }

        $gid = 'wg_' . $language . '_' . Str::random(12);
        $groupName = $language === 'en'
            ? self::DEFAULT_VOCABULARY_GROUP_NAME
            : self::getDefaultGroupName($language);
        $group = new AppQyV1WordGroupModel([
            'gid' => $gid,
            'uid' => $userId,
            'gname' => $groupName,
            'gcontent' => '',
            'gwords' => [],
            'words_frequency' => [],
            'language' => $language,
            'is_language_default' => true,
        ]);

        $group->saveRecord();

        Log::info('[AppQyV1LanguageStudyGroup] Created default group', [
            'user_id' => $userId,
            'language' => $language,
            'group_id' => $group->id,
            'group_gid' => $group->gid
        ]);

        return $group;
    }

    public static function ensureLanguageGroupsExist(int $userId, array $languages): array
    {
        $createdGroups = [];
        $languages = array_values(array_unique(array_merge(['en'], $languages)));

        foreach ($languages as $language) {
            if (!self::isValidLanguage($language)) {
                Log::warning('[AppQyV1LanguageStudyGroup] Invalid language code', [
                    'user_id' => $userId,
                    'language' => $language
                ]);
                continue;
            }

            $group = self::createLanguageDefaultGroup($userId, $language);
            if ($group) {
                $createdGroups[] = $group;
            }
        }

        return $createdGroups;
    }

    public static function ensureAllUserLanguageGroups(): array
    {
        $userCount = 0;
        $groupCount = 0;

        User::chunkLearningLanguages(function ($users) use (&$userCount, &$groupCount): void {
                $userIds = $users->pluck('id')->map(static fn ($id): int => (int) $id)->all();
                $defaults = AppQyV1WordGroupModel::languageDefaultsForUsers($userIds);
                $legacyDefaults = AppQyV1WordGroupModel::legacyDefaultsForUsers(
                    $userIds,
                    self::DEFAULT_VOCABULARY_GROUP_NAME
                )->keyBy('uid');
                $defaultsByUser = [];

                foreach ($defaults as $default) {
                    $defaultsByUser[(int) $default->uid][(string) $default->language] = $default;
                }

                foreach ($users as $user) {
                    $languages = is_array($user->learning_languages)
                        ? $user->learning_languages
                        : [];
                    if (empty($languages)) {
                        $languages = ['en'];
                    }

                    $groups = [];
                    $languages = array_values(array_unique(array_merge(['en'], $languages)));
                    foreach ($languages as $language) {
                        if (!self::isValidLanguage($language)) {
                            Log::warning('[AppQyV1LanguageStudyGroup] Invalid language code', [
                                'user_id' => $user->id,
                                'language' => $language,
                            ]);
                            continue;
                        }

                        $group = self::createLanguageDefaultGroupResolved(
                            (int) $user->id,
                            $language,
                            $defaultsByUser[(int) $user->id][$language] ?? null,
                            $legacyDefaults->get((int) $user->id)
                        );
                        if ($group) {
                            $groups[] = $group;
                        }
                    }
                    $userCount++;
                    $groupCount += count($groups);
                }
        });

        return [
            'users' => $userCount,
            'groups' => $groupCount,
        ];
    }

    public static function getByLanguage(int $userId, string $language): array
    {
        return AppQyV1WordGroupModel::forUserLanguage($userId, $language)->toArray();
    }

    public static function getDefaultGroupForLanguage(int $userId, string $language): ?AppQyV1WordGroupModel
    {
        return AppQyV1WordGroupModel::languageDefault($userId, $language);
    }
}
