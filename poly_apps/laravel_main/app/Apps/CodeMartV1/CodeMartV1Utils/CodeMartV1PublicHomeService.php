<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TestimonialModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use Illuminate\Support\Facades\Cache;

/**
 * Publication-safe public-home projection: aggregate counters and approved
 * testimonial records only. Requires no bearer token and never leaks
 * user-level data.
 */
class CodeMartV1PublicHomeService
{
    public const CACHE_TTL_SECONDS = 300;

    private const CACHE_KEY = 'codemart_v1.public_home';

    public function getHome(): array
    {
        return Cache::remember(
            self::CACHE_KEY,
            now()->addSeconds(self::CACHE_TTL_SECONDS),
            static function (): array {
                $projectCount = CodeMartV1ProjectModel::query()->count();
                $developerCount = CodeMartV1UserRoleModel::query()
                    ->where('role_type', CodeMartV1Constants::ROLE_DEVELOPER)
                    ->where('role_status', CodeMartV1Constants::ROLE_STATUS_ACTIVE)
                    ->distinct()
                    ->count('user_id');
                $totalAmount = CodeMartV1ProjectModel::query()
                    ->whereNotNull('budget')
                    ->sum('budget');

                $testimonials = CodeMartV1TestimonialModel::approvedList()->map(
                    static fn (CodeMartV1TestimonialModel $testimonial): array => [
                        'id' => (string) $testimonial->id,
                        'quote' => $testimonial->quote_key,
                        'author_label' => $testimonial->author_label,
                        'role_label' => $testimonial->role_label,
                        'avatar_url' => $testimonial->avatar_url,
                    ]
                )->all();

                return [
                    'total_amount' => number_format((float) $totalAmount, 2, '.', ''),
                    'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                    'project_count' => $projectCount,
                    'developer_count' => $developerCount,
                    'testimonials' => $testimonials,
                    'refresh_after_seconds' => self::CACHE_TTL_SECONDS,
                    'updated_at' => now('UTC')->toIso8601String(),
                ];
            },
        );
    }
}
