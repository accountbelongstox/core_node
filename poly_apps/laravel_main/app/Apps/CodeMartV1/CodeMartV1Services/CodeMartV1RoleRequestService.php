<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;

/**
 * Self-service role requests shared by registration and existing accounts.
 * A role without a deposit requirement activates immediately; roles with a
 * deposit stay pending until the administrator-confirmed deposit activates
 * them. A rejected role may be requested again.
 */
class CodeMartV1RoleRequestService
{
    public const SELF_SERVICE_ROLES = [
        CodeMartV1Constants::ROLE_DEVELOPER,
        CodeMartV1Constants::ROLE_CLIENT,
    ];

    public static function initialStatus(string $roleType): string
    {
        return CodeMartV1Constants::getDepositAmount($roleType) > 0
            ? CodeMartV1Constants::ROLE_STATUS_PENDING
            : CodeMartV1Constants::ROLE_STATUS_ACTIVE;
    }

    public function request(int $userId, string $roleType): array
    {
        if (!in_array($roleType, self::SELF_SERVICE_ROLES, true)) {
            return CodeMartV1AdminService::failure(
                CodeMartV1Constants::ERROR_INVALID_ROLE_TYPE,
                422,
                'This role cannot be requested directly'
            );
        }

        $status = self::initialStatus($roleType);
        $existing = CodeMartV1UserRoleModel::forUserAndType($userId, $roleType);

        if ($existing && $existing->role_status !== CodeMartV1Constants::ROLE_STATUS_REJECTED) {
            return CodeMartV1AdminService::failure(
                CodeMartV1Constants::ERROR_ROLE_ALREADY_EXISTS,
                409,
                'Role already requested'
            );
        }

        $fromStatus = $existing?->role_status;
        $attributes = [
            'role_status' => $status,
            'role_activated_at' => $status === CodeMartV1Constants::ROLE_STATUS_ACTIVE ? now() : null,
        ];

        if ($existing) {
            $existing->update($attributes);
            $role = $existing;
        } else {
            $role = CodeMartV1UserRoleModel::createRecord($attributes + [
                'user_id' => $userId,
                'role_type' => $roleType,
            ]);
        }

        CodeMartV1DomainEventService::emit(
            $userId,
            CodeMartV1Constants::RESOURCE_USER_ROLE,
            (int) $role->id,
            'role_requested',
            $fromStatus,
            $status,
            [],
            null,
            null,
            null,
            ['role' => $roleType, 'user_id' => $userId]
        );

        $depositAmount = CodeMartV1Constants::getDepositAmount($roleType);

        return [
            'role_type' => $roleType,
            'role_status' => $status,
            'deposit_required' => $depositAmount > 0,
            'deposit_amount' => $depositAmount,
            'next_step' => $status === CodeMartV1Constants::ROLE_STATUS_ACTIVE ? 'role_active' : 'deposit',
        ];
    }
}
