<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ReviewerApplicationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskSubmissionModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1ReviewerCtl extends Controller
{
    use ApiResponse;

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

        CodeMartV1ReviewerApplicationModel::beginModelTransaction();

        $application = CodeMartV1ReviewerApplicationModel::createRecord([
            'user_id' => $user->id,
            'status' => 'in_progress',
            'test_cases' => json_encode($testCases),
        ]);

        CodeMartV1ReviewerApplicationModel::commitModelTransaction();

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

        CodeMartV1ReviewerApplicationModel::beginModelTransaction();

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

        CodeMartV1ReviewerApplicationModel::commitModelTransaction();

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

        $reviewerRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, 'reviewer', 'active');

        if (!$reviewerRole) {
            return $this->forbidden('Only active reviewers can access review tasks');
        }

        $pendingReviews = CodeMartV1TaskSubmissionModel::pendingReviewRows($user->id);

        return $this->success(['pending_reviews' => $pendingReviews]);
    }

    public function submitCodeReview(Request $request, $submissionId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'quality_rating' => 'required|integer|min:1|max:5',
            'readability_rating' => 'required|integer|min:1|max:5',
            'efficiency_rating' => 'required|integer|min:1|max:5',
            'comments' => 'required|string|min:20',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $reviewerRole = CodeMartV1UserRoleModel::forUserAndType((int) $user->id, 'reviewer', 'active');

        if (!$reviewerRole) {
            return $this->forbidden('Only active reviewers can submit reviews');
        }

        $existingReview = CodeMartV1CodeReviewModel::findForSubmissionReviewer(
            (int) $submissionId,
            (int) $user->id
        );

        if ($existingReview) {
            return $this->error('You have already reviewed this submission');
        }

        CodeMartV1ReviewerApplicationModel::beginModelTransaction();

        $review = CodeMartV1CodeReviewModel::createRecord([
            'submission_id' => $submissionId,
            'reviewer_id' => $user->id,
            'quality_rating' => $request->quality_rating,
            'readability_rating' => $request->readability_rating,
            'efficiency_rating' => $request->efficiency_rating,
            'comments' => $request->comments,
        ]);

        CodeMartV1ReviewerApplicationModel::commitModelTransaction();

        return $this->success([
            'review_id' => $review->id,
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
