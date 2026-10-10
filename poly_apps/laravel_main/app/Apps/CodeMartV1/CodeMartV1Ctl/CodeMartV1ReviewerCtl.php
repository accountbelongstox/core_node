<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1Pagination;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ReviewerApplicationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskSubmissionModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1ReviewerCtl extends Controller
{
    use ApiResponse;

    private const ACTION_REVIEWER_REVIEW_RECORDED = 'reviewer_review_recorded';

    public function startReviewerApplication(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $existingRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, CodeMartV1Constants::ROLE_REVIEWER);

        if ($existingRole && $existingRole->role_status === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_ALREADY_ACTIVE, __('codemart.messages.you_are_already_a_reviewer'), null, 409);
        }

        $recentApplication = CodeMartV1ReviewerApplicationModel::recentForUser((int) $user->id, CodeMartV1Constants::REVIEWER_RETRY_DAYS);

        // An unfinished test is resumed instead of blocking the retry window.
        if ($recentApplication && $recentApplication->status === CodeMartV1Constants::REVIEWER_APPLICATION_IN_PROGRESS) {
            return $this->applicationStarted($recentApplication, (array) json_decode((string) $recentApplication->test_cases, true));
        }
        if ($recentApplication) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_RETRY_TOO_SOON, __('codemart.messages.you_can_only_apply_once_every_7'), [
                'retry_at' => $recentApplication->created_at?->copy()->addDays(CodeMartV1Constants::REVIEWER_RETRY_DAYS)->toIso8601String(),
            ], 409);
        }

        $testCases = $this->generateTestCases();

        $application = CodeMartV1ReviewerApplicationModel::runInTransaction(function () use ($user, $testCases) {
            return CodeMartV1ReviewerApplicationModel::createRecord([
                'user_id' => $user->id,
                'status' => CodeMartV1Constants::REVIEWER_APPLICATION_IN_PROGRESS,
                'test_cases' => json_encode($testCases),
            ]);
        });

        return $this->applicationStarted($application, $testCases);
    }

    /** The expected ratings are the grading key and never leave the server. */
    private function applicationStarted(CodeMartV1ReviewerApplicationModel $application, array $testCases): JsonResponse
    {
        $publicCases = array_map(static fn (array $testCase): array => [
            'code_snippet_id' => $testCase['code_snippet_id'],
            'code' => $testCase['code'],
        ], $testCases);

        return $this->success([
            'application_id' => $application->id,
            'test_cases' => $publicCases,
            'instructions' => __('codemart.messages.reviewer_test_instructions', [
                'count' => count($publicCases),
                'min' => CodeMartV1Constants::MIN_RATING,
                'max' => CodeMartV1Constants::MAX_RATING,
            ]),
        ]);
    }

    public function submitReviewerTest(Request $request, $applicationId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'reviews' => 'required|array|size:' . CodeMartV1Constants::REVIEWER_TEST_SNIPPETS,
            'reviews.*.code_snippet_id' => 'required|integer|distinct',
            'reviews.*.quality_rating' => 'required|integer|min:' . CodeMartV1Constants::MIN_RATING . '|max:' . CodeMartV1Constants::MAX_RATING,
            'reviews.*.readability_rating' => 'required|integer|min:' . CodeMartV1Constants::MIN_RATING . '|max:' . CodeMartV1Constants::MAX_RATING,
            'reviews.*.efficiency_rating' => 'required|integer|min:' . CodeMartV1Constants::MIN_RATING . '|max:' . CodeMartV1Constants::MAX_RATING,
            'reviews.*.comments' => 'required|string|min:' . CodeMartV1Constants::REVIEWER_COMMENT_MIN_LENGTH,
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $application = CodeMartV1ReviewerApplicationModel::findOwnedInProgress(
            (int) $applicationId,
            (int) $user->id
        );

        if (!$application) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_APPLICATION_NOT_FOUND, __('codemart.messages.application_not_found_or_already_processed'), null, 404);
        }

        $testCases = json_decode($application->test_cases, true);
        $userReviews = $request->reviews;

        $similarity = $this->calculateReviewSimilarity($testCases, $userReviews);
        $passed = $similarity >= CodeMartV1Constants::REVIEWER_MIN_SIMILARITY;

        $application = CodeMartV1ReviewerApplicationModel::runInTransaction(function () use ($application, $userReviews, $similarity, $user, $passed) {
            $application->updateRecord([
                'status' => $passed ? CodeMartV1Constants::REVIEWER_APPLICATION_PASSED : CodeMartV1Constants::REVIEWER_APPLICATION_FAILED,
                'user_reviews' => json_encode($userReviews),
                'similarity_score' => $similarity,
                'completed_at' => now(),
            ]);

            if ($passed) {
                $existingRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, CodeMartV1Constants::ROLE_REVIEWER);

                if ($existingRole) {
                    $existingRole->updateRecord(['role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE, 'role_activated_at' => now()]);
                } else {
                    CodeMartV1UserRoleModel::createRecord([
                        'user_id' => $user->id,
                        'role_type' => CodeMartV1Constants::ROLE_REVIEWER,
                        'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                        'role_activated_at' => now(),
                    ]);
                }
            }

            return $application;
        });

        return $this->success([
            'status' => $application->status,
            'similarity_score' => $similarity,
            'message' => $passed
                ? __('codemart.messages.reviewer_test_passed')
                : __('codemart.messages.reviewer_test_failed', ['days' => CodeMartV1Constants::REVIEWER_RETRY_DAYS]),
        ]);
    }

    public function getReviewTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $reviewerRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, CodeMartV1Constants::ROLE_REVIEWER, CodeMartV1Constants::ROLE_STATUS_ACTIVE);

        if (!$reviewerRole) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_ROLE_REQUIRED, __('codemart.messages.only_active_reviewers_can_access_review_tasks'), null, 403);
        }

        [$page, $pageSize] = CodeMartV1Pagination::params($request);
        $result = CodeMartV1TaskSubmissionModel::pendingReviewPage((int) $user->id, $page, $pageSize);
        $total = (int) $result['total'];

        return $this->success([
            'pending_reviews' => $result['submissions']->items(),
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => (int) ceil($total / $pageSize),
            ],
        ]);
    }

    /**
     * Advisory reviewer review: dimensional scores plus an optional
     * recommendation shown to the client. It never changes the submission
     * or task state and never releases money; the client decides.
     */
    public function submitCodeReview(Request $request, $submissionId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $ratingRule = 'integer|min:' . CodeMartV1Constants::MIN_RATING . '|max:' . CodeMartV1Constants::MAX_RATING;
        $validator = Validator::make($request->all(), [
            'quality_rating' => 'required|' . $ratingRule,
            'readability_rating' => 'required|' . $ratingRule,
            'efficiency_rating' => 'required|' . $ratingRule,
            'security_rating' => 'nullable|' . $ratingRule,
            'comments' => 'required|string|min:' . CodeMartV1Constants::REVIEWER_COMMENT_MIN_LENGTH,
            'recommendation' => 'nullable|in:' . implode(',', CodeMartV1Constants::REVIEW_RECOMMENDATIONS),
            'line_comments' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $reviewerRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, CodeMartV1Constants::ROLE_REVIEWER, CodeMartV1Constants::ROLE_STATUS_ACTIVE);
        if (!$reviewerRole) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_ROLE_REQUIRED, __('codemart.messages.only_active_reviewers_can_submit_reviews'), null, 403);
        }

        $submission = CodeMartV1TaskSubmissionModel::findById((int) $submissionId);
        $task = $submission ? CodeMartV1TaskModel::findById((int) $submission->task_id) : null;
        if (!$submission || !$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_SUBMISSION_NOT_FOUND, __('codemart.messages.submission_not_found'), null, 404);
        }
        if (!$submission->isReviewable()) {
            return $this->codedError(CodeMartV1Constants::ERROR_SUBMISSION_INVALID_STATE, __('codemart.messages.the_submission_is_not_awaiting_review'), [
                'status' => $submission->status,
            ], 409);
        }

        $project = $task->resolveProject();
        if ((int) $submission->submitted_by === (int) $user->id || ($project && $project->isManagedBy((int) $user->id))) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEW_CONFLICT_OF_INTEREST, __('codemart.messages.you_cannot_review_your_own_work_or'), null, 403);
        }

        if (CodeMartV1CodeReviewModel::findForSubmissionReviewer((int) $submission->id, (int) $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEW_DUPLICATE, __('codemart.messages.you_have_already_reviewed_this_submission'), null, 409);
        }

        $ratings = [
            (int) $request->quality_rating,
            (int) $request->readability_rating,
            (int) $request->efficiency_rating,
            $request->security_rating !== null ? (int) $request->security_rating : null,
        ];
        $recommendation = $request->input('recommendation') ?: CodeMartV1CodeReviewModel::derivedRecommendation($ratings);
        $codeScore = CodeMartV1CodeReviewModel::codeScoreFromRatings($ratings);
        $presentRatings = array_values(array_filter($ratings, static fn ($value): bool => $value !== null));
        $meanRating = (int) round(array_sum($presentRatings) / count($presentRatings));

        $review = CodeMartV1ReviewerApplicationModel::runInTransaction(function () use ($submission, $task, $project, $user, $request, $meanRating, $recommendation, $codeScore) {
            $review = CodeMartV1CodeReviewModel::createRecord([
                'task_submission_id' => $submission->id,
                'reviewer_id' => $user->id,
                'review_kind' => CodeMartV1Constants::REVIEW_KIND_REVIEWER,
                'status' => $recommendation,
                'recommendation' => $recommendation,
                'review_notes' => $request->comments,
                'rating' => $meanRating,
                'quality_rating' => $request->quality_rating,
                'readability_rating' => $request->readability_rating,
                'efficiency_rating' => $request->efficiency_rating,
                'security_rating' => $request->security_rating,
                'code_score' => $codeScore,
                'comments' => $request->comments,
                'line_comments' => $request->line_comments,
            ]);

            CodeMartV1DeveloperStatsModel::recalculateForUser((int) $submission->submitted_by);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_SUBMISSION,
                (int) $submission->id,
                self::ACTION_REVIEWER_REVIEW_RECORDED,
                null,
                null,
                $project ? $project->managerIds() : [],
                CodeMartV1Constants::NOTIFICATION_TYPE_REVIEW,
                CodeMartV1Constants::NOTIFY_REVIEWER_REVIEW_RECORDED,
                CodeMartV1Constants::NOTIFY_REVIEWER_REVIEW_RECORDED_BODY,
                [
                    'task_id' => (int) $task->id,
                    'task_title' => (string) $task->title,
                    'project_id' => $project ? (int) $project->id : null,
                    'review_id' => (int) $review->id,
                    'recommendation' => $recommendation,
                    'code_score' => $codeScore,
                ]
            );

            return $review;
        });

        return $this->success([
            'review_id' => $review->id,
            'recommendation' => $recommendation,
            'code_score' => $codeScore,
            'message' => __('codemart.messages.review_submitted_successfully'),
        ]);
    }

    private function generateTestCases(): array
    {
        return [
            [
                'code_snippet_id' => 1,
                'code' => "function calculateTotal(items) {\n  let total = 0;\n  for (let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}",
                'expected_ratings' => ['quality' => 4, 'readability' => 4, 'efficiency' => 4],
            ],
            [
                'code_snippet_id' => 2,
                'code' => "function f(x) { var y = x * 2; var z = y + 10; return z; }",
                'expected_ratings' => ['quality' => 2, 'readability' => 2, 'efficiency' => 3],
            ],
            [
                'code_snippet_id' => 3,
                'code' => "const calculateDiscount = (price, percentage) => price * (1 - percentage / 100);",
                'expected_ratings' => ['quality' => 5, 'readability' => 5, 'efficiency' => 5],
            ],
        ];
    }

    private function calculateReviewSimilarity(array $testCases, array $userReviews): float
    {
        $totalSimilarity = 0;
        $count = 0;

        foreach ($testCases as $testCase) {
            $userReview = collect($userReviews)->firstWhere('code_snippet_id', $testCase['code_snippet_id']);

            if (!$userReview) continue;

            $expectedAvg = ($testCase['expected_ratings']['quality'] +
                           $testCase['expected_ratings']['readability'] +
                           $testCase['expected_ratings']['efficiency']) / 3;

            $userAvg = ($userReview['quality_rating'] +
                       $userReview['readability_rating'] +
                       $userReview['efficiency_rating']) / 3;

            $diff = abs($expectedAvg - $userAvg);
            $similarity = max(0, 100 - ($diff * 20));

            $totalSimilarity += $similarity;
            $count++;
        }

        return $count > 0 ? round($totalSimilarity / $count, 2) : 0;
    }
}
