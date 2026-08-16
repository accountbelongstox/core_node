<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageStudyGroupService;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class AppQyV1WordGroupLanguageController extends Controller
{
    use ApiResponse;

    public function createForLanguage(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $validated = $request->validate([
            'language' => 'required|string|size:2',
        ]);

        $language = $validated['language'];

        if (!AppQyV1LanguageStudyGroupService::isValidLanguage($language)) {
            return $this->error("Invalid language code: {$language}", 400);
        }

        $group = AppQyV1LanguageStudyGroupService::createLanguageDefaultGroup($user->id, $language);

        if (!$group) {
            return $this->error('Failed to create language group', 500);
        }

        return $this->success([
            'id' => $group->gid,
            'uid' => $group->uid,
            'name' => $group->gname,
            'language' => $group->language,
            'is_language_default' => $group->is_language_default,
            'total_word_groups' => 0,
            'total_words' => 0,
            'icon' => AppQyV1LanguageStudyGroupService::getLanguageIcon($language),
            'color' => AppQyV1LanguageStudyGroupService::getLanguageColor($language),
            'cover_url' => $group->cover_url,
            'thumbnail_url' => $group->thumbnail_url,
            'cover_category' => $group->cover_category,
            'created_at' => $group->created_at,
        ], 'Language study group created successfully');
    }

    public function getByLanguage(Request $request, string $language): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        if (!AppQyV1LanguageStudyGroupService::isValidLanguage($language)) {
            return $this->error("Invalid language code: {$language}", 400);
        }

        $groups = AppQyV1LanguageStudyGroupService::getByLanguage($user->id, $language);

        $formattedGroups = array_map(function ($group) {
            return [
                'id' => $group['gid'],
                'name' => $group['gname'],
                'language' => $group['language'],
                'is_language_default' => $group['is_language_default'],
                'total_word_groups' => 0,
                'total_words' => 0,
                'icon' => AppQyV1LanguageStudyGroupService::getLanguageIcon($group['language']),
                'color' => AppQyV1LanguageStudyGroupService::getLanguageColor($group['language']),
                'cover_url' => $group['cover_url'] ?? null,
                'thumbnail_url' => $group['thumbnail_url'] ?? null,
                'cover_category' => $group['cover_category'] ?? null,
                'created_at' => $group['created_at'],
                'updated_at' => $group['updated_at'],
            ];
        }, $groups);

        return $this->success([
            'language' => $language,
            'study_groups' => $formattedGroups,
            'total' => count($formattedGroups),
        ], 'Study groups retrieved successfully');
    }

    public function ensureLanguageGroups(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $validated = $request->validate([
            'learning_languages' => 'required|array',
            'learning_languages.*' => 'string|size:2',
        ]);

        $languages = $validated['learning_languages'];

        $createdGroups = AppQyV1LanguageStudyGroupService::ensureLanguageGroupsExist($user->id, $languages);

        return $this->success([
            'created_count' => count($createdGroups),
            'languages' => $languages,
        ], 'Language study groups ensured');
    }
}
