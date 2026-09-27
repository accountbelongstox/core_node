<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TestimonialModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;

/**
 * Client testimonial intake. Only clients with an active role and a completed
 * project may submit; submissions stay unapproved until moderated.
 */
class CodeMartV1TestimonialService
{
    public static function completedProjectsQuery(int $userId)
    {
        return CodeMartV1ProjectModel::query()
            ->where('client_id', $userId)
            ->where('status', CodeMartV1Constants::PROJECT_STATUS_COMPLETED);
    }

    public static function isEligible(int $userId): bool
    {
        return CodeMartV1UserRoleModel::forUserAndType(
            $userId,
            CodeMartV1Constants::ROLE_CLIENT,
            CodeMartV1Constants::ROLE_STATUS_ACTIVE
        ) !== null && self::completedProjectsQuery($userId)->exists();
    }

    public function submit(int $userId, array $input, string $locale): array
    {
        if (!self::isEligible($userId)) {
            return CodeMartV1AdminService::failure(
                CodeMartV1Constants::ERROR_TESTIMONIAL_NOT_ELIGIBLE,
                403,
                'Only clients with a completed project can submit a testimonial'
            );
        }

        $projectQuery = self::completedProjectsQuery($userId);
        if (!empty($input['project_id'])) {
            $projectQuery->whereKey((int) $input['project_id']);
        }
        $project = $projectQuery->orderByDesc('updated_at')->first();
        if (!$project) {
            return CodeMartV1AdminService::failure(
                CodeMartV1Constants::ERROR_TESTIMONIAL_NOT_ELIGIBLE,
                403,
                'The project is not a completed project of this client'
            );
        }

        $duplicate = CodeMartV1TestimonialModel::query()
            ->where('user_id', $userId)
            ->where('project_id', $project->id)
            ->where('status', '!=', CodeMartV1Constants::TESTIMONIAL_STATUS_HIDDEN)
            ->exists();
        if ($duplicate) {
            return CodeMartV1AdminService::failure(
                CodeMartV1Constants::ERROR_TESTIMONIAL_ALREADY_SUBMITTED,
                409,
                'A testimonial for this project was already submitted'
            );
        }

        $user = CodeMartV1UserModel::findById($userId);
        $authorLabel = trim((string) ($input['author_label'] ?? ''));
        if ($authorLabel === '') {
            $authorLabel = (string) ($user?->nickname ?: $user?->name ?: $user?->username);
        }

        $quotes = is_array($input['quotes'] ?? null) ? array_filter(
            array_intersect_key($input['quotes'], array_flip(CodeMartV1Constants::SUPPORTED_LOCALES)),
            static fn ($value): bool => is_string($value) && trim($value) !== ''
        ) : [];
        if (!empty($input['quote'])) {
            $quotes[$locale] = (string) $input['quote'];
        }

        $roleLabels = is_array($input['role_labels'] ?? null) ? array_filter(
            array_intersect_key($input['role_labels'], array_flip(CodeMartV1Constants::SUPPORTED_LOCALES)),
            static fn ($value): bool => is_string($value) && trim($value) !== ''
        ) : [];
        $roleLabel = trim((string) ($input['role_label'] ?? ''));

        $testimonial = CodeMartV1TestimonialModel::createRecord([
            'quote_key' => '',
            'quotes' => $quotes,
            'author_label' => $authorLabel,
            'role_label' => $roleLabel !== '' ? $roleLabel : CodeMartV1Constants::ROLE_CLIENT,
            'role_labels' => $roleLabels === [] ? null : $roleLabels,
            'approved' => false,
            'status' => CodeMartV1Constants::TESTIMONIAL_STATUS_PENDING,
            'display_order' => 0,
            'user_id' => $userId,
            'project_id' => $project->id,
        ]);

        CodeMartV1DomainEventService::emit(
            $userId,
            CodeMartV1Constants::RESOURCE_TESTIMONIAL,
            (int) $testimonial->id,
            'testimonial_submitted',
            null,
            CodeMartV1Constants::TESTIMONIAL_STATUS_PENDING,
            [],
            null,
            null,
            null,
            ['project_id' => (int) $project->id]
        );

        return [
            'id' => $testimonial->id,
            'status' => CodeMartV1Constants::TESTIMONIAL_STATUS_PENDING,
            'project_id' => (int) $project->id,
        ];
    }
}
