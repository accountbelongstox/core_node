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
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserFollowModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1FriendRequestModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserPresenceModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1NotificationModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ConversationModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SocialPresenter;

class AppQyV1SocialController extends Controller
{
    use ApiResponse;

    private const ACTIVITY_WINDOW_DAYS = 7;
    private const STUDYING_WINDOW_MINUTES = 30;

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

        $followRows = AppQyV1UserFollowModel::rowsForUser((int) $currentUser->id);
        $followedIds = $followRows->pluck('followed_user_id')->map(fn ($id) => (int) $id)->all();

        if (empty($followedIds)) {
            return $this->success(['friends' => [], 'total' => 0]);
        }

        $users = User::indexedByIds($followedIds, ['id', 'username', 'nickname', 'name', 'avatar']);
$statsByUser = AppQyV1SocialPresenter::aggregateProgressStats($followedIds, null);
        $studyingIds = AppQyV1UserLearningProgressModel::recentlyStudyingUserIds(
            $followedIds,
            self::STUDYING_WINDOW_MINUTES
        );
        // Presence batched from app_qy_v1_user_presence (heartbeat truth).
        $presenceMap = AppQyV1UserPresenceModel::effectiveFor($followedIds);

        foreach ($followRows as $row) {
            $friendUser = $users->get((int) $row->followed_user_id);
            if (!$friendUser) {
                continue;
            }
            $friends[] = [
                'id' => $friendUser->id,
                'username' => $friendUser->username,
                'name' => AppQyV1SocialPresenter::displayName($friendUser),
                'avatar_url' => AppQyV1SocialPresenter::avatarUrl($friendUser),
                'status' => AppQyV1SocialPresenter::presenceStatus($friendUser, in_array($friendUser->id, $studyingIds), $presenceMap),
                'presence' => $presenceMap[(int) $friendUser->id] ?? ['status' => 'offline', 'last_seen_at' => null],
                'followed_at' => $row->created_at ? $row->created_at->toISOString() : null,
                'stats' => AppQyV1SocialPresenter::statsRow($statsByUser, $friendUser->id),
            ];
        }

        return $this->success(['friends' => $friends, 'total' => count($friends)]);
    }

    /**
     * GET /social/friends/search?q=&native=&target=
     * Search users by username / nickname / name, with optional language filters
     * (native_language exact, learning_languages contains target). Excludes the
     * current user. Annotates is_following / is_friend.
     */
    public function searchUsers(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $query = '';
        $needle = '';
        $native = '';
        $target = '';
        $followedIds = [];
        $friendIds = [];
        $userIds = [];
        $presenceMap = [];
        $users = null;
        $results = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'q' => ['required', 'string', 'min:1', 'max:100'],
            'native' => ['nullable', 'string', 'max:10'],
            'target' => ['nullable', 'string', 'max:10'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $query = trim((string) $request->query('q'));
        $native = strtolower(trim((string) $request->query('native', '')));
        $target = strtolower(trim((string) $request->query('target', '')));
        $followedIds = AppQyV1UserFollowModel::getFollowedUserIds($currentUser->id);
        $friendIds = AppQyV1FriendRequestModel::acceptedFriendIds((int) $currentUser->id);

        // Case-insensitive on BOTH drivers: plain LIKE is case-insensitive on
        // sqlite but case-SENSITIVE on pgsql, so lower both sides explicitly.
        $users = User::searchSocialProfiles(
            (int) $currentUser->id,
            $query,
            $native,
            $target,
            20
        );

        $userIds = $users->pluck('id')->map(fn ($id) => (int) $id)->all();
        $presenceMap = AppQyV1UserPresenceModel::effectiveFor($userIds);

        foreach ($users as $foundUser) {
            $results[] = [
                'id' => $foundUser->id,
                'username' => $foundUser->username,
                'name' => AppQyV1SocialPresenter::displayName($foundUser),
                'avatar_url' => AppQyV1SocialPresenter::avatarUrl($foundUser),
                'native_language' => $foundUser->native_language,
                'learning_languages' => AppQyV1SocialPresenter::normalizeLanguages($foundUser->learning_languages),
                'status' => AppQyV1SocialPresenter::presenceStatus($foundUser, false, $presenceMap),
                'is_following' => in_array((int) $foundUser->id, $followedIds),
                'is_friend' => in_array((int) $foundUser->id, $friendIds),
            ];
        }

        return $this->success(['users' => $results, 'total' => count($results)]);
    }

    /**
     * GET /social/discover?native=&target=&q=&limit=
     * Find language partners (SOCIAL_FEATURE_SPECIFICATION.md §5). Cross-DB:
     * users live on the DEFAULT connection, app_qy_v1_* on appqyv1 — queried
     * SEPARATELY and merged in PHP (never cross-joined). A row is matched by
     * language-exchange (best), or by the native/target filters; self + blocked
     * users are excluded; each row is annotated is_following/is_friend + stats.
     */
    public function discover(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $native = '';
        $target = '';
        $q = '';
        $limit = 30;
        $myNative = '';
        $myLearning = [];
        $excludeIds = [];
        $followedIds = [];
        $friendIds = [];
        $builder = null;
        $users = null;
        $userIds = [];
        $statsByUser = [];
        $presenceMap = [];
        $studyingIds = [];
        $results = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'native' => ['nullable', 'string', 'max:10'],
            'target' => ['nullable', 'string', 'max:10'],
            'q' => ['nullable', 'string', 'max:100'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $native = strtolower(trim((string) $request->query('native', '')));
        $target = strtolower(trim((string) $request->query('target', '')));
        $q = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 30);

        $myNative = strtolower((string) ($currentUser->native_language ?? ''));
        $myLearning = AppQyV1SocialPresenter::normalizeLanguages($currentUser->learning_languages);

        // Exclude self + already-followed + blocked (computed on appqyv1 conn).
        $followedIds = AppQyV1UserFollowModel::getFollowedUserIds((int) $currentUser->id);
        $friendIds = AppQyV1FriendRequestModel::acceptedFriendIds((int) $currentUser->id);
        $excludeIds = [(int) $currentUser->id];
        foreach ($followedIds as $id) {
            $excludeIds[] = (int) $id;
        }
        foreach (AppQyV1FriendRequestModel::blockedIds((int) $currentUser->id) as $id) {
            $excludeIds[] = (int) $id;
        }
        $excludeIds = array_values(array_unique($excludeIds));

        $users = User::discoverSocialProfiles($excludeIds, $q, $native, $target, $limit);

        // ---- Merge AppQyV1 stats + presence in PHP (separate conn) ----
        $userIds = $users->pluck('id')->map(fn ($id) => (int) $id)->all();
        $statsByUser = AppQyV1SocialPresenter::aggregateProgressStats($userIds, null);
        $presenceMap = AppQyV1UserPresenceModel::effectiveFor($userIds);
        $studyingIds = AppQyV1UserLearningProgressModel::recentlyStudyingUserIds(
            $userIds,
            self::STUDYING_WINDOW_MINUTES
        );

        foreach ($users as $u) {
            $theirNative = strtolower((string) ($u->native_language ?? ''));
            $theirLearning = AppQyV1SocialPresenter::normalizeLanguages($u->learning_languages);

            // Language-exchange match: their learning ∋ my native AND my learning ∋ their native.
            $isExchange = $myNative !== '' && $theirNative !== ''
                && in_array($myNative, $theirLearning, true)
                && in_array($theirNative, $myLearning, true);

            $match = 'native';
            if ($isExchange) {
                $match = 'exchange';
            } elseif ($target !== '' && in_array($target, $theirLearning, true)) {
                $match = 'target';
            } elseif ($native !== '' && $theirNative === $native) {
                $match = 'native';
            }

            $results[] = [
                'id' => (int) $u->id,
                'nickname' => AppQyV1SocialPresenter::displayName($u),
                'avatar' => AppQyV1SocialPresenter::avatarUrl($u),
                'native_language' => $u->native_language,
                'learning_languages' => $theirLearning,
                'is_following' => in_array((int) $u->id, $followedIds),
                'is_friend' => in_array((int) $u->id, $friendIds),
                'match' => $match,
                'presence' => $presenceMap[(int) $u->id] ?? ['status' => 'offline', 'last_seen_at' => null],
                'status' => AppQyV1SocialPresenter::presenceStatus($u, in_array((int) $u->id, $studyingIds), $presenceMap),
                'stats' => AppQyV1SocialPresenter::statsRow($statsByUser, (int) $u->id),
                '_exchange' => $isExchange,
            ];
        }

        // Rank exchange matches first, then trim to the requested limit.
        usort($results, function ($a, $b) {
            if ($a['_exchange'] !== $b['_exchange']) {
                return $b['_exchange'] <=> $a['_exchange'];
            }
            return $b['id'] <=> $a['id'];
        });
        $results = array_slice($results, 0, max(1, min(100, $limit)));
        foreach ($results as &$row) {
            unset($row['_exchange']);
        }
        unset($row);

        return $this->success(['users' => $results, 'total' => count($results)]);
    }

    /**
     * GET /social/users/{id}
     * Public profile for the user-profile page (#/social/user/<id>). Cross-DB:
     * the user row (name/avatar/languages/bio) comes from the DEFAULT connection;
     * follow/friend/presence/post counts come from appqyv1 — merged in PHP, never
     * cross-joined. post_count counts that user's posts VISIBLE to the current
     * viewer (same visibility rules as the author-scoped feed). presence reads
     * app_qy_v1_user_presence with the 60s stale rule.
     */
    public function getUserProfile(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $targetUser = null;
        $myFollowedIds = [];
        $followerCount = 0;
        $followingCount = 0;
        $isFollowing = false;
        $isFriend = false;
        $postCount = 0;
        $presenceMap = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $targetUser = User::findById($id);
        if (!$targetUser) {
            return $this->notFound('User not found');
        }

        // ---- Follow / friend relationships (appqyv1 connection) ----
        $myFollowedIds = AppQyV1UserFollowModel::getFollowedUserIds($myId);
        $isFollowing = in_array($id, array_map('intval', $myFollowedIds), true);
        $isFriend = AppQyV1FriendRequestModel::areFriends($myId, $id);

        $followCounts = AppQyV1UserFollowModel::countsForUser($id);
        $followingCount = (int) $followCounts['following_count'];
        $followerCount = (int) $followCounts['follower_count'];

        // ---- Visible post count (mirrors the author-scoped feed visibility) ----
        $postCount = AppQyV1PostModel::visibleCountForViewer($id, $myId, $myFollowedIds);

        // ---- Presence (60s stale rule, batched effectiveFor) ----
        $presenceMap = AppQyV1UserPresenceModel::effectiveFor([$id]);

        return $this->success([
            'user' => [
                'id' => (int) $targetUser->id,
                'name' => AppQyV1SocialPresenter::displayName($targetUser),
                'avatar_url' => AppQyV1SocialPresenter::avatarUrl($targetUser),
                'native_language' => $targetUser->native_language,
                'learning_languages' => AppQyV1SocialPresenter::normalizeLanguages($targetUser->learning_languages),
                'bio' => $targetUser->bio,
                'post_count' => $postCount,
                'follower_count' => $followerCount,
                'following_count' => $followingCount,
                'is_following' => $isFollowing,
                'is_friend' => $isFriend,
                'presence' => $presenceMap[$id] ?? ['status' => 'offline', 'last_seen_at' => null],
            ],
        ]);
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

        $targetUser = User::findById($targetId);
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

        $statsByUser = AppQyV1SocialPresenter::aggregateProgressStats(null, $since);
        $userIds = array_keys($statsByUser);

        // Always include the current user in the board, even with zero progress.
        if (!in_array((int) $currentUser->id, $userIds)) {
            $userIds[] = (int) $currentUser->id;
        }

        $users = User::indexedByIds($userIds, ['id', 'username', 'nickname', 'name', 'avatar']);

        foreach ($userIds as $userId) {
            $rowUser = $users->get($userId);
            if (!$rowUser) {
                continue;
            }
            $entries[] = [
                'user_id' => $userId,
                'username' => $rowUser->username,
                'name' => AppQyV1SocialPresenter::displayName($rowUser),
                'avatar_url' => AppQyV1SocialPresenter::avatarUrl($rowUser),
                'xp' => AppQyV1SocialPresenter::xp($statsByUser, $userId),
                'is_current_user' => $userId === (int) $currentUser->id,
            ] + AppQyV1SocialPresenter::statsRow($statsByUser, $userId);
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
        $rows = AppQyV1UserLearningProgressModel::socialStatsForUserIds($followedIds, $since, true)
            ->sortByDesc('last_activity_at');

        if ($rows->isEmpty()) {
            return $this->success(['activities' => [], 'total' => 0]);
        }

        $users = User::indexedByIds(
            $rows->pluck('user_id')->all(),
            ['id', 'username', 'nickname', 'name', 'avatar']
        );

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
                'user_name' => AppQyV1SocialPresenter::displayName($rowUser),
                'avatar_url' => AppQyV1SocialPresenter::avatarUrl($rowUser),
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
    public function sendFriendRequest(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $targetId = 0;
        $targetUser = null;
        $row = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $targetId = (int) $request->input('user_id');
        if ($targetId === $myId) {
            return $this->error('Cannot friend yourself', 422);
        }

        $targetUser = User::findById($targetId);
        if (!$targetUser) {
            return $this->notFound('User not found');
        }

        // Already accepted friends -> nothing to do.
        if (AppQyV1FriendRequestModel::areFriends($myId, $targetId)) {
            return $this->success(['status' => AppQyV1FriendRequestModel::STATUS_ACCEPTED, 'request_id' => null], 'Already friends');
        }

        $row = AppQyV1FriendRequestModel::sendOrReset($myId, $targetId);

        // Notify + SSE the addressee (best-effort).
        $notifId = AppQyV1NotificationModel::notify($targetId, 'friend_request', [
            'request_id' => (int) $row->id,
            'requester_id' => $myId,
            'requester_name' => AppQyV1SocialPresenter::displayName($currentUser),
        ]);
        AppQyV1SocialEventModel::emit($targetId, 'friend.request', [
            'request_id' => (int) $row->id,
            'requester_id' => $myId,
            'requester_name' => AppQyV1SocialPresenter::displayName($currentUser),
        ]);
        if ($notifId > 0) {
            AppQyV1SocialEventModel::emit($targetId, 'notification.new', [
                'id' => $notifId,
                'type' => 'friend_request',
            ]);
        }

        return $this->success([
            'request_id' => (int) $row->id,
            'status' => (string) $row->status,
        ], 'Friend request sent');
    }

    /**
     * POST /social/friends/respond {request_id, action: accept|reject}
     * Update the request status. On accept: notification + SSE friend.accept to
     * the requester, plus ensure a direct conversation exists. Only the addressee
     * may respond.
     */
    public function respondFriendRequest(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $requestId = 0;
        $action = '';
        $row = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'request_id' => ['required', 'integer', 'min:1'],
            'action' => ['required', 'string', 'in:accept,reject'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $requestId = (int) $request->input('request_id');
        $action = (string) $request->input('action');

        $row = AppQyV1FriendRequestModel::findRequest($requestId);
        if (!$row) {
            return $this->notFound('Friend request not found');
        }
        // Only the addressee may accept/reject.
        if ((int) $row->addressee_id !== $myId) {
            return $this->forbidden('Not your friend request to respond to');
        }
        if ($row->status !== AppQyV1FriendRequestModel::STATUS_PENDING) {
            return $this->error('Friend request is not pending', 422);
        }

        if ($action === 'reject') {
            $row->rejectRequest();
            return $this->success(['request_id' => $requestId, 'status' => $row->status], 'Friend request rejected');
        }

        // accept
        $row->acceptRequest();

        // Ensure a direct conversation between the pair (best-effort).
        AppQyV1ConversationModel::ensureDirect((int) $row->requester_id, (int) $row->addressee_id);

        // Notify + SSE the original requester (best-effort).
        $notifId = AppQyV1NotificationModel::notify((int) $row->requester_id, 'friend_accept', [
            'request_id' => $requestId,
            'addressee_id' => $myId,
            'addressee_name' => AppQyV1SocialPresenter::displayName($currentUser),
        ]);
        AppQyV1SocialEventModel::emit((int) $row->requester_id, 'friend.accept', [
            'request_id' => $requestId,
            'addressee_id' => $myId,
            'addressee_name' => AppQyV1SocialPresenter::displayName($currentUser),
        ]);
        if ($notifId > 0) {
            AppQyV1SocialEventModel::emit((int) $row->requester_id, 'notification.new', [
                'id' => $notifId,
                'type' => 'friend_accept',
            ]);
        }

        return $this->success(['request_id' => $requestId, 'status' => $row->status], 'Friend request accepted');
    }

    /**
     * GET /social/friends/requests?direction=incoming|outgoing
     * Pending requests addressed to me (incoming) or sent by me (outgoing).
     */
    public function friendRequests(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $direction = 'incoming';
        $rows = null;
        $otherIds = [];
        $users = null;
        $items = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'direction' => ['nullable', 'string', 'in:incoming,outgoing'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $direction = (string) $request->query('direction', 'incoming');

        $rows = AppQyV1FriendRequestModel::pendingForUser($myId, $direction);

        foreach ($rows as $row) {
            $otherIds[] = $direction === 'incoming' ? (int) $row->requester_id : (int) $row->addressee_id;
        }
        $users = User::indexedByIds($otherIds, ['id', 'username', 'nickname', 'name', 'avatar']);

        foreach ($rows as $row) {
            $otherId = $direction === 'incoming' ? (int) $row->requester_id : (int) $row->addressee_id;
            $otherUser = $users->get($otherId);
            if (!$otherUser) {
                continue;
            }
            $items[] = [
                'request_id' => (int) $row->id,
                'direction' => $direction,
                'status' => (string) $row->status,
                'user' => [
                    'id' => (int) $otherUser->id,
                    'nickname' => AppQyV1SocialPresenter::displayName($otherUser),
                    'avatar' => AppQyV1SocialPresenter::avatarUrl($otherUser),
                ],
                'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
            ];
        }

        return $this->success(['requests' => $items, 'total' => count($items)]);
    }

    /**
     * POST /social/friends/block {user_id}
     * Set the relationship to blocked (creating the row if needed). The blocker
     * is recorded as the requester so the pair has one blocked row.
     */
    public function blockUser(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $targetId = 0;
        $row = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $targetId = (int) $request->input('user_id');
        if ($targetId === $myId) {
            return $this->error('Cannot block yourself', 422);
        }

        $row = AppQyV1FriendRequestModel::blockPair($myId, $targetId);

        return $this->success(['user_id' => $targetId, 'status' => $row->status], 'User blocked');
    }

}
