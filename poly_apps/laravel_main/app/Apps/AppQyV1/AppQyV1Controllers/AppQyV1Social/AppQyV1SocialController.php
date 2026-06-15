<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Routing\Controller as BaseController;
use App\Models\User;
use App\Services\AvatarService;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserFollowModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;

class AppQyV1SocialController extends BaseController
{
    use ApiResponse;

    /**
     * NO fabricated data allowed - every field is derived from the global
     * users table or the app_qy_v1_user_learning_progress table. Users and
     * app tables live on DIFFERENT database connections (default vs appqyv1),
     * so they are queried separately and merged in PHP (no cross-DB joins).
     */

    private const ACTIVITY_WINDOW_DAYS = 7;
    private const STUDYING_WINDOW_MINUTES = 30;
    private const ONLINE_WINDOW_MINUTES = 5;
    private const XP_PER_LEARNED_WORD = 10;
    private const XP_PER_MASTERED_WORD = 30;
    private const XP_PER_CORRECT_ANSWER = 2;

    /**
     * GET /social/friends
     * Users the current user follows, with basic info and a learning summary.
     */
    public function getFriends(Request $request)
    {
        $currentUser = $request->user();
        $followRows = null;
        $followedIds = [];
        $users = null;
        $statsByUser = [];
        $studyingIds = [];
        $friends = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $followRows = AppQyV1UserFollowModel::where('user_id', $currentUser->id)
            ->orderBy('created_at', 'desc')
            ->get();
        $followedIds = $followRows->pluck('followed_user_id')->map(fn ($id) => (int) $id)->all();

        if (empty($followedIds)) {
            return $this->success(['friends' => [], 'total' => 0]);
        }

        $users = User::whereIn('id', $followedIds)
            ->get(['id', 'username', 'nickname', 'name', 'avatar', 'is_online', 'last_seen_at', 'last_login_at'])
            ->keyBy('id');
        $statsByUser = $this->aggregateProgressStats($followedIds, null);
        $studyingIds = $this->getRecentlyStudyingUserIds($followedIds);

        foreach ($followRows as $row) {
            $friendUser = $users->get((int) $row->followed_user_id);
            if (!$friendUser) {
                continue;
            }
            $friends[] = [
                'id' => $friendUser->id,
                'username' => $friendUser->username,
                'name' => $this->displayName($friendUser),
                'avatar_url' => $this->avatarUrl($friendUser),
                'status' => $this->presenceStatus($friendUser, in_array($friendUser->id, $studyingIds)),
                'followed_at' => $row->created_at ? $row->created_at->toISOString() : null,
                'stats' => $this->statsRowFor($statsByUser, $friendUser->id),
            ];
        }

        return $this->success(['friends' => $friends, 'total' => count($friends)]);
    }

    /**
     * GET /social/friends/search?q=
     * Search users by username / nickname / name. Excludes the current user.
     */
    public function searchUsers(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $query = '';
        $needle = '';
        $followedIds = [];
        $users = null;
        $results = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'q' => ['required', 'string', 'min:1', 'max:100'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $query = trim((string) $request->query('q'));
        $needle = '%' . strtolower($query) . '%';
        $followedIds = AppQyV1UserFollowModel::getFollowedUserIds($currentUser->id);

        // Case-insensitive on BOTH drivers: plain LIKE is case-insensitive on
        // sqlite but case-SENSITIVE on pgsql, so lower both sides explicitly.
        $users = User::where('id', '!=', $currentUser->id)
            ->where(function ($q) use ($needle) {
                $q->whereRaw('LOWER(username) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(nickname) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(name) LIKE ?', [$needle]);
            })
            ->orderBy('username')
            ->limit(20)
            ->get(['id', 'username', 'nickname', 'name', 'avatar', 'is_online', 'last_seen_at', 'last_login_at']);

        foreach ($users as $foundUser) {
            $results[] = [
                'id' => $foundUser->id,
                'username' => $foundUser->username,
                'name' => $this->displayName($foundUser),
                'avatar_url' => $this->avatarUrl($foundUser),
                'status' => $this->presenceStatus($foundUser, false),
                'is_following' => in_array((int) $foundUser->id, $followedIds),
            ];
        }

        return $this->success(['users' => $results, 'total' => count($results)]);
    }

    /**
     * POST /social/friends/follow  {user_id}
     */
    public function follow(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $targetId = 0;
        $targetUser = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $targetId = (int) $request->input('user_id');
        if ($targetId === (int) $currentUser->id) {
            return $this->error('Cannot follow yourself', 422);
        }

        $targetUser = User::find($targetId);
        if (!$targetUser) {
            return $this->notFound('User not found');
        }

        AppQyV1UserFollowModel::follow($currentUser->id, $targetId);

        return $this->success([
            'following' => true,
            'user_id' => $targetId,
        ], 'User followed');
    }

    /**
     * POST /social/friends/unfollow  {user_id}
     */
    public function unfollow(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $targetId = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $targetId = (int) $request->input('user_id');
        AppQyV1UserFollowModel::unfollow($currentUser->id, $targetId);

        return $this->success([
            'following' => false,
            'user_id' => $targetId,
        ], 'User unfollowed');
    }

    /**
     * GET /social/leaderboard?period=week|all
     * Global ranking aggregated from real user_learning_progress rows.
     * XP is a deterministic score derived from real counters:
     *   learned*10 + mastered*30 + correct_answers*2.
     */
    public function getLeaderboard(Request $request)
    {
        $currentUser = $request->user();
        $period = 'all';
        $since = null;
        $statsByUser = [];
        $userIds = [];
        $users = null;
        $entries = [];
        $rank = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $period = $request->query('period', 'all');
        if (!in_array($period, ['week', 'all'], true)) {
            return $this->error('Invalid period. Supported values: week, all', 422);
        }
        if ($period === 'week') {
            $since = now()->subDays(self::ACTIVITY_WINDOW_DAYS);
        }

        $statsByUser = $this->aggregateProgressStats(null, $since);
        $userIds = array_keys($statsByUser);

        // Always include the current user in the board, even with zero progress.
        if (!in_array((int) $currentUser->id, $userIds)) {
            $userIds[] = (int) $currentUser->id;
        }

        $users = User::whereIn('id', $userIds)
            ->get(['id', 'username', 'nickname', 'name', 'avatar'])
            ->keyBy('id');

        foreach ($userIds as $userId) {
            $rowUser = $users->get($userId);
            if (!$rowUser) {
                continue;
            }
            $entries[] = [
                'user_id' => $userId,
                'username' => $rowUser->username,
                'name' => $this->displayName($rowUser),
                'avatar_url' => $this->avatarUrl($rowUser),
                'xp' => $this->xpFor($statsByUser, $userId),
                'is_current_user' => $userId === (int) $currentUser->id,
            ] + $this->statsRowFor($statsByUser, $userId);
        }

        usort($entries, function ($a, $b) {
            if ($b['xp'] === $a['xp']) {
                return $a['user_id'] <=> $b['user_id'];
            }
            return $b['xp'] <=> $a['xp'];
        });

        foreach ($entries as $index => $entry) {
            $rank = $index + 1;
            $entries[$index]['rank'] = $rank;
        }

        return $this->success([
            'period' => $period,
            'leaderboard' => $entries,
            'total' => count($entries),
        ]);
    }

    /**
     * GET /social/activities
     * Recent learning activity of followed users, derived from progress rows
     * updated inside the activity window. Returns an empty array when there
     * is no real activity - never fabricated entries.
     */
    public function getActivities(Request $request)
    {
        $currentUser = $request->user();
        $followedIds = [];
        $since = null;
        $rows = null;
        $users = null;
        $activities = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $followedIds = AppQyV1UserFollowModel::getFollowedUserIds($currentUser->id);
        if (empty($followedIds)) {
            return $this->success(['activities' => [], 'total' => 0]);
        }

        $since = now()->subDays(self::ACTIVITY_WINDOW_DAYS);
        $rows = AppQyV1UserLearningProgressModel::query()
            ->selectRaw('user_id')
            ->selectRaw("SUM(CASE WHEN learning_status IN ('learning', 'reviewing', 'learned') THEN 1 ELSE 0 END) as learned_count")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) as mastered_count")
            ->selectRaw('MAX(updated_at) as last_activity_at')
            ->whereIn('user_id', $followedIds)
            ->where('updated_at', '>=', $since)
            ->where('review_count', '>', 0)
            ->groupBy('user_id')
            ->orderByDesc('last_activity_at')
            ->get();

        if ($rows->isEmpty()) {
            return $this->success(['activities' => [], 'total' => 0]);
        }

        $users = User::whereIn('id', $rows->pluck('user_id')->all())
            ->get(['id', 'username', 'nickname', 'name', 'avatar'])
            ->keyBy('id');

        foreach ($rows as $row) {
            $rowUser = $users->get((int) $row->user_id);
            if (!$rowUser) {
                continue;
            }
            $learnedCount = (int) $row->learned_count;
            $masteredCount = (int) $row->mastered_count;
            if ($learnedCount === 0 && $masteredCount === 0) {
                continue;
            }
            $activities[] = [
                'id' => 'progress_' . $row->user_id . '_' . md5((string) $row->last_activity_at),
                'user_id' => (int) $row->user_id,
                'user_name' => $this->displayName($rowUser),
                'avatar_url' => $this->avatarUrl($rowUser),
                'action' => $masteredCount > 0
                    ? "mastered {$masteredCount} words"
                    : "learned {$learnedCount} words",
                'learned_count' => $learnedCount,
                'mastered_count' => $masteredCount,
                'time' => $row->last_activity_at,
            ];
        }

        return $this->success(['activities' => $activities, 'total' => count($activities)]);
    }

    /**
     * Aggregate learning progress counters per user from the appqyv1
     * connection. $userIds = null aggregates over every user with progress.
     * $since = null means lifetime, otherwise only rows updated after $since.
     *
     * @return array<int, array{total_words:int, learned_words:int, mastered_words:int, correct_answers:int}>
     */
    private function aggregateProgressStats(?array $userIds, $since): array
    {
        $query = null;
        $rows = null;
        $result = [];

        $query = AppQyV1UserLearningProgressModel::query()
            ->selectRaw('user_id')
            ->selectRaw('COUNT(*) as total_words')
            ->selectRaw("SUM(CASE WHEN learning_status IN ('learning', 'reviewing', 'learned') THEN 1 ELSE 0 END) as learned_words")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) as mastered_words")
            ->selectRaw('SUM(correct_count) as correct_answers')
            ->groupBy('user_id');

        if ($userIds !== null) {
            $query->whereIn('user_id', $userIds);
        }
        if ($since !== null) {
            $query->where('updated_at', '>=', $since);
        }

        $rows = $query->get();
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

    private function statsRowFor(array $statsByUser, int $userId): array
    {
        if (isset($statsByUser[$userId])) {
            return [
                'total_words' => $statsByUser[$userId]['total_words'],
                'learned_words' => $statsByUser[$userId]['learned_words'],
                'mastered_words' => $statsByUser[$userId]['mastered_words'],
            ];
        }
        return [
            'total_words' => 0,
            'learned_words' => 0,
            'mastered_words' => 0,
        ];
    }

    private function xpFor(array $statsByUser, int $userId): int
    {
        if (!isset($statsByUser[$userId])) {
            return 0;
        }
        return ($statsByUser[$userId]['learned_words'] * self::XP_PER_LEARNED_WORD)
            + ($statsByUser[$userId]['mastered_words'] * self::XP_PER_MASTERED_WORD)
            + ($statsByUser[$userId]['correct_answers'] * self::XP_PER_CORRECT_ANSWER);
    }

    /**
     * User ids (among $userIds) with a progress row updated very recently,
     * used to derive the 'studying' presence state from real data.
     */
    private function getRecentlyStudyingUserIds(array $userIds): array
    {
        return AppQyV1UserLearningProgressModel::query()
            ->whereIn('user_id', $userIds)
            ->where('updated_at', '>=', now()->subMinutes(self::STUDYING_WINDOW_MINUTES))
            ->distinct()
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function presenceStatus(User $user, bool $isStudying): string
    {
        $lastSeen = null;

        if ($isStudying) {
            return 'studying';
        }
        if ((bool) $user->is_online) {
            return 'online';
        }
        $lastSeen = $user->last_seen_at;
        if (!$lastSeen) {
            $lastSeen = $user->last_login_at;
        }
        if ($lastSeen && \Illuminate\Support\Carbon::parse($lastSeen)->gt(now()->subMinutes(self::ONLINE_WINDOW_MINUTES))) {
            return 'online';
        }
        return 'offline';
    }

    private function displayName(User $user): string
    {
        if (!empty($user->nickname)) {
            return $user->nickname;
        }
        if (!empty($user->name)) {
            return $user->name;
        }
        return (string) $user->username;
    }

    private function avatarUrl(User $user): ?string
    {
        if (!empty($user->avatar)) {
            return AvatarService::getAvatarUrl($user->avatar);
        }
        return null;
    }
}
