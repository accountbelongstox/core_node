<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use Illuminate\Support\Facades\Cache;

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
                $completedProjects = CodeMartV1ProjectModel::query()
                    ->where('status', CodeMartV1Constants::PROJECT_STATUS_COMPLETED)
                    ->count();
                $activeDevelopers = CodeMartV1UserRoleModel::query()
                    ->where('role_type', CodeMartV1Constants::ROLE_DEVELOPER)
                    ->where('role_status', CodeMartV1Constants::ROLE_STATUS_ACTIVE)
                    ->distinct()
                    ->count('user_id');
                $completedTasks = CodeMartV1TaskModel::query()
                    ->where('status', CodeMartV1Constants::TASK_STATUS_COMPLETED)
                    ->count();

                return [
                    'summary' => [
                        'completed_projects' => $completedProjects,
                        'active_developers' => $activeDevelopers,
                        'completed_tasks' => $completedTasks,
                    ],
                    'testimonials' => [],
                    'refresh_after_seconds' => self::CACHE_TTL_SECONDS,
                    'updated_at' => now('UTC')->toIso8601String(),
                ];
            },
        );
    }
}
