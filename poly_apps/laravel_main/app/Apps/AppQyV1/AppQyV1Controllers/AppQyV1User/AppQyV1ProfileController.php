<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
use App\Services\AvatarService;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Services\UnifiedAuthService;
use App\Providers\PathMapper;
use App\Constants\AppKeys;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class AppQyV1ProfileController extends BaseController
{
    use ApiResponse;

    /**
     * Get current user profile
     */
    public function getProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // Idempotent read-time repair: fixes empty / missing / legacy
        // oversized (e.g. 27 MB) avatars and persists the fix. No-op when
        // the avatar is already valid, so normal reads are not slowed.
        $user = AvatarPublic::backfillAvatar($user);

        $userProfile = [
            'id' => $user->id,
            'username' => $user->username,
            'nickname' => $user->nickname,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'avatar_url' => $this->getAvatarUrl($user->avatar),
            'learning_languages' => $user->learning_languages ?? [],
            'native_language' => $user->native_language,
            'bio' => $user->bio,
            'location' => $user->location,
            'member_type' => $user->member_type,
            'vip_points' => $user->vip_points ?? 0,
            'is_active' => $user->is_active ?? 1,
        ];

        return $this->success(['user' => $userProfile], 'Profile retrieved successfully');
    }

    /**
     * Update user profile (including avatar)
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'nickname' => 'nullable|string|max:255',
            'name' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:255',
            'native_language' => 'nullable|string|max:10',
            'learning_languages' => 'nullable|array',
            'avatar_base64' => 'nullable|string',
            'avatar_filename' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $validated = $validator->validated();
        $updateData = [];
        $oldAvatar = $user->avatar;

        if (isset($validated['nickname'])) {
            $updateData['nickname'] = $validated['nickname'];
        }

        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }

        if (isset($validated['bio'])) {
            $updateData['bio'] = $validated['bio'];
        }

        if (isset($validated['location'])) {
            $updateData['location'] = $validated['location'];
        }

        if (isset($validated['native_language'])) {
            $updateData['native_language'] = $validated['native_language'];
        }

        if (isset($validated['learning_languages'])) {
            $updateData['learning_languages'] = $validated['learning_languages'];
        }

        if (isset($validated['avatar_base64']) && $validated['avatar_base64']) {
            $filename = null;
            if (isset($validated['avatar_filename'])) {
                $filename = $validated['avatar_filename'];
            }

            $avatarPath = $this->saveAvatarFromBase64(
                $validated['avatar_base64'],
                $user->id,
                $filename
            );

            if ($avatarPath) {
                $updateData['avatar'] = $avatarPath;

                if ($oldAvatar && $oldAvatar !== 'avatars/1.png') {
                    $this->deleteOldAvatar($oldAvatar);
                }
            }
        }

        if (!empty($updateData)) {
            // Canonical identity: write only to the main users table.
            // The legacy per-sub-app users duplication was removed (Phase A),
            // so there is no sub-app users row to sync anymore.
            $user->update($updateData);
        }

        $userProfile = [
            'id' => $user->id,
            'username' => $user->username,
            'nickname' => $user->nickname,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'avatar_url' => $this->getAvatarUrl($user->avatar),
            'learning_languages' => $user->learning_languages ?? [],
            'native_language' => $user->native_language,
            'bio' => $user->bio,
            'location' => $user->location,
            'member_type' => $user->member_type,
            'vip_points' => $user->vip_points ?? 0,
            'is_active' => $user->is_active ?? 1,
        ];

        return $this->success(['user' => $userProfile], 'Profile updated successfully');
    }

    /**
     * Upload avatar as a multipart file (POST /user/avatar, field "avatar").
     *
     * Reuses the hardened AvatarService::saveBase64Avatar pipeline (size cap,
     * GD decode, downscale to 512px, JPEG re-encode) so raw upload bytes are
     * never written to disk verbatim. Storage path resolution stays inside
     * AvatarService (PathMapper-backed, no raw storage_path()).
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = null;
        $uploadedFile = null;
        $mimeType = null;
        $rawBytes = null;
        $base64Payload = null;
        $oldAvatar = null;
        $avatarPath = null;

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'avatar' => 'required|file|image|mimes:png,jpg,jpeg,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $uploadedFile = $request->file('avatar');
        $rawBytes = @file_get_contents($uploadedFile->getRealPath());
        if ($rawBytes === false || $rawBytes === '') {
            return $this->error('Failed to read uploaded avatar file', 422);
        }

        $mimeType = $uploadedFile->getMimeType();
        if (!$mimeType) {
            $mimeType = 'image/png';
        }

        // Wrap as a data URI so saveBase64Avatar can derive the extension.
        $base64Payload = 'data:' . $mimeType . ';base64,' . base64_encode($rawBytes);
        $oldAvatar = $user->avatar;

        // Filename intentionally null: AvatarService generates a unique
        // avatar_{userId}_{time}.jpg name (avoids client-name collisions).
        $avatarPath = AvatarService::saveBase64Avatar($base64Payload, $user->id, AppKeys::APPQYV1, null);

        if (!$avatarPath) {
            return $this->error('Failed to process avatar image', 422);
        }

        $user->update(['avatar' => $avatarPath]);

        if ($oldAvatar && $oldAvatar !== $avatarPath && $oldAvatar !== 'avatars/1.png') {
            $this->deleteOldAvatar($oldAvatar);
        }

        return $this->success([
            'avatar' => $avatarPath,
            'avatar_url' => $this->getAvatarUrl($avatarPath),
        ], 'Avatar uploaded successfully');
    }

    /**
     * Save avatar from base64 string
     */
    private function saveAvatarFromBase64(string $base64Data, int $userId, ?string $filename = null): ?string
    {
        return AvatarService::saveBase64Avatar($base64Data, $userId, AppKeys::APPQYV1, $filename);
    }

    /**
     * Delete old avatar file
     */
    private function deleteOldAvatar(string $avatarPath): void
    {
        AvatarService::deleteAvatar($avatarPath);
    }

    /**
     * Get full avatar URL
     */
    private function getAvatarUrl(?string $avatar): ?string
    {
        return AvatarService::getAvatarUrl($avatar);
    }

    /**
     * Get aggregated user learning statistics.
     *
     * Single source of truth for both the qy_capacitor "/user/statistics"
     * screen and the dashboard "/user/stats" view. The response is a superset:
     * snake_case fields consumed by qy_capacitor plus the legacy camelCase
     * fields the dashboard already reads, so neither client breaks.
     *
     * All numbers are derived from the user's real learning-progress rows.
     * When the user has not initialized learning yet (progress table absent
     * or no rows), zeroed stats are returned instead of a 500 — an empty
     * profile is an expected state, not an infrastructure failure.
     */
    public function getStatistics(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $progress = new AppQyV1UserLearningProgressModel();
        $connection = $progress->getConnectionName();
        $table = $progress->getTable();

        $totalWords = 0;
        $newWords = 0;
        $learningWords = 0;
        $masteredWords = 0;
        $needsReview = 0;
        $weakWords = 0;
        $correctSum = 0;
        $wrongSum = 0;
        $activityDates = [];
        $studyDays = 0;
        $currentStreak = 0;
        $longestStreak = 0;
        $averageAccuracy = 0.0;
        $completionRate = 0.0;
        $dailyAverage = 0.0;
        $weeklyProgress = array_fill(0, 7, 0);
        $todayProgress = 0;
        // Per-user goal from the preferences JSON column (settable via
        // PUT /user/preferences daily_goal); 20 stays the default.
        $preferences = is_array($user->preferences) ? $user->preferences : [];
        $dailyGoal = (int) ($preferences['daily_goal'] ?? 20);
        if ($dailyGoal < 1 || $dailyGoal > 500) {
            $dailyGoal = 20;
        }

        $tableReady = Schema::connection($connection)->hasTable($table);

        if ($tableReady) {
            $base = AppQyV1UserLearningProgressModel::where('user_id', $user->id);

            $totalWords = (clone $base)->count();
            $newWords = (clone $base)->where('learning_status', 'new')->count();
            $learningWords = (clone $base)->where('learning_status', 'learning')->count();
            $masteredWords = (clone $base)->where('learning_status', 'mastered')->count();
            $needsReview = (clone $base)
                ->whereIn('learning_status', ['learning', 'reviewing'])
                ->where('next_review_at', '<=', now())
                ->count();
            $weakWords = (clone $base)->whereColumn('wrong_count', '>', 'correct_count')->count();
            $correctSum = (int) (clone $base)->sum('correct_count');
            $wrongSum = (int) (clone $base)->sum('wrong_count');

            // Pull activity timestamps once and derive day-based metrics in PHP
            // (driver-agnostic: avoids sqlite/mysql date-function differences).
            $timestamps = (clone $base)
                ->get(['last_reviewed_at', 'updated_at', 'created_at']);

            foreach ($timestamps as $row) {
                $when = $row->last_reviewed_at ?? $row->updated_at ?? $row->created_at;
                if (!$when) {
                    continue;
                }
                $dayCarbon = Carbon::parse($when)->startOfDay();
                $day = $dayCarbon->toDateString();
                $activityDates[$day] = true;

                // Version-independent day-delta: only past/today rows count
                // toward the trailing 7-day window. Both operands are
                // start-of-day, so the absolute diff equals "days ago".
                if ($dayCarbon->lessThanOrEqualTo(Carbon::today())) {
                    $diff = (int) $dayCarbon->diffInDays(Carbon::today());
                    if ($diff < 7) {
                        $weeklyProgress[6 - $diff]++;
                    }
                }
            }
        }

        $studyDays = count($activityDates);
        $totalWordsLearned = max(0, $totalWords - $newWords);
        $todayProgress = $weeklyProgress[6];

        if (($correctSum + $wrongSum) > 0) {
            $averageAccuracy = round($correctSum / ($correctSum + $wrongSum) * 100, 1);
        }

        if ($totalWords > 0) {
            $completionRate = round($masteredWords / $totalWords * 100, 1);
        }

        if ($studyDays > 0) {
            $dailyAverage = round($totalWordsLearned / $studyDays, 1);
        }

        if ($studyDays > 0) {
            $sortedDays = array_keys($activityDates);
            sort($sortedDays);

            $runLength = 1;
            $longestStreak = 1;
            for ($i = 1; $i < count($sortedDays); $i++) {
                $prev = Carbon::parse($sortedDays[$i - 1]);
                $curr = Carbon::parse($sortedDays[$i]);
                if ((int) $prev->diffInDays($curr) === 1) {
                    $runLength++;
                } else {
                    $runLength = 1;
                }
                if ($runLength > $longestStreak) {
                    $longestStreak = $runLength;
                }
            }

            // Current streak: consecutive days ending today or yesterday.
            $lastDay = Carbon::parse(end($sortedDays));
            $gapToToday = (int) $lastDay->diffInDays(Carbon::today());
            if ($gapToToday <= 1) {
                $currentStreak = 1;
                for ($i = count($sortedDays) - 1; $i > 0; $i--) {
                    $prev = Carbon::parse($sortedDays[$i - 1]);
                    $curr = Carbon::parse($sortedDays[$i]);
                    if ((int) $prev->diffInDays($curr) === 1) {
                        $currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }

        // total_study_time has no backing data source yet (there is no
        // session/time-tracking table). Reported as 0 and surfaced as a
        // known design gap rather than fabricated.
        $totalStudyTime = 0;

        $data = [
            // qy_capacitor expected (snake_case)
            'total_words_learned' => $totalWordsLearned,
            'total_words' => $totalWords,
            'new_words' => $newWords,
            'learning_words' => $learningWords,
            'mastered_words' => $masteredWords,
            'weak_words' => $weakWords,
            'needs_review' => $needsReview,
            'current_streak' => $currentStreak,
            'longest_streak' => $longestStreak,
            'average_accuracy' => $averageAccuracy,
            'daily_average' => $dailyAverage,
            'total_study_time' => $totalStudyTime,
            'study_days' => $studyDays,
            'weekly_progress' => array_values($weeklyProgress),
            // Daily-goal block. today_progress is real (words studied today);
            // daily_goal is the per-user target from the preferences JSON
            // column (PUT /user/preferences daily_goal), defaulting to 20.
            'today_progress' => $todayProgress,
            'daily_goal' => $dailyGoal,
            'review_due' => $needsReview,
            // Dashboard LearningInterface alias names (same values, different
            // key names the panel reads) — additive, keeps it from showing 0s.
            'learned_count' => $totalWordsLearned,
            'studying_count' => $learningWords,
            'review_count' => $needsReview,
            'daily_goal_progress' => $completionRate,
            // dashboard legacy keys (camelCase) — back-compat superset
            'studyDays' => $studyDays,
            'totalWords' => $totalWords,
            'completionRate' => $completionRate,
            'averageAccuracy' => $averageAccuracy,
            'totalStudyTime' => $totalStudyTime,
        ];

        return $this->success($data, 'Statistics retrieved successfully');
    }

    /**
     * Get user preferences
     */
    public function getPreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $defaultPreferences = [
            'theme' => 'dark',
            'language' => 'en',
            'favorites' => [],
            'recentTools' => [],
            // WordFlow account-level prefs: per-user learning target +
            // opaque client settings blob (WfSettingsCenter shape) so the
            // WordNew clients can roam settings across devices.
            'daily_goal' => 20,
            'app_settings' => null,
        ];

        $userPreferences = $user->preferences ?? [];
        if (!is_array($userPreferences)) {
            $userPreferences = [];
        }

        $preferences = array_merge($defaultPreferences, $userPreferences);

        return $this->success($preferences, 'Preferences retrieved successfully');
    }

    /**
     * Update user preferences
     */
    public function updatePreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'theme' => 'nullable|string|in:light,dark',
            'language' => 'nullable|string|max:10',
            'favorites' => 'nullable|array',
            'recentTools' => 'nullable|array',
            'daily_goal' => 'nullable|integer|min:1|max:500',
            'app_settings' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $validated = $validator->validated();

        $defaultPreferences = [
            'theme' => 'dark',
            'language' => 'en',
            'favorites' => [],
            'recentTools' => [],
            'daily_goal' => 20,
            'app_settings' => null,
        ];

        $currentPreferences = $user->preferences ?? [];
        if (!is_array($currentPreferences)) {
            $currentPreferences = [];
        }

        if (array_key_exists('app_settings', $validated) && is_array($validated['app_settings'])) {
            $validated['app_settings'] = $this->mergeAppSettings(
                is_array($currentPreferences['app_settings'] ?? null) ? $currentPreferences['app_settings'] : [],
                $validated['app_settings']
            );
        }

        $updatedPreferences = array_merge($defaultPreferences, $currentPreferences, $validated);

        $user->preferences = $updatedPreferences;
        $user->save();

        return $this->success($updatedPreferences, 'Preferences updated successfully');
    }

    /**
     * Deep-merge app_settings so partial patches (e.g. reader blob) do not wipe
     * other client keys such as themeId.
     */
    private function mergeAppSettings(array $current, array $incoming): array
    {
        $merged = $current;

        foreach ($incoming as $key => $value) {
            if ($key === 'reader' && is_array($value)) {
                $existing = is_array($merged['reader'] ?? null) ? $merged['reader'] : [];
                $merged['reader'] = array_merge($existing, $value);
                continue;
            }
            $merged[$key] = $value;
        }

        return $merged;
    }
 }
