<?php

namespace App\Apps\CodeMartV1\CodeMartV1ApiInfo;

class CodeMartV1ApiInfo
{
    public static function getSupportedHeaders(): array
    {
        return [
            'Authorization' => 'Bearer token for Sanctum authentication',
            'X-App-Namespace' => 'Application namespace identifier (codemart)',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }

    public static function getApis(): array
    {
        return [
            'public.home' => [
                'path' => '/api/codemart/v1/public/home',
                'method' => 'GET',
                'authentication' => false,
                'parameters' => [],
                'response' => __('codemart.api.public_home.response'),
                'feature' => __('codemart.api.public_home.feature'),
            ],

            // Registration APIs
            'auth.register' => [
                'path' => '/api/codemart/v1/auth/register',
                'method' => 'POST',
                'authentication' => false,
                'parameters' => [
                    'email' => 'string|required|email|unique:users',
                    'password' => 'string|required|min:8',
                    'name' => 'string|required',
                    'user_type' => 'string|required|in:developer,client',
                    'phone' => 'string|nullable',
                ],
                'response' => 'User object with authentication token',
                'feature' => 'User Registration',
            ],
            'auth.verify-email' => [
                'path' => '/api/codemart/v1/auth/verify-email',
                'method' => 'POST',
                'authentication' => false,
                'parameters' => [
                    'email' => 'string|required|email',
                    'code' => 'string|required|size:6',
                ],
                'response' => 'Verification result',
                'feature' => 'Email Verification',
            ],
            'auth.request-phone-verification' => [
                'path' => '/api/codemart/v1/auth/request-phone-verification',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'phone' => 'string|required|regex:/^1[3-9]\d{9}$/',
                ],
                'response' => 'OTP sent confirmation',
                'feature' => 'Phone Verification',
            ],
            'auth.verify-phone-otp' => [
                'path' => '/api/codemart/v1/auth/verify-phone-otp',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'phone' => 'string|required',
                    'otp' => 'string|required|size:6',
                ],
                'response' => 'Phone verification status',
                'feature' => 'Phone OTP Verification',
            ],
            'auth.upload-kyc-documents' => [
                'path' => '/api/codemart/v1/auth/upload-kyc-documents',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'id_front' => 'file|required|mimes:jpg,png,pdf|max:5120',
                    'id_back' => 'file|required|mimes:jpg,png,pdf|max:5120',
                    'id_type' => 'string|required|in:passport,national_id,driver_license',
                    'id_number' => 'string|required',
                    'full_name' => 'string|required',
                    'date_of_birth' => 'date|required',
                ],
                'response' => 'KYC submission confirmation',
                'feature' => 'KYC Document Upload',
            ],
            'auth.registration-status' => [
                'path' => '/api/codemart/v1/auth/registration-status',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'User registration status',
                'feature' => 'Registration Status',
            ],

            // Project APIs
            'projects.index' => [
                'path' => '/api/codemart/v1/projects',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'page' => 'integer|default:1',
                    'pageSize' => 'integer|default:20',
                    'status' => 'string|in:draft,open,in_progress,paused,completed,cancelled,archived',
                    'complexity' => 'string|in:simple,medium,complex,very_complex',
                    'search' => 'string|nullable',
                ],
                'response' => 'Paginated projects list',
                'feature' => 'List Projects',
            ],
            'projects.create' => [
                'path' => '/api/codemart/v1/projects',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'title' => 'string|required|max:255',
                    'description' => 'string|required',
                    'complexity' => 'string|required|in:simple,medium,complex,very_complex',
                    'budget' => 'numeric|required|min:100',
                    'budget_type' => 'string|required|in:fixed,hourly',
                    'currency' => 'string|required|size:3',
                    'start_date' => 'date|nullable',
                    'end_date' => 'date|nullable|after:start_date',
                    'skills' => 'array|nullable',
                    'languages' => 'array|nullable',
                    'frameworks' => 'array|nullable',
                    'databases' => 'array|nullable',
                ],
                'response' => 'Created project object',
                'feature' => 'Create Project',
            ],
            'projects.show' => [
                'path' => '/api/codemart/v1/projects/{projectId}',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                ],
                'response' => 'Project object with details',
                'feature' => 'Get Project Details',
            ],
            'projects.update' => [
                'path' => '/api/codemart/v1/projects/{projectId}',
                'method' => 'PUT',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                    'title' => 'string|sometimes',
                    'description' => 'string|sometimes',
                    'status' => 'string|sometimes|in:draft,open,in_progress,paused,completed,cancelled,archived',
                    'complexity' => 'string|sometimes|in:simple,medium,complex,very_complex',
                    'budget' => 'numeric|sometimes|min:100',
                ],
                'response' => 'Updated project object',
                'feature' => 'Update Project',
            ],
            'projects.publish' => [
                'path' => '/api/codemart/v1/projects/{projectId}/publish',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                ],
                'response' => 'Published project object',
                'feature' => 'Publish Project',
            ],
            'projects.create-milestone' => [
                'path' => '/api/codemart/v1/projects/{projectId}/milestones',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                    'title' => 'string|required|max:255',
                    'description' => 'string|nullable',
                    'due_date' => 'date|required|after:today',
                    'budget' => 'numeric|required|min:0',
                    'deliverables' => 'array|nullable',
                ],
                'response' => 'Created milestone object',
                'feature' => 'Create Milestone',
            ],
            'projects.upload-attachment' => [
                'path' => '/api/codemart/v1/projects/{projectId}/attachments',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                    'file' => 'file|required|max:10240',
                ],
                'response' => 'Attachment object',
                'feature' => 'Upload Attachment',
            ],

            // Task APIs
            'tasks.index' => [
                'path' => '/api/codemart/v1/tasks',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'page' => 'integer|default:1',
                    'pageSize' => 'integer|default:20',
                    'milestone_id' => 'integer|nullable',
                    'status' => 'string|in:pending,in_progress,review,completed,blocked',
                    'priority' => 'string|in:low,medium,high,urgent',
                    'assigned_to' => 'integer|nullable',
                    'search' => 'string|nullable',
                ],
                'response' => 'Paginated tasks list',
                'feature' => 'List Tasks',
            ],
            'tasks.create' => [
                'path' => '/api/codemart/v1/tasks',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'milestone_id' => 'integer|required|exists:codemart_v1_milestones',
                    'title' => 'string|required|max:255',
                    'description' => 'string|required',
                    'priority' => 'string|required|in:low,medium,high,urgent',
                    'assigned_to' => 'integer|nullable|exists:users',
                    'due_date' => 'date|nullable|after:today',
                    'deliverables' => 'array|nullable',
                    'budget_allocation' => 'numeric|nullable|min:0',
                ],
                'response' => 'Created task object',
                'feature' => 'Create Task',
            ],
            'tasks.show' => [
                'path' => '/api/codemart/v1/tasks/{taskId}',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'taskId' => 'integer|required',
                ],
                'response' => 'Task object with details',
                'feature' => 'Get Task Details',
            ],
            'tasks.update' => [
                'path' => '/api/codemart/v1/tasks/{taskId}',
                'method' => 'PUT',
                'authentication' => true,
                'parameters' => [
                    'taskId' => 'integer|required',
                    'title' => 'string|sometimes',
                    'description' => 'string|sometimes',
                    'status' => 'string|sometimes|in:pending,in_progress,review,completed,blocked',
                    'priority' => 'string|sometimes|in:low,medium,high,urgent',
                    'assigned_to' => 'integer|sometimes|nullable|exists:users',
                    'due_date' => 'date|sometimes|nullable',
                    'deliverables' => 'array|sometimes|nullable',
                    'budget_allocation' => 'numeric|sometimes|nullable|min:0',
                ],
                'response' => 'Updated task object',
                'feature' => 'Update Task',
            ],
            'tasks.submit' => [
                'path' => '/api/codemart/v1/tasks/{taskId}/submit',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'taskId' => 'integer|required',
                    'submission_note' => 'string|nullable',
                    'files' => 'array|nullable',
                ],
                'response' => 'Task submission object',
                'feature' => 'Submit Task',
            ],
            'tasks.add-comment' => [
                'path' => '/api/codemart/v1/tasks/{taskId}/comments',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'taskId' => 'integer|required',
                    'comment' => 'string|required',
                    'mentions' => 'array|nullable',
                ],
                'response' => 'Comment object',
                'feature' => 'Add Comment',
            ],
            'submissions.review' => [
                'path' => '/api/codemart/v1/submissions/{submissionId}/review',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'submissionId' => 'integer|required',
                    'status' => 'string|required|in:approved,needs_revision,rejected',
                    'review_notes' => 'string|required',
                    'rating' => 'integer|nullable|min:1|max:5',
                    'line_comments' => 'array|nullable',
                ],
                'response' => 'Code review object',
                'feature' => 'Review Submission',
            ],

            // Payment APIs
            'wallet.index' => [
                'path' => '/api/codemart/v1/wallet',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Wallet object',
                'feature' => 'Get Wallet',
            ],
            'wallet.transactions' => [
                'path' => '/api/codemart/v1/wallet/transactions',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'page' => 'integer|default:1',
                    'pageSize' => 'integer|default:20',
                ],
                'response' => 'Paginated wallet transactions',
                'feature' => 'Get Wallet Transactions',
            ],
            'payments.index' => [
                'path' => '/api/codemart/v1/payments',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'page' => 'integer|default:1',
                    'pageSize' => 'integer|default:20',
                    'status' => 'string|in:pending,completed,failed,cancelled,disputed',
                    'type' => 'string|in:milestone,hourly,refund,bonus',
                ],
                'response' => 'Paginated payments list',
                'feature' => 'List Payments',
            ],
            'payments.create' => [
                'path' => '/api/codemart/v1/payments',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'payee_id' => 'integer|required|exists:users',
                    'project_id' => 'integer|nullable|exists:codemart_v1_projects',
                    'milestone_id' => 'integer|nullable|exists:codemart_v1_milestones',
                    'amount' => 'numeric|required|min:0.01',
                    'type' => 'string|required|in:milestone,hourly,refund,bonus',
                    'payment_method' => 'string|required|in:wallet,credit_card,bank_transfer,alipay,wechat',
                    'description' => 'string|nullable',
                ],
                'response' => 'Created payment object',
                'feature' => 'Create Payment',
            ],
            'payments.show' => [
                'path' => '/api/codemart/v1/payments/{paymentId}',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'paymentId' => 'integer|required',
                ],
                'response' => 'Payment object with details',
                'feature' => 'Get Payment Details',
            ],
            'invoices.create' => [
                'path' => '/api/codemart/v1/invoices',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'payment_id' => 'integer|required|exists:codemart_v1_payments',
                    'description' => 'string|nullable',
                    'line_items' => 'array|nullable',
                    'tax' => 'numeric|nullable|min:0',
                ],
                'response' => 'Created invoice object',
                'feature' => 'Create Invoice',
            ],
            'refunds.request' => [
                'path' => '/api/codemart/v1/refunds/request',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'payment_id' => 'integer|required|exists:codemart_v1_payments',
                    'reason' => 'string|required',
                    'notes' => 'string|nullable',
                ],
                'response' => 'Created refund request object',
                'feature' => 'Request Refund',
            ],
            'refunds.approve' => [
                'path' => '/api/codemart/v1/refunds/{refundId}/approve',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'refundId' => 'integer|required',
                ],
                'response' => 'Approved refund object',
                'feature' => 'Approve Refund (Admin Only)',
            ],
            'refunds.process' => [
                'path' => '/api/codemart/v1/refunds/{refundId}/process',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'refundId' => 'integer|required',
                ],
                'response' => 'Processed refund object',
                'feature' => 'Process Refund (Admin Only)',
            ],

            'deposits.info' => [
                'path' => '/api/codemart/v1/deposits/info',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Deposit requirements and current status',
                'feature' => 'Get Deposit Info',
            ],
            'deposits.create' => [
                'path' => '/api/codemart/v1/deposits',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'amount' => 'numeric|required|min:100',
                    'payment_method' => 'string|required|in:alipay,wechat,bank_transfer',
                ],
                'response' => 'Deposit payment object with payment URL',
                'feature' => 'Create Deposit Payment',
            ],
            'deposits.status' => [
                'path' => '/api/codemart/v1/deposits/{depositId}/status',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'depositId' => 'integer|required',
                ],
                'response' => 'Deposit status',
                'feature' => 'Get Deposit Status',
            ],
            'deposits.confirm' => [
                'path' => '/api/codemart/v1/deposits/{depositId}/confirm',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'depositId' => 'integer|required',
                ],
                'response' => 'Confirmed deposit and updated role status',
                'feature' => 'Confirm Deposit Payment',
            ],
            'deposits.history' => [
                'path' => '/api/codemart/v1/deposits/history',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Deposit history list',
                'feature' => 'Get Deposit History',
            ],

            'ai-analysis.analyze' => [
                'path' => '/api/codemart/v1/ai-analysis/projects/{projectId}/analyze',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                ],
                'response' => 'AI analysis job started',
                'feature' => 'Start AI Project Analysis',
            ],
            'ai-analysis.result' => [
                'path' => '/api/codemart/v1/ai-analysis/{analysisId}',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'analysisId' => 'integer|required',
                ],
                'response' => 'AI analysis results with recommendations',
                'feature' => 'Get Analysis Result',
            ],
            'ai-analysis.accept' => [
                'path' => '/api/codemart/v1/ai-analysis/{analysisId}/accept',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'analysisId' => 'integer|required',
                ],
                'response' => 'Proposal accepted message',
                'feature' => 'Accept AI Proposal',
            ],
            'ai-analysis.revision' => [
                'path' => '/api/codemart/v1/ai-analysis/{analysisId}/revision',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'analysisId' => 'integer|required',
                    'revision_notes' => 'string|required|max:1000',
                ],
                'response' => 'Revision requested confirmation',
                'feature' => 'Request Analysis Revision',
            ],

            'architect.eligibility' => [
                'path' => '/api/codemart/v1/architect/eligibility',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Eligibility status and requirements',
                'feature' => 'Check Architect Promotion Eligibility',
            ],
            'architect.apply' => [
                'path' => '/api/codemart/v1/architect/apply',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Application submitted confirmation',
                'feature' => 'Apply for Architect Role',
            ],
            'architect.tasks' => [
                'path' => '/api/codemart/v1/architect/tasks',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Assigned and available projects',
                'feature' => 'Get Architect Tasks',
            ],
            'architect.accept-task' => [
                'path' => '/api/codemart/v1/architect/tasks/{projectId}/accept',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'projectId' => 'integer|required',
                ],
                'response' => 'Project accepted confirmation',
                'feature' => 'Accept Architect Task',
            ],
            'architect.complete-deposit' => [
                'path' => '/api/codemart/v1/architect/deposit/complete',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Architect promotion completed',
                'feature' => 'Complete Architect Deposit',
            ],

            'reviewer.apply' => [
                'path' => '/api/codemart/v1/reviewer/apply',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Test cases for reviewer qualification',
                'feature' => 'Start Reviewer Application',
            ],
            'reviewer.submit-test' => [
                'path' => '/api/codemart/v1/reviewer/application/{applicationId}/submit',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'applicationId' => 'integer|required',
                    'reviews' => 'array|required|size:3',
                    'reviews.*.code_snippet_id' => 'integer|required',
                    'reviews.*.quality_rating' => 'integer|required|min:1|max:5',
                    'reviews.*.readability_rating' => 'integer|required|min:1|max:5',
                    'reviews.*.efficiency_rating' => 'integer|required|min:1|max:5',
                    'reviews.*.comments' => 'string|required|min:20',
                ],
                'response' => 'Test results with pass/fail status',
                'feature' => 'Submit Reviewer Test',
            ],
            'reviewer.tasks' => [
                'path' => '/api/codemart/v1/reviewer/tasks',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'Pending code review tasks',
                'feature' => 'Get Review Tasks',
            ],
            'reviewer.submit-review' => [
                'path' => '/api/codemart/v1/reviewer/reviews/{submissionId}',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'submissionId' => 'integer|required',
                    'quality_rating' => 'integer|required|min:1|max:5',
                    'readability_rating' => 'integer|required|min:1|max:5',
                    'efficiency_rating' => 'integer|required|min:1|max:5',
                    'comments' => 'string|required|min:20',
                ],
                'response' => 'Review submitted confirmation',
                'feature' => 'Submit Code Review',
            ],

            'marketplace.browse' => [
                'path' => '/api/codemart/v1/marketplace/tasks',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [
                    'page' => 'integer|default:1',
                    'pageSize' => 'integer|default:20',
                    'skills' => 'array|nullable',
                    'min_budget' => 'numeric|default:0',
                    'max_budget' => 'numeric|default:999999',
                ],
                'response' => 'Paginated available tasks',
                'feature' => 'Browse Task Marketplace',
            ],
            'marketplace.accept' => [
                'path' => '/api/codemart/v1/marketplace/tasks/{taskId}/accept',
                'method' => 'POST',
                'authentication' => true,
                'parameters' => [
                    'taskId' => 'integer|required',
                ],
                'response' => 'Task accepted confirmation',
                'feature' => 'Accept Marketplace Task',
            ],
            'marketplace.my-tasks' => [
                'path' => '/api/codemart/v1/marketplace/my-tasks',
                'method' => 'GET',
                'authentication' => true,
                'parameters' => [],
                'response' => 'My accepted tasks list',
                'feature' => 'Get My Tasks',
            ],
        ];
    }

    public static function getAppInfo(): array
    {
        return [
            'name' => 'CodeMart V1',
            'version' => '1.0.0',
            'namespace' => 'codemart',
            'description' => 'CodeMart - Integrated freelance platform with project management, task tracking, and payments',
            'baseUrl' => '/api/codemart/v1',
            'authentication' => 'Sanctum Bearer Token',
            'supportedHeaders' => self::getSupportedHeaders(),
            'totalApis' => count(self::getApis()),
            'lastUpdated' => now()->toDateTimeString(),
        ];
    }
}
