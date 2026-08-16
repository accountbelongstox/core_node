<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AvatarService;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostImageModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostLikeModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostCommentModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserFollowModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1NotificationModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;

/**
 * Social Center posts / feed (Social Center expansion §POSTS). users (default
 * conn) and app_qy_v1_* (appqyv1 conn) are queried separately and merged in PHP
 * — never cross-joined. SSE post.created -> author's followers; post.liked /
 * post.comment -> the post author (best-effort, never breaks the action).
 */
class AppQyV1PostController extends Controller
{
    use ApiResponse;

    private const FEED_DEFAULT_LIMIT = 20;
    private const FEED_MAX_LIMIT = 50;
    private const COMMENT_DEFAULT_LIMIT = 30;
    private const COMMENT_MAX_LIMIT = 100;

    /**
     * GET /social/posts?cursor=&limit=20&filter=all|images|videos|following&author_id=
     * Feed = own + followed + public, newest-first, cursor by descending id.
     *
     * When author_id is present the result is SCOPED to that single author and
     * trimmed to the posts visible to the current viewer (powers the profile
     * page): public always; followers if the viewer follows them; private only
     * when the viewer IS the author. filter (images/videos) still applies;
     * filter=following is ignored in author-scoped mode (already a single author).
     */
    public function timeline(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $cursor = 0;
        $limit = self::FEED_DEFAULT_LIMIT;
        $filter = 'all';
        $authorId = 0;
        $followedIds = [];
        $rows = null;
        $postIds = [];
        $imagesByPost = [];
        $likedIds = [];
        $authors = null;
        $items = [];
        $nextCursor = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:' . self::FEED_MAX_LIMIT],
            'filter' => ['nullable', 'string', 'in:all,images,videos,following'],
            'author_id' => ['nullable', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $cursor = (int) $request->query('cursor', 0);
        $limit = (int) $request->query('limit', self::FEED_DEFAULT_LIMIT);
        $filter = (string) $request->query('filter', 'all');
        $authorId = (int) $request->query('author_id', 0);

        $followedIds = AppQyV1UserFollowModel::getFollowedUserIds($myId);

        $rows = AppQyV1PostModel::timelineForViewer(
            $myId,
            $followedIds,
            $authorId,
            $filter,
            $cursor,
            $limit
        );

        $postIds = $rows->pluck('id')->map(fn ($id) => (int) $id)->all();
        $imagesByPost = $this->imagesByPost($postIds);
        $likedIds = AppQyV1PostLikeModel::likedPostIds($myId, $postIds);
        $authors = $this->authorsFor($rows->pluck('user_id')->map(fn ($id) => (int) $id)->all());

        foreach ($rows as $row) {
            $items[] = $this->postShape($row, $authors, $imagesByPost, $likedIds);
        }
        if (count($items) === $limit && !empty($items)) {
            $nextCursor = (int) $items[count($items) - 1]['id'];
        }

        return $this->success([
            'items' => $items,
            'next_cursor' => $nextCursor,
        ]);
    }

    /**
     * POST /social/posts {content?, post_type, external_url?, visibility?}
     * Creates a post; SSE post.created to the author's followers.
     */
    public function create(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $postType = AppQyV1PostModel::TYPE_TEXT;
        $content = null;
        $externalUrl = null;
        $visibility = AppQyV1PostModel::VISIBILITY_PUBLIC;
        $post = null;
        $shape = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'content' => ['nullable', 'string', 'max:5000'],
            'post_type' => ['required', 'string', 'in:text,images,video,live'],
            'external_url' => ['nullable', 'string', 'max:500'],
            'visibility' => ['nullable', 'string', 'in:public,followers,private'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $postType = (string) $request->input('post_type');
        $content = $request->input('content');
        $externalUrl = $request->input('external_url');
        $visibility = (string) $request->input('visibility', AppQyV1PostModel::VISIBILITY_PUBLIC);

        // A text post must carry content; media/live posts can be empty here
        // (images/video uploaded via the media endpoints, live via external_url).
        if ($postType === AppQyV1PostModel::TYPE_TEXT && (!is_string($content) || trim($content) === '')) {
            return $this->error('A text post requires content', 422);
        }

        $post = AppQyV1PostModel::createForUser(
            $myId,
            is_string($content) ? $content : null,
            $postType,
            is_string($externalUrl) && $externalUrl !== '' ? $externalUrl : null,
            $visibility
        );

        $shape = $this->postShape(
            $post,
            $this->authorsFor([$myId]),
            [],
            []
        );

        $this->fanoutToFollowers($myId, 'post.created', [
            'post_id' => (int) $post->id,
            'author_id' => $myId,
            'post' => $shape,
        ]);

        return $this->success(['post' => $shape], 'Post created');
    }

    /**
     * GET /social/posts/{id}
     */
    public function show(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $post = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $post = AppQyV1PostModel::findPost($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if (!$post->canBeViewedBy($myId)) {
            return $this->forbidden('You cannot view this post');
        }

        return $this->success([
            'post' => $this->postShape(
                $post,
                $this->authorsFor([(int) $post->user_id]),
                $this->imagesByPost([(int) $post->id]),
                AppQyV1PostLikeModel::likedPostIds($myId, [(int) $post->id])
            ),
        ]);
    }

    /**
     * DELETE /social/posts/{id}  (author only, soft delete)
     */
    public function destroy(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $post = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $post = AppQyV1PostModel::findPost($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if ((int) $post->user_id !== $myId) {
            return $this->forbidden('Only the author can delete this post');
        }

        $post->deletePost();

        return $this->success(['post_id' => $id], 'Post deleted');
    }

    /**
     * POST /social/posts/{id}/like  -> {like_count, liked_by_me:true}
     */
    public function like(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $post = null;
        $likeResult = [];
        $likeCount = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $post = AppQyV1PostModel::findPost($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if (!$post->canBeViewedBy($myId)) {
            return $this->forbidden('You cannot like this post');
        }

        $likeResult = $post->registerLike($myId);
        if ($likeResult['was_created']) {
            // Notify + SSE the post author (skip self-likes).
            if ((int) $post->user_id !== $myId) {
                AppQyV1SocialEventModel::emit((int) $post->user_id, 'post.liked', [
                    'post_id' => $id,
                    'actor_id' => $myId,
                    'actor_name' => $this->displayName($currentUser),
                ]);
                $notifId = AppQyV1NotificationModel::notify((int) $post->user_id, 'post_like', [
                    'post_id' => $id,
                    'actor_id' => $myId,
                    'actor_name' => $this->displayName($currentUser),
                ]);
                if ($notifId > 0) {
                    AppQyV1SocialEventModel::emit((int) $post->user_id, 'notification.new', [
                        'id' => $notifId,
                        'type' => 'post_like',
                        'post_id' => $id,
                    ]);
                }
            }
        }

        $likeCount = (int) $likeResult['like_count'];

        return $this->success([
            'like_count' => $likeCount,
            'liked_by_me' => true,
        ]);
    }

    /**
     * POST /social/posts/{id}/unlike  -> {like_count, liked_by_me:false}
     */
    public function unlike(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $post = null;
        $unlikeResult = [];
        $likeCount = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $post = AppQyV1PostModel::findPost($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }

        $unlikeResult = $post->removeLike($myId);
        $likeCount = (int) $unlikeResult['like_count'];

        return $this->success([
            'like_count' => $likeCount,
            'liked_by_me' => false,
        ]);
    }

    /**
     * GET /social/posts/{id}/comments?cursor=  -> {items:[Comment], next_cursor}
     * Comments ASC after cursor (id-based).
     */
    public function comments(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $cursor = 0;
        $limit = self::COMMENT_DEFAULT_LIMIT;
        $post = null;
        $rows = null;
        $authors = null;
        $items = [];
        $nextCursor = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $validator = Validator::make($request->all(), [
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:' . self::COMMENT_MAX_LIMIT],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $post = AppQyV1PostModel::findPost($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if (!$post->canBeViewedBy($myId)) {
            return $this->forbidden('You cannot view this post');
        }

        $cursor = (int) $request->query('cursor', 0);
        $limit = (int) $request->query('limit', self::COMMENT_DEFAULT_LIMIT);

        $rows = AppQyV1PostCommentModel::afterCursor($id, $cursor, $limit);

        $authors = $this->authorsFor($rows->pluck('user_id')->map(fn ($uid) => (int) $uid)->all());

        foreach ($rows as $row) {
            $items[] = $this->commentShape($row, $authors);
        }
        if (count($items) === $limit && !empty($items)) {
            $nextCursor = (int) $items[count($items) - 1]['id'];
        }

        return $this->success([
            'items' => $items,
            'next_cursor' => $nextCursor,
        ]);
    }

    /**
     * POST /social/posts/{id}/comments {body, parent_id?}  -> {Comment}
     */
    public function createComment(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $post = null;
        $body = '';
        $parentId = null;
        $parent = null;
        $comment = null;
        $shape = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $validator = Validator::make($request->all(), [
            'body' => ['required', 'string', 'min:1', 'max:2000'],
            'parent_id' => ['nullable', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $post = AppQyV1PostModel::findPost($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if (!$post->canBeViewedBy($myId)) {
            return $this->forbidden('You cannot comment on this post');
        }

        $body = (string) $request->input('body');
        $parentId = $request->input('parent_id');
        if ($parentId !== null) {
            $parentId = (int) $parentId;
            // Parent must belong to THIS post (one-level threading).
            $parent = AppQyV1PostCommentModel::findOnPost($parentId, $id);
            if (!$parent) {
                return $this->error('Parent comment not found on this post', 422);
            }
        }

        $comment = AppQyV1PostCommentModel::createForPost($id, $myId, $body, $parentId);

        $shape = $this->commentShape($comment, $this->authorsFor([$myId]));

        // Notify + SSE the post author (skip self-comments).
        if ((int) $post->user_id !== $myId) {
            AppQyV1SocialEventModel::emit((int) $post->user_id, 'post.comment', [
                'post_id' => $id,
                'comment' => $shape,
                'actor_id' => $myId,
                'actor_name' => $this->displayName($currentUser),
            ]);
            $notifId = AppQyV1NotificationModel::notify((int) $post->user_id, 'post_comment', [
                'post_id' => $id,
                'comment_id' => (int) $comment->id,
                'actor_id' => $myId,
                'actor_name' => $this->displayName($currentUser),
                'preview' => mb_substr($body, 0, 120),
            ]);
            if ($notifId > 0) {
                AppQyV1SocialEventModel::emit((int) $post->user_id, 'notification.new', [
                    'id' => $notifId,
                    'type' => 'post_comment',
                    'post_id' => $id,
                ]);
            }
        }

        return $this->success(['comment' => $shape], 'Comment posted');
    }

    /**
     * DELETE /social/posts/{id}/comments/{cid}  (author only)
     */
    public function deleteComment(Request $request, int $id, int $cid)
    {
        $currentUser = $request->user();
        $myId = 0;
        $comment = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $comment = AppQyV1PostCommentModel::findOnPost($cid, $id);
        if (!$comment) {
            return $this->notFound('Comment not found');
        }
        if ((int) $comment->user_id !== $myId) {
            return $this->forbidden('Only the author can delete this comment');
        }

        $comment->deleteFromPost();

        return $this->success(['comment_id' => $cid, 'post_id' => $id], 'Comment deleted');
    }

    // ---- Shared shaping / visibility / fanout helpers ----

    /**
     * Emit $event to every follower of $authorId (the followers are the users
     * whose user_follows.followed_user_id == authorId). Best-effort.
     */
    private function fanoutToFollowers(int $authorId, string $event, array $data): void
    {
        $followerIds = AppQyV1UserFollowModel::followerUserIds($authorId);
        foreach (array_unique($followerIds) as $followerId) {
            if ((int) $followerId === $authorId) {
                continue;
            }
            AppQyV1SocialEventModel::emit((int) $followerId, $event, $data);
        }
    }

    /**
     * Images grouped by post id, ordered by sequence.
     *
     * @param array<int, int> $postIds
     * @return array<int, array<int, array>>
     */
    private function imagesByPost(array $postIds): array
    {
        $out = [];
        if (empty($postIds)) {
            return $out;
        }
        $rows = AppQyV1PostImageModel::orderedForPosts($postIds);
        foreach ($rows as $row) {
            $out[(int) $row->post_id][] = [
                'id' => (int) $row->id,
                'url' => (string) $row->image_url,
                'caption' => $row->caption !== null ? (string) $row->caption : null,
                'sequence' => (int) $row->sequence,
            ];
        }
        return $out;
    }

    /**
     * Build a {id => User} map (DEFAULT connection) for a set of author ids.
     *
     * @param array<int, int> $userIds
     */
    private function authorsFor(array $userIds)
    {
        return User::indexedByIds($userIds, ['id', 'username', 'nickname', 'name', 'avatar']);
    }

    /** FE-facing Post shape. */
    private function postShape(AppQyV1PostModel $row, $authors, array $imagesByPost, array $likedIds): array
    {
        $authorUser = $authors->get((int) $row->user_id);
        $postId = (int) $row->id;

        return [
            'id' => $postId,
            'author' => $this->userMini($authorUser, (int) $row->user_id),
            'content' => $row->content !== null ? (string) $row->content : null,
            'post_type' => (string) $row->post_type,
            'images' => $imagesByPost[$postId] ?? [],
            'video_url' => $row->video_url !== null ? (string) $row->video_url : null,
            'external_url' => $row->external_url !== null ? (string) $row->external_url : null,
            'cover_url' => $row->cover_image_url !== null ? (string) $row->cover_image_url : null,
            'like_count' => (int) $row->like_count,
            'comment_count' => (int) $row->comment_count,
            'liked_by_me' => in_array($postId, $likedIds, true),
            'visibility' => (string) $row->visibility,
            'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
        ];
    }

    /** FE-facing Comment shape. */
    private function commentShape(AppQyV1PostCommentModel $row, $authors): array
    {
        $authorUser = $authors->get((int) $row->user_id);
        return [
            'id' => (int) $row->id,
            'post_id' => (int) $row->post_id,
            'parent_id' => $row->parent_comment_id !== null ? (int) $row->parent_comment_id : null,
            'author' => $this->userMini($authorUser, (int) $row->user_id),
            'body' => (string) $row->body,
            'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
        ];
    }

    /**
     * User mini-object {id, name, avatar_url}. Falls back to a placeholder when
     * the user row is missing (deleted account) so the shape never breaks.
     */
    private function userMini(?User $user, int $fallbackId): array
    {
        if (!$user) {
            return ['id' => $fallbackId, 'name' => 'Unknown', 'avatar_url' => null];
        }
        return [
            'id' => (int) $user->id,
            'name' => $this->displayName($user),
            'avatar_url' => $this->avatarUrl($user),
        ];
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
