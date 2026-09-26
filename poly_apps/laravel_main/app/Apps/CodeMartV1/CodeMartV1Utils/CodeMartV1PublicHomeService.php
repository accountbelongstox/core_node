<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ContactMessageModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TestimonialModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Publication-safe public projections: aggregate counters, approved
 * testimonials, the redacted showcase, and the contact inbox intake.
 * Requires no bearer token and never leaks user-level data.
 */
class CodeMartV1PublicHomeService
{
    public const CACHE_TTL_SECONDS = 300;

    private const CACHE_KEY = 'codemart_v1.public_home';

    private const ACTIVE_TASK_STATUSES = [
        CodeMartV1Constants::TASK_STATUS_OPEN,
        CodeMartV1Constants::TASK_STATUS_ASSIGNED,
        CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
        CodeMartV1Constants::TASK_STATUS_REVIEW,
    ];

    public static function resolveLocale(Request $request): string
    {
        $candidates = [
            (string) $request->query('locale', ''),
            (string) $request->header('Accept-Language', ''),
        ];

        foreach ($candidates as $candidate) {
            $primary = strtolower(substr(trim(explode(',', $candidate)[0]), 0, 2));
            if (in_array($primary, CodeMartV1Constants::SUPPORTED_LOCALES, true)) {
                return $primary;
            }
        }

        return CodeMartV1Constants::DEFAULT_LOCALE;
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
        foreach (CodeMartV1Constants::SUPPORTED_LOCALES as $locale) {
            Cache::forget(self::CACHE_KEY . '.' . $locale);
        }
    }

    public function getHome(string $locale = CodeMartV1Constants::DEFAULT_LOCALE): array
    {
        return Cache::remember(
            self::CACHE_KEY . '.' . $locale,
            now()->addSeconds(self::CACHE_TTL_SECONDS),
            static function () use ($locale): array {
                $projectCount = CodeMartV1ProjectModel::query()
                    ->whereNotIn('status', CodeMartV1Constants::PUBLIC_EXCLUDED_PROJECT_STATUSES)
                    ->count();
                $developerCount = CodeMartV1UserRoleModel::query()
                    ->where('role_type', CodeMartV1Constants::ROLE_DEVELOPER)
                    ->where('role_status', CodeMartV1Constants::ROLE_STATUS_ACTIVE)
                    ->distinct()
                    ->count('user_id');
                $activeTaskCount = CodeMartV1TaskModel::query()
                    ->whereIn('status', self::ACTIVE_TASK_STATUSES)
                    ->count();

                $totalAmount = CodeMartV1EscrowModel::sumRemaining(
                    CodeMartV1EscrowModel::query()->whereIn('status', [
                        CodeMartV1Constants::ESCROW_STATUS_HELD,
                        CodeMartV1Constants::ESCROW_STATUS_DISPUTED,
                    ])
                );
                $amountSource = 'escrow';
                if ($totalAmount <= 0) {
                    $totalAmount = (float) CodeMartV1ProjectModel::query()
                        ->whereNotIn('status', CodeMartV1Constants::PUBLIC_EXCLUDED_PROJECT_STATUSES)
                        ->whereNotIn('status', [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW])
                        ->whereNotNull('budget')
                        ->sum('budget');
                    $amountSource = 'published_budgets';
                }

                $testimonials = CodeMartV1TestimonialModel::approvedList()
                    ->map(static function (CodeMartV1TestimonialModel $testimonial) use ($locale): ?array {
                        $quote = $testimonial->quoteForLocale($locale);
                        if ($quote === null) {
                            return null;
                        }

                        return [
                            'id' => (string) $testimonial->id,
                            'quote' => $quote,
                            'author_label' => $testimonial->author_label,
                            'role_label' => $testimonial->roleLabelForLocale($locale),
                            'avatar_url' => $testimonial->avatar_url,
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'total_amount' => number_format($totalAmount, 2, '.', ''),
                    'total_amount_source' => $amountSource,
                    'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                    'project_count' => $projectCount,
                    'developer_count' => $developerCount,
                    'active_task_count' => $activeTaskCount,
                    'testimonials' => $testimonials,
                    'locale' => $locale,
                    'refresh_after_seconds' => self::CACHE_TTL_SECONDS,
                    'updated_at' => now('UTC')->toIso8601String(),
                ];
            },
        );
    }

    /**
     * Redacted budget band so exact client budgets are never published.
     */
    private static function budgetRange($amount): ?array
    {
        if ($amount === null || (float) $amount <= 0) {
            return null;
        }

        $value = (float) $amount;
        $step = 10 ** max(0, (int) floor(log10($value)));
        $lower = floor($value / $step) * $step;

        return [
            'min' => number_format($lower, 2, '.', ''),
            'max' => number_format($lower + $step, 2, '.', ''),
        ];
    }

    public function showcase(int $page, int $pageSize): array
    {
        $taskQuery = CodeMartV1TaskModel::query()
            ->with('milestone.project')
            ->where('status', CodeMartV1Constants::TASK_STATUS_OPEN)
            ->whereNull('assigned_to')
            ->whereHas('milestone.project', static function ($projectQuery): void {
                $projectQuery->whereNotIn('status', CodeMartV1Constants::PUBLIC_EXCLUDED_PROJECT_STATUSES);
            })
            ->orderByDesc('id');

        $projectQuery = CodeMartV1ProjectModel::query()
            ->where('status', CodeMartV1Constants::PROJECT_STATUS_COMPLETED)
            ->orderByDesc('updated_at');

        $taskTotal = (clone $taskQuery)->count();
        $projectTotal = (clone $projectQuery)->count();

        $tasks = $taskQuery->forPage($page, $pageSize)->get()->map(
            static function (CodeMartV1TaskModel $task): array {
                $project = $task->milestone?->project;
                $skills = $task->required_skills ?? null;
                if (is_string($skills)) {
                    $skills = json_decode($skills, true);
                }
                if (!is_array($skills) || $skills === []) {
                    $skills = is_array($project?->skills) ? $project->skills : [];
                }

                return [
                    'id' => $task->id,
                    'title' => $task->title,
                    'skills' => array_values($skills),
                    'budget_range' => self::budgetRange($task->budget_allocation),
                    'currency' => $project?->currency ?? CodeMartV1Constants::DEFAULT_CURRENCY,
                    'category' => $project?->complexity,
                    'budget_type' => $project?->budget_type,
                    'priority' => $task->priority,
                    'due_date' => $task->due_date?->toIso8601String(),
                ];
            }
        )->all();

        $projects = $projectQuery->forPage($page, $pageSize)->get()->map(
            static function (CodeMartV1ProjectModel $project): array {
                $start = $project->start_date ?? $project->published_at ?? $project->created_at;
                $end = $project->end_date ?? $project->updated_at;
                $durationDays = ($start && $end) ? max(1, (int) Carbon::parse($start)->diffInDays(Carbon::parse($end))) : null;

                return [
                    'id' => $project->id,
                    'title' => $project->title,
                    'category' => $project->complexity,
                    'skills' => is_array($project->skills) ? array_values($project->skills) : [],
                    'duration_days' => $durationDays,
                    'completed_at' => $project->updated_at?->toIso8601String(),
                ];
            }
        )->all();

        return [
            'page' => $page,
            'page_size' => $pageSize,
            'open_tasks' => [
                'total' => $taskTotal,
                'items' => $tasks,
            ],
            'completed_projects' => [
                'total' => $projectTotal,
                'items' => $projects,
            ],
        ];
    }

    public function submitContactMessage(array $input): array
    {
        $message = CodeMartV1ContactMessageModel::createRecord([
            'name' => $input['name'],
            'email' => $input['email'],
            'subject' => $input['subject'] ?? null,
            'message' => $input['message'],
            'status' => CodeMartV1Constants::CONTACT_STATUS_NEW,
        ]);

        CodeMartV1DomainEventService::emit(
            null,
            CodeMartV1Constants::RESOURCE_CONTACT_MESSAGE,
            (int) $message->id,
            'contact_message_received',
            null,
            CodeMartV1Constants::CONTACT_STATUS_NEW
        );

        return [
            'id' => $message->id,
            'status' => CodeMartV1Constants::CONTACT_STATUS_NEW,
        ];
    }
}
