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

use Illuminate\Support\Facades\Route;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1RegistrationCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1ProjectCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1TaskCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1PaymentCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1DepositCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1AIAnalysisCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1ArchitectCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1ReviewerCtl;
use App\Apps\CodeMartV1\CodeMartV1Ctl\CodeMartV1TaskMarketplaceCtl;

Route::prefix('api/codemart/v1')->name('codemart.')->group(function () {

    // Public routes - Registration
    Route::post('/auth/register', [CodeMartV1RegistrationCtl::class, 'register'])->name('register');
    Route::post('/auth/verify-email', [CodeMartV1RegistrationCtl::class, 'verifyEmail'])->name('verify-email');

    // Protected routes - Verification and KYC
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/request-phone-verification', [CodeMartV1RegistrationCtl::class, 'requestPhoneVerification'])->name('request-phone-verification');
        Route::post('/auth/verify-phone-otp', [CodeMartV1RegistrationCtl::class, 'verifyPhoneOtp'])->name('verify-phone-otp');
        Route::post('/auth/upload-kyc-documents', [CodeMartV1RegistrationCtl::class, 'uploadKycDocuments'])->name('upload-kyc-documents');
        Route::get('/auth/registration-status', [CodeMartV1RegistrationCtl::class, 'getRegistrationStatus'])->name('registration-status');

        // Project API routes
        Route::prefix('/projects')->name('projects.')->group(function () {
            Route::get('/', [CodeMartV1ProjectCtl::class, 'getProjects'])->name('index');
            Route::post('/', [CodeMartV1ProjectCtl::class, 'createProject'])->name('create');
            Route::get('/{projectId}', [CodeMartV1ProjectCtl::class, 'getProject'])->name('show');
            Route::put('/{projectId}', [CodeMartV1ProjectCtl::class, 'updateProject'])->name('update');
            Route::post('/{projectId}/publish', [CodeMartV1ProjectCtl::class, 'publishProject'])->name('publish');

            // Milestones
            Route::post('/{projectId}/milestones', [CodeMartV1ProjectCtl::class, 'createMilestone'])->name('create-milestone');

            // Attachments
            Route::post('/{projectId}/attachments', [CodeMartV1ProjectCtl::class, 'uploadProjectAttachment'])->name('upload-attachment');
        });

        // Task API routes
        Route::prefix('/tasks')->name('tasks.')->group(function () {
            Route::get('/', [CodeMartV1TaskCtl::class, 'getTasks'])->name('index');
            Route::post('/', [CodeMartV1TaskCtl::class, 'createTask'])->name('create');
            Route::get('/{taskId}', [CodeMartV1TaskCtl::class, 'getTask'])->name('show');
            Route::put('/{taskId}', [CodeMartV1TaskCtl::class, 'updateTask'])->name('update');
            Route::post('/{taskId}/submit', [CodeMartV1TaskCtl::class, 'submitTask'])->name('submit');
            Route::post('/{taskId}/comments', [CodeMartV1TaskCtl::class, 'addComment'])->name('add-comment');
        });

        // Task Submission Review routes
        Route::prefix('/submissions')->name('submissions.')->group(function () {
            Route::post('/{submissionId}/review', [CodeMartV1TaskCtl::class, 'reviewSubmission'])->name('review');
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
            Route::post('/', [CodeMartV1PaymentCtl::class, 'createInvoice'])->name('create');
        });

        Route::prefix('/refunds')->name('refunds.')->group(function () {
            Route::post('/request', [CodeMartV1PaymentCtl::class, 'requestRefund'])->name('request');
            Route::post('/{refundId}/approve', [CodeMartV1PaymentCtl::class, 'approveRefund'])->name('approve');
            Route::post('/{refundId}/process', [CodeMartV1PaymentCtl::class, 'processRefund'])->name('process');
        });

        Route::prefix('/deposits')->name('deposits.')->group(function () {
            Route::get('/info', [CodeMartV1DepositCtl::class, 'getDepositInfo'])->name('info');
            Route::post('/', [CodeMartV1DepositCtl::class, 'createDepositPayment'])->name('create');
            Route::get('/{depositId}/status', [CodeMartV1DepositCtl::class, 'getDepositStatus'])->name('status');
            Route::post('/{depositId}/confirm', [CodeMartV1DepositCtl::class, 'confirmDepositPayment'])->name('confirm');
            Route::get('/history', [CodeMartV1DepositCtl::class, 'getDepositHistory'])->name('history');
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
