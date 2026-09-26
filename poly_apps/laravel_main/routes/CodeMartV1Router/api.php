<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;
use App\Apps\CodeMartV1\CodeMartV1Controllers\CodeMartV1AdminCtl;
use App\Apps\CodeMartV1\CodeMartV1Controllers\CodeMartV1AdminFinanceCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1FundingCtl;
use App\Apps\CodeMartV1\CodeMartV1Controllers\CodeMartV1BootstrapCtl;
use App\Apps\CodeMartV1\CodeMartV1Controllers\CodeMartV1NotificationCtl;
use App\Apps\CodeMartV1\CodeMartV1Controllers\CodeMartV1ProfileCtl;
use App\Apps\CodeMartV1\CodeMartV1Controllers\CodeMartV1TestimonialCtl;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1RegistrationCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1ProjectCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1TaskCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1PaymentCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1DepositCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1AIAnalysisCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1ArchitectCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1ReviewerCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1TaskMarketplaceCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1PublicHomeCtl;

// NOTE: this file is required from routes/api.php, which already applies the
// /api prefix; the group prefix below must stay 'codemart/v1' so the public
// base is /api/codemart/v1 (not /api/api/...).
Route::prefix('codemart/v1')->name('codemart.')->group(function () {

    // Public, no bearer token (rate limited).
    Route::middleware(CodeMartV1Constants::THROTTLE_PUBLIC)->group(function () {
        Route::get('/public/home', [CodeMartV1PublicHomeCtl::class, 'getHome'])->name('public.home');
        Route::post('/public/estimate', [CodeMartV1PublicHomeCtl::class, 'estimate'])->name('public.estimate');
        Route::get('/public/estimate-options', [CodeMartV1PublicHomeCtl::class, 'estimateOptions'])->name('public.estimate-options');
        Route::get('/public/showcase', [CodeMartV1PublicHomeCtl::class, 'showcase'])->name('public.showcase');
    });
    Route::post('/public/contact', [CodeMartV1PublicHomeCtl::class, 'contact'])
        ->middleware(CodeMartV1Constants::THROTTLE_CONTACT)
        ->name('public.contact');

    // Public routes - Registration (rate limited)
    Route::middleware(CodeMartV1Constants::THROTTLE_REGISTER)->group(function () {
        Route::post('/auth/register', [CodeMartV1RegistrationCtl::class, 'register'])->name('register');
        Route::post('/auth/verify-email', [CodeMartV1RegistrationCtl::class, 'verifyEmail'])->name('verify-email');
    });

    // Protected routes - Verification and KYC
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/bootstrap', [CodeMartV1BootstrapCtl::class, 'bootstrap'])->name('bootstrap');

        Route::post('/auth/request-phone-verification', [CodeMartV1RegistrationCtl::class, 'requestPhoneVerification'])->name('request-phone-verification');
        Route::post('/auth/verify-phone-otp', [CodeMartV1RegistrationCtl::class, 'verifyPhoneOtp'])->name('verify-phone-otp');
        Route::post('/auth/upload-kyc-documents', [CodeMartV1RegistrationCtl::class, 'uploadKycDocuments'])->name('upload-kyc-documents');
        Route::get('/auth/registration-status', [CodeMartV1RegistrationCtl::class, 'getRegistrationStatus'])->name('registration-status');

        // Profile
        Route::get('/profile', [CodeMartV1ProfileCtl::class, 'show'])->name('profile.show');
        Route::put('/profile', [CodeMartV1ProfileCtl::class, 'update'])->name('profile.update');
        Route::post('/roles/request', [CodeMartV1ProfileCtl::class, 'requestRole'])->name('roles.request');

        // Testimonials (clients with a completed project; moderated)
        Route::post('/testimonials', [CodeMartV1TestimonialCtl::class, 'store'])->name('testimonials.store');

        // Notifications
        Route::prefix('/notifications')->name('notifications.')->group(function () {
            Route::get('/', [CodeMartV1NotificationCtl::class, 'index'])->name('index');
            Route::get('/unread-count', [CodeMartV1NotificationCtl::class, 'unreadCount'])->name('unread-count');
            Route::post('/read-all', [CodeMartV1NotificationCtl::class, 'markAllRead'])->name('read-all');
            Route::post('/{notificationId}/read', [CodeMartV1NotificationCtl::class, 'markRead'])->name('read');
        });

        // Platform administration (global Laravel admin authorization).
        Route::prefix('/admin')->name('admin.')->group(function () {
            Route::get('/overview', [CodeMartV1AdminCtl::class, 'overview'])->name('overview');
            Route::get('/users', [CodeMartV1AdminCtl::class, 'users'])->name('users');
            Route::get('/users/{userId}', [CodeMartV1AdminCtl::class, 'userDetail'])->whereNumber('userId')->name('user-detail');
            Route::post('/users/{userId}/roles', [CodeMartV1AdminCtl::class, 'grantRole'])->whereNumber('userId')->name('grant-role');
            Route::post('/users/{userId}/roles/{roleType}/status', [CodeMartV1AdminCtl::class, 'setRoleStatus'])->name('set-role-status');
            Route::get('/kyc', [CodeMartV1AdminCtl::class, 'kycList'])->name('kyc');
            Route::post('/kyc/{kycId}/approve', [CodeMartV1AdminCtl::class, 'kycApprove'])->name('kyc-approve');
            Route::post('/kyc/{kycId}/reject', [CodeMartV1AdminCtl::class, 'kycReject'])->name('kyc-reject');
            Route::get('/kyc/{kycId}/files/{type}', [CodeMartV1AdminCtl::class, 'kycFile'])
                ->whereNumber('kycId')
                ->whereIn('type', array_keys(CodeMartV1Constants::KYC_FILE_COLUMNS))
                ->name('kyc-file');
            Route::post('/projects/{projectId}/status', [CodeMartV1AdminCtl::class, 'setProjectStatus'])->whereNumber('projectId')->name('project-status');
            Route::get('/testimonials', [CodeMartV1AdminCtl::class, 'testimonials'])->name('testimonials');
            Route::post('/testimonials/{testimonialId}/approve', [CodeMartV1AdminCtl::class, 'approveTestimonial'])->name('testimonial-approve');
            Route::post('/testimonials/{testimonialId}/hide', [CodeMartV1AdminCtl::class, 'hideTestimonial'])->name('testimonial-hide');
            Route::put('/testimonials/{testimonialId}', [CodeMartV1AdminCtl::class, 'updateTestimonial'])->name('testimonial-update');
            Route::get('/reviewer-applications', [CodeMartV1AdminCtl::class, 'reviewerApplications'])->name('reviewer-applications');
            Route::post('/reviewer-applications/{applicationId}/revoke', [CodeMartV1AdminCtl::class, 'revokeReviewer'])->name('reviewer-revoke');
            Route::get('/policy', [CodeMartV1AdminCtl::class, 'policy'])->name('policy');
            Route::get('/activity', [CodeMartV1AdminCtl::class, 'activity'])->name('activity');
            Route::get('/contact-messages', [CodeMartV1AdminCtl::class, 'contactMessages'])->name('contact-messages');
            Route::post('/contact-messages/{messageId}/handle', [CodeMartV1AdminCtl::class, 'handleContactMessage'])->name('contact-message-handle');
            Route::get('/refunds', [CodeMartV1AdminCtl::class, 'refunds'])->name('refunds');
            Route::get('/deposits', [CodeMartV1AdminCtl::class, 'deposits'])->name('deposits');
            Route::post('/deposits/{depositId}/confirm', [CodeMartV1AdminCtl::class, 'confirmDeposit'])->name('confirm-deposit');
            // Finance administration (S1): refunds, deposits, withdrawals, payments, escrows, disputes.
            Route::post('/refunds/{refundId}/approve', [CodeMartV1AdminFinanceCtl::class, 'approveRefund'])->name('refund-approve');
            Route::post('/refunds/{refundId}/reject', [CodeMartV1AdminFinanceCtl::class, 'rejectRefund'])->name('refund-reject');
            Route::post('/refunds/{refundId}/process', [CodeMartV1AdminFinanceCtl::class, 'processRefund'])->name('refund-process');
            Route::post('/deposits/{depositId}/reject', [CodeMartV1AdminFinanceCtl::class, 'rejectDeposit'])->name('deposit-reject');
            Route::post('/deposits/{depositId}/refund', [CodeMartV1AdminFinanceCtl::class, 'refundDeposit'])->name('deposit-refund');
            Route::get('/withdrawals', [CodeMartV1AdminFinanceCtl::class, 'withdrawals'])->name('withdrawals');
            Route::post('/withdrawals/{withdrawalId}/approve', [CodeMartV1AdminFinanceCtl::class, 'approveWithdrawal'])->name('withdrawal-approve');
            Route::post('/withdrawals/{withdrawalId}/reject', [CodeMartV1AdminFinanceCtl::class, 'rejectWithdrawal'])->name('withdrawal-reject');
            Route::post('/withdrawals/{withdrawalId}/pay', [CodeMartV1AdminFinanceCtl::class, 'payWithdrawal'])->name('withdrawal-pay');
            Route::get('/payments', [CodeMartV1AdminFinanceCtl::class, 'payments'])->name('payments');
            Route::post('/payments/{paymentId}/resolve-dispute', [CodeMartV1AdminFinanceCtl::class, 'resolveDispute'])->name('payment-resolve-dispute');
            Route::get('/escrows', [CodeMartV1AdminFinanceCtl::class, 'escrows'])->name('escrows');
            Route::get('/projects', [CodeMartV1AdminCtl::class, 'projects'])->name('projects');
        });

        // Project API routes
        Route::prefix('/projects')->name('projects.')->group(function () {
            Route::get('/', [CodeMartV1ProjectCtl::class, 'getProjects'])->name('index');
            Route::post('/', [CodeMartV1ProjectCtl::class, 'createProject'])->name('create');
            Route::get('/{projectId}', [CodeMartV1ProjectCtl::class, 'getProject'])->name('show');
            Route::put('/{projectId}', [CodeMartV1ProjectCtl::class, 'updateProject'])->name('update');
            Route::post('/{projectId}/publish', [CodeMartV1ProjectCtl::class, 'publishProject'])->name('publish');
            Route::post('/{projectId}/transition', [CodeMartV1ProjectCtl::class, 'transitionProject'])->name('transition');
            Route::get('/{projectId}/analysis', [CodeMartV1AIAnalysisCtl::class, 'getProjectAnalysis'])->name('analysis');
            Route::post('/{projectId}/fund', [CodeMartV1FundingCtl::class, 'fundProject'])->name('fund');

            // Milestones
            Route::post('/{projectId}/milestones', [CodeMartV1ProjectCtl::class, 'createMilestone'])->name('create-milestone');

            // Attachments
            Route::post('/{projectId}/attachments', [CodeMartV1ProjectCtl::class, 'uploadProjectAttachment'])->name('upload-attachment');
            Route::get('/{projectId}/attachments', [CodeMartV1ProjectCtl::class, 'getProjectAttachments'])->name('attachments');
            Route::get('/{projectId}/attachments/{attachmentId}/download', [CodeMartV1ProjectCtl::class, 'downloadProjectAttachment'])->name('download-attachment');
        });

        // Milestone API routes
        Route::prefix('/milestones')->name('milestones.')->group(function () {
            Route::put('/{milestoneId}', [CodeMartV1ProjectCtl::class, 'updateMilestone'])->name('update');
            Route::post('/{milestoneId}/complete', [CodeMartV1ProjectCtl::class, 'completeMilestone'])->name('complete');
        });

        // Task API routes
        Route::prefix('/tasks')->name('tasks.')->group(function () {
            Route::get('/', [CodeMartV1TaskCtl::class, 'getTasks'])->name('index');
            Route::post('/', [CodeMartV1TaskCtl::class, 'createTask'])->name('create');
            Route::get('/{taskId}', [CodeMartV1TaskCtl::class, 'getTask'])->name('show');
            Route::put('/{taskId}', [CodeMartV1TaskCtl::class, 'updateTask'])->name('update');
            Route::post('/{taskId}/submit', [CodeMartV1TaskCtl::class, 'submitTask'])->name('submit');
            Route::post('/{taskId}/comments', [CodeMartV1TaskCtl::class, 'addComment'])->name('add-comment');
            Route::post('/{taskId}/transition', [CodeMartV1TaskCtl::class, 'transitionTask'])->name('transition');
            Route::get('/{taskId}/submissions', [CodeMartV1TaskCtl::class, 'getTaskSubmissions'])->name('submissions');
        });

        // Task Submission Review routes
        Route::prefix('/submissions')->name('submissions.')->group(function () {
            Route::post('/{submissionId}/review', [CodeMartV1TaskCtl::class, 'reviewSubmission'])->name('review');
            Route::get('/{submissionId}/files/{fileIndex}/download', [CodeMartV1TaskCtl::class, 'downloadSubmissionFile'])->name('download-file');
        });

        // Payment API routes
        Route::prefix('/wallet')->name('wallet.')->group(function () {
            Route::get('/', [CodeMartV1PaymentCtl::class, 'getWallet'])->name('index');
            Route::get('/transactions', [CodeMartV1PaymentCtl::class, 'getWalletTransactions'])->name('transactions');
        });

        Route::prefix('/payments')->name('payments.')->group(function () {
            Route::get('/', [CodeMartV1PaymentCtl::class, 'getPayments'])->name('index');
            Route::post('/', [CodeMartV1PaymentCtl::class, 'createPayment'])->name('create');
            Route::get('/{paymentId}', [CodeMartV1PaymentCtl::class, 'getPayment'])->name('show');
        });

        Route::prefix('/invoices')->name('invoices.')->group(function () {
            Route::get('/', [CodeMartV1PaymentCtl::class, 'getInvoices'])->name('index');
            Route::post('/', [CodeMartV1PaymentCtl::class, 'createInvoice'])->name('create');
        });

        Route::prefix('/refunds')->name('refunds.')->group(function () {
            Route::get('/', [CodeMartV1PaymentCtl::class, 'getRefunds'])->name('index');
            Route::post('/request', [CodeMartV1PaymentCtl::class, 'requestRefund'])->name('request');
        });

        Route::prefix('/withdrawals')->name('withdrawals.')->group(function () {
            Route::get('/', [CodeMartV1PaymentCtl::class, 'getWithdrawals'])->name('index');
            Route::post('/', [CodeMartV1PaymentCtl::class, 'requestWithdrawal'])->name('create');
        });

        Route::prefix('/deposits')->name('deposits.')->group(function () {
            Route::get('/info', [CodeMartV1DepositCtl::class, 'getDepositInfo'])->name('info');
            Route::post('/', [CodeMartV1DepositCtl::class, 'createDepositPayment'])->name('create');
            Route::get('/history', [CodeMartV1DepositCtl::class, 'getDepositHistory'])->name('history');
            Route::get('/{depositId}/status', [CodeMartV1DepositCtl::class, 'getDepositStatus'])->name('status');
            Route::get('/{depositId}/bank-info', [CodeMartV1DepositCtl::class, 'getBankInfo'])->name('bank-info');
        });

        Route::prefix('/ai-analysis')->name('ai-analysis.')->group(function () {
            Route::post('/projects/{projectId}/analyze', [CodeMartV1AIAnalysisCtl::class, 'analyzeProject'])->name('analyze');
            Route::get('/{analysisId}', [CodeMartV1AIAnalysisCtl::class, 'getAnalysisResult'])->name('result');
            Route::post('/{analysisId}/accept', [CodeMartV1AIAnalysisCtl::class, 'acceptProposal'])->name('accept');
            Route::post('/{analysisId}/revision', [CodeMartV1AIAnalysisCtl::class, 'requestRevision'])->name('revision');
        });

        Route::prefix('/architect')->name('architect.')->group(function () {
            Route::get('/eligibility', [CodeMartV1ArchitectCtl::class, 'checkPromotionEligibility'])->name('eligibility');
            Route::post('/apply', [CodeMartV1ArchitectCtl::class, 'applyForArchitect'])->name('apply');
            Route::get('/tasks', [CodeMartV1ArchitectCtl::class, 'getArchitectTasks'])->name('tasks');
            Route::post('/tasks/{projectId}/accept', [CodeMartV1ArchitectCtl::class, 'acceptArchitectTask'])->name('accept-task');
            Route::post('/deposit/complete', [CodeMartV1ArchitectCtl::class, 'completeArchitectDeposit'])->name('complete-deposit');
        });

        Route::prefix('/reviewer')->name('reviewer.')->group(function () {
            Route::post('/apply', [CodeMartV1ReviewerCtl::class, 'startReviewerApplication'])->name('apply');
            Route::post('/application/{applicationId}/submit', [CodeMartV1ReviewerCtl::class, 'submitReviewerTest'])->name('submit-test');
            Route::get('/tasks', [CodeMartV1ReviewerCtl::class, 'getReviewTasks'])->name('tasks');
            Route::post('/reviews/{submissionId}', [CodeMartV1ReviewerCtl::class, 'submitCodeReview'])->name('submit-review');
        });

        Route::prefix('/marketplace')->name('marketplace.')->group(function () {
            Route::get('/tasks', [CodeMartV1TaskMarketplaceCtl::class, 'browseTasks'])->name('browse');
            Route::post('/tasks/{taskId}/accept', [CodeMartV1TaskMarketplaceCtl::class, 'acceptTask'])->name('accept');
            Route::get('/my-tasks', [CodeMartV1TaskMarketplaceCtl::class, 'getMyTasks'])->name('my-tasks');
        });
    });
});
