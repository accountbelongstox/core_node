<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
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

        $existingRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, 'reviewer');

        if ($existingRole && $existingRole->role_status === 'active') {
            return $this->error('You are already a reviewer');
        }

        $recentApplication = CodeMartV1ReviewerApplicationModel::recentForUser((int) $user->id, 7);

        if ($recentApplication) {
            return $this->error('You can only apply once every 7 days');
        }

        $testCases = $this->generateTestCases();

        $application = CodeMartV1ReviewerApplicationModel::runInTransaction(function () use ($user, $testCases) {
            return CodeMartV1ReviewerApplicationModel::createRecord([
                'user_id' => $user->id,
                'status' => 'in_progress',
                'test_cases' => json_encode($testCases),
            ]);
        });

        return $this->success([
            'application_id' => $application->id,
            'test_cases' => $testCases,
            'instructions' => 'Please review and rate the following 3 code snippets on quality, readability, and efficiency. Each rating should be 1-5.',
        ]);
    }

    public function submitReviewerTest(Request $request, $applicationId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'reviews' => 'required|array|size:3',
            'reviews.*.code_snippet_id' => 'required|integer',
            'reviews.*.quality_rating' => 'required|integer|min:1|max:5',
            'reviews.*.readability_rating' => 'required|integer|min:1|max:5',
            'reviews.*.efficiency_rating' => 'required|integer|min:1|max:5',
            'reviews.*.comments' => 'required|string|min:20',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $application = CodeMartV1ReviewerApplicationModel::findOwnedInProgress(
            (int) $applicationId,
            (int) $user->id
        );

        if (!$application) {
            return $this->notFound('Application not found or already processed');
        }

        $testCases = json_decode($application->test_cases, true);
        $userReviews = $request->reviews;

        $similarity = $this->calculateReviewSimilarity($testCases, $userReviews);

        $application = CodeMartV1ReviewerApplicationModel::runInTransaction(function () use ($application, $userReviews, $similarity, $user) {
            $application->updateRecord([
                'status' => $similarity >= 85 ? 'passed' : 'failed',
                'user_reviews' => json_encode($userReviews),
                'similarity_score' => $similarity,
                'completed_at' => now(),
            ]);

            if ($similarity >= 85) {
                $existingRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, 'reviewer');

                if ($existingRole) {
                    $existingRole->updateRecord(['role_status' => 'active']);
                } else {
                    CodeMartV1UserRoleModel::createRecord([
                        'user_id' => $user->id,
                        'role_type' => 'reviewer',
                        'role_status' => 'active',
                    ]);
                }
            }

            return $application;
        });

        return $this->success([
            'status' => $application->status,
            'similarity_score' => $similarity,
            'message' => $similarity >= 85
                ? 'Congratulations! You passed the test and are now a reviewer.'
                : 'Test failed. You can retry in 7 days.',
        ]);
    }

    public function getReviewTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $reviewerRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, CodeMartV1Constants::ROLE_REVIEWER, CodeMartV1Constants::ROLE_STATUS_ACTIVE);

        if (!$reviewerRole) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_ROLE_REQUIRED, 'Only active reviewers can access review tasks', null, 403);
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = max(1, min(CodeMartV1Constants::MAX_PAGE_SIZE, (int) $request->get('pageSize', CodeMartV1Constants::DEFAULT_PAGE_SIZE)));
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
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $reviewerRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, CodeMartV1Constants::ROLE_REVIEWER, CodeMartV1Constants::ROLE_STATUS_ACTIVE);
        if (!$reviewerRole) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEWER_ROLE_REQUIRED, 'Only active reviewers can submit reviews', null, 403);
        }

        $submission = CodeMartV1TaskSubmissionModel::findById((int) $submissionId);
        $task = $submission ? CodeMartV1TaskModel::findById((int) $submission->task_id) : null;
        if (!$submission || !$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_SUBMISSION_NOT_FOUND, 'Submission not found', null, 404);
        }
        if (!$submission->isReviewable()) {
            return $this->codedError(CodeMartV1Constants::ERROR_SUBMISSION_INVALID_STATE, 'The submission is not awaiting review', [
                'status' => $submission->status,
            ], 409);
        }

        $project = $task->resolveProject();
        if ((int) $submission->submitted_by === (int) $user->id || ($project && $project->isManagedBy((int) $user->id))) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEW_CONFLICT_OF_INTEREST, 'You cannot review your own work or project', null, 403);
        }

        if (CodeMartV1CodeReviewModel::findForSubmissionReviewer((int) $submission->id, (int) $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_REVIEW_DUPLICATE, 'You have already reviewed this submission', null, 409);
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
            'message' => 'Review submitted successfully',
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
