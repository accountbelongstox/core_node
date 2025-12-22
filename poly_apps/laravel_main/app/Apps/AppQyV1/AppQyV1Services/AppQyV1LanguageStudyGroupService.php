<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

/**
 * 语言学习分组服务
 * 重构: 使用统一的 AppQyV1LanguageConfigService 替代重复的语言配置
 */
class AppQyV1LanguageStudyGroupService
{
    /**
     * 获取默认分组名称
     * 委托给 AppQyV1LanguageConfigService
     */
    public static function getDefaultGroupName(string $language, string $locale = 'zh'): string
    {
        return AppQyV1LanguageConfigService::getDefaultGroupName($language, $locale);
    }

    /**
     * 获取语言图标
     * 委托给 AppQyV1LanguageConfigService
     */
    public static function getLanguageIcon(string $language): string
    {
        return AppQyV1LanguageConfigService::getLanguageIcon($language);
    }

    /**
     * 获取语言颜色
     * 委托给 AppQyV1LanguageConfigService
     */
    public static function getLanguageColor(string $language): string
    {
        return AppQyV1LanguageConfigService::getLanguageColor($language);
    }

    /**
     * 验证是否为有效的学习语言
     * 委托给 AppQyV1LanguageConfigService
     */
    public static function isValidLanguage(string $language): bool
    {
        return AppQyV1LanguageConfigService::isValidStudyLanguage($language);
    }

    public static function createLanguageDefaultGroup(int $userId, string $language): ?AppQyV1WordGroupModel
    {
        $existing = AppQyV1WordGroupModel::where('uid', $userId)
            ->where('language', $language)
            ->where('is_language_default', true)
            ->first();

        if ($existing) {
            Log::info('[AppQyV1LanguageStudyGroup] Default group already exists', [
                'user_id' => $userId,
                'language' => $language,
                'group_id' => $existing->id
            ]);
            return $existing;
        }

        $gid = 'wg_' . $language . '_' . Str::random(12);
        $groupName = self::getDefaultGroupName($language);
        $icon = self::getLanguageIcon($language);

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

        $group->save();

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

    public static function getByLanguage(int $userId, string $language): array
    {
        return AppQyV1WordGroupModel::where('uid', $userId)
            ->where('language', $language)
            ->orderByRaw('is_language_default DESC')
            ->orderBy('created_at', 'asc')
            ->get()
            ->toArray();
    }

    public static function getDefaultGroupForLanguage(int $userId, string $language): ?AppQyV1WordGroupModel
    {
        return AppQyV1WordGroupModel::where('uid', $userId)
            ->where('language', $language)
            ->where('is_language_default', true)
            ->first();
    }
}
