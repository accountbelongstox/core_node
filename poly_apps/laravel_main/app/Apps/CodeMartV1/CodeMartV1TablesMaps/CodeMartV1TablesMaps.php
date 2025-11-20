<?php

namespace App\Apps\CodeMartV1\CodeMartV1TablesMaps;

class CodeMartV1TablesMaps
{
    // Global tables (shared across apps)
    public const USERS_TABLE = 'users';
    public const USERS_ID = 'id';
    public const USERS_EMAIL = 'email';
    public const USERS_NAME = 'name';
    public const USERS_ROLE_LEVEL = 'rolelevel';

    // CodeMart V1 Projects table
    public const CODEMART_PROJECTS_TABLE = 'codemart_v1_projects';
    public const CODEMART_PROJECTS_ID = 'id';
    public const CODEMART_PROJECTS_CLIENT_ID = 'client_id';
    public const CODEMART_PROJECTS_TITLE = 'title';
    public const CODEMART_PROJECTS_DESCRIPTION = 'description';
    public const CODEMART_PROJECTS_STATUS = 'status';
    public const CODEMART_PROJECTS_COMPLEXITY = 'complexity';
    public const CODEMART_PROJECTS_BUDGET = 'budget';
    public const CODEMART_PROJECTS_BUDGET_TYPE = 'budget_type';
    public const CODEMART_PROJECTS_CURRENCY = 'currency';
    public const CODEMART_PROJECTS_SKILLS = 'skills';
    public const CODEMART_PROJECTS_LANGUAGES = 'languages';
    public const CODEMART_PROJECTS_FRAMEWORKS = 'frameworks';
    public const CODEMART_PROJECTS_DATABASES = 'databases';

    // CodeMart V1 Milestones table
    public const CODEMART_MILESTONES_TABLE = 'codemart_v1_milestones';
    public const CODEMART_MILESTONES_ID = 'id';
    public const CODEMART_MILESTONES_PROJECT_ID = 'project_id';
    public const CODEMART_MILESTONES_TITLE = 'title';
    public const CODEMART_MILESTONES_DESCRIPTION = 'description';
    public const CODEMART_MILESTONES_DUE_DATE = 'due_date';
    public const CODEMART_MILESTONES_BUDGET = 'budget';
    public const CODEMART_MILESTONES_DELIVERABLES = 'deliverables';
    public const CODEMART_MILESTONES_STATUS = 'status';
    public const CODEMART_MILESTONES_ORDER = 'order';

    // CodeMart V1 Project Proposals table
    public const CODEMART_PROJECT_PROPOSALS_TABLE = 'codemart_v1_project_proposals';
    public const CODEMART_PROJECT_PROPOSALS_ID = 'id';
    public const CODEMART_PROJECT_PROPOSALS_PROJECT_ID = 'project_id';
    public const CODEMART_PROJECT_PROPOSALS_STATUS = 'status';
    public const CODEMART_PROJECT_PROPOSALS_RECOMMENDED_TECH_STACK = 'recommended_tech_stack';
    public const CODEMART_PROJECT_PROPOSALS_SUGGESTED_TEAM_COMPOSITION = 'suggested_team_composition';
    public const CODEMART_PROJECT_PROPOSALS_ESTIMATED_DURATION = 'estimated_duration';
    public const CODEMART_PROJECT_PROPOSALS_ESTIMATED_COST = 'estimated_cost';
    public const CODEMART_PROJECT_PROPOSALS_COST_BREAKDOWN = 'cost_breakdown';

    // CodeMart V1 Project Attachments table
    public const CODEMART_PROJECT_ATTACHMENTS_TABLE = 'codemart_v1_project_attachments';
    public const CODEMART_PROJECT_ATTACHMENTS_ID = 'id';
    public const CODEMART_PROJECT_ATTACHMENTS_PROJECT_ID = 'project_id';
    public const CODEMART_PROJECT_ATTACHMENTS_FILE_NAME = 'file_name';
    public const CODEMART_PROJECT_ATTACHMENTS_ORIGINAL_NAME = 'original_name';
    public const CODEMART_PROJECT_ATTACHMENTS_MIME_TYPE = 'mime_type';
    public const CODEMART_PROJECT_ATTACHMENTS_SIZE = 'size';
    public const CODEMART_PROJECT_ATTACHMENTS_PATH = 'path';
    public const CODEMART_PROJECT_ATTACHMENTS_UPLOADED_BY = 'uploaded_by';

    // CodeMart V1 Tasks table
    public const CODEMART_TASKS_TABLE = 'codemart_v1_tasks';
    public const CODEMART_TASKS_ID = 'id';
    public const CODEMART_TASKS_MILESTONE_ID = 'milestone_id';
    public const CODEMART_TASKS_TITLE = 'title';
    public const CODEMART_TASKS_DESCRIPTION = 'description';
    public const CODEMART_TASKS_STATUS = 'status';
    public const CODEMART_TASKS_PRIORITY = 'priority';
    public const CODEMART_TASKS_ASSIGNED_TO = 'assigned_to';
    public const CODEMART_TASKS_DUE_DATE = 'due_date';
    public const CODEMART_TASKS_DELIVERABLES = 'deliverables';
    public const CODEMART_TASKS_BUDGET_ALLOCATION = 'budget_allocation';
    public const CODEMART_TASKS_ORDER = 'order';

    // CodeMart V1 Task Submissions table
    public const CODEMART_TASK_SUBMISSIONS_TABLE = 'codemart_v1_task_submissions';
    public const CODEMART_TASK_SUBMISSIONS_ID = 'id';
    public const CODEMART_TASK_SUBMISSIONS_TASK_ID = 'task_id';
    public const CODEMART_TASK_SUBMISSIONS_SUBMITTED_BY = 'submitted_by';
    public const CODEMART_TASK_SUBMISSIONS_SUBMISSION_NOTE = 'submission_note';
    public const CODEMART_TASK_SUBMISSIONS_FILES = 'files';
    public const CODEMART_TASK_SUBMISSIONS_STATUS = 'status';

    // CodeMart V1 Task Comments table
    public const CODEMART_TASK_COMMENTS_TABLE = 'codemart_v1_task_comments';
    public const CODEMART_TASK_COMMENTS_ID = 'id';
    public const CODEMART_TASK_COMMENTS_TASK_ID = 'task_id';
    public const CODEMART_TASK_COMMENTS_USER_ID = 'user_id';
    public const CODEMART_TASK_COMMENTS_COMMENT = 'comment';
    public const CODEMART_TASK_COMMENTS_MENTIONS = 'mentions';

    // CodeMart V1 Code Reviews table
    public const CODEMART_CODE_REVIEWS_TABLE = 'codemart_v1_code_reviews';
    public const CODEMART_CODE_REVIEWS_ID = 'id';
    public const CODEMART_CODE_REVIEWS_TASK_SUBMISSION_ID = 'task_submission_id';
    public const CODEMART_CODE_REVIEWS_REVIEWER_ID = 'reviewer_id';
    public const CODEMART_CODE_REVIEWS_REVIEW_NOTES = 'review_notes';
    public const CODEMART_CODE_REVIEWS_STATUS = 'status';
    public const CODEMART_CODE_REVIEWS_RATING = 'rating';
    public const CODEMART_CODE_REVIEWS_LINE_COMMENTS = 'line_comments';

    // CodeMart V1 Wallets table
    public const CODEMART_WALLETS_TABLE = 'codemart_v1_wallets';
    public const CODEMART_WALLETS_ID = 'id';
    public const CODEMART_WALLETS_USER_ID = 'user_id';
    public const CODEMART_WALLETS_BALANCE = 'balance';
    public const CODEMART_WALLETS_AVAILABLE_BALANCE = 'available_balance';
    public const CODEMART_WALLETS_FROZEN_BALANCE = 'frozen_balance';
    public const CODEMART_WALLETS_CURRENCY = 'currency';

    // CodeMart V1 Wallet Transactions table
    public const CODEMART_WALLET_TRANSACTIONS_TABLE = 'codemart_v1_wallet_transactions';
    public const CODEMART_WALLET_TRANSACTIONS_ID = 'id';
    public const CODEMART_WALLET_TRANSACTIONS_WALLET_ID = 'wallet_id';
    public const CODEMART_WALLET_TRANSACTIONS_TYPE = 'type';
    public const CODEMART_WALLET_TRANSACTIONS_AMOUNT = 'amount';
    public const CODEMART_WALLET_TRANSACTIONS_BALANCE_AFTER = 'balance_after';
    public const CODEMART_WALLET_TRANSACTIONS_DESCRIPTION = 'description';
    public const CODEMART_WALLET_TRANSACTIONS_METADATA = 'metadata';
    public const CODEMART_WALLET_TRANSACTIONS_STATUS = 'status';

    // CodeMart V1 Payments table
    public const CODEMART_PAYMENTS_TABLE = 'codemart_v1_payments';
    public const CODEMART_PAYMENTS_ID = 'id';
    public const CODEMART_PAYMENTS_PAYER_ID = 'payer_id';
    public const CODEMART_PAYMENTS_PAYEE_ID = 'payee_id';
    public const CODEMART_PAYMENTS_PROJECT_ID = 'project_id';
    public const CODEMART_PAYMENTS_MILESTONE_ID = 'milestone_id';
    public const CODEMART_PAYMENTS_AMOUNT = 'amount';
    public const CODEMART_PAYMENTS_CURRENCY = 'currency';
    public const CODEMART_PAYMENTS_TYPE = 'type';
    public const CODEMART_PAYMENTS_STATUS = 'status';
    public const CODEMART_PAYMENTS_PAYMENT_METHOD = 'payment_method';
    public const CODEMART_PAYMENTS_TRANSACTION_ID = 'transaction_id';
    public const CODEMART_PAYMENTS_DESCRIPTION = 'description';
    public const CODEMART_PAYMENTS_METADATA = 'metadata';

    // CodeMart V1 Escrows table
    public const CODEMART_ESCROWS_TABLE = 'codemart_v1_escrows';
    public const CODEMART_ESCROWS_ID = 'id';
    public const CODEMART_ESCROWS_PROJECT_ID = 'project_id';
    public const CODEMART_ESCROWS_PAYER_ID = 'payer_id';
    public const CODEMART_ESCROWS_PAYEE_ID = 'payee_id';
    public const CODEMART_ESCROWS_AMOUNT = 'amount';
    public const CODEMART_ESCROWS_CURRENCY = 'currency';
    public const CODEMART_ESCROWS_STATUS = 'status';
    public const CODEMART_ESCROWS_RELEASED_AT = 'released_at';
    public const CODEMART_ESCROWS_RELEASE_REASON = 'release_reason';

    // CodeMart V1 Invoices table
    public const CODEMART_INVOICES_TABLE = 'codemart_v1_invoices';
    public const CODEMART_INVOICES_ID = 'id';
    public const CODEMART_INVOICES_PAYMENT_ID = 'payment_id';
    public const CODEMART_INVOICES_INVOICE_NUMBER = 'invoice_number';
    public const CODEMART_INVOICES_ISSUED_BY = 'issued_by';
    public const CODEMART_INVOICES_DESCRIPTION = 'description';
    public const CODEMART_INVOICES_LINE_ITEMS = 'line_items';
    public const CODEMART_INVOICES_SUBTOTAL = 'subtotal';
    public const CODEMART_INVOICES_TAX = 'tax';
    public const CODEMART_INVOICES_TOTAL = 'total';
    public const CODEMART_INVOICES_ISSUED_DATE = 'issued_date';
    public const CODEMART_INVOICES_DUE_DATE = 'due_date';
    public const CODEMART_INVOICES_STATUS = 'status';
    public const CODEMART_INVOICES_METADATA = 'metadata';

    // CodeMart V1 Refunds table
    public const CODEMART_REFUNDS_TABLE = 'codemart_v1_refunds';
    public const CODEMART_REFUNDS_ID = 'id';
    public const CODEMART_REFUNDS_PAYMENT_ID = 'payment_id';
    public const CODEMART_REFUNDS_AMOUNT = 'amount';
    public const CODEMART_REFUNDS_STATUS = 'status';
    public const CODEMART_REFUNDS_REASON = 'reason';
    public const CODEMART_REFUNDS_NOTES = 'notes';
    public const CODEMART_REFUNDS_REQUESTED_AT = 'requested_at';
    public const CODEMART_REFUNDS_PROCESSED_AT = 'processed_at';
}
