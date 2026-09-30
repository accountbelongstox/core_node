<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1OtpService;
use App\Models\AppModel;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CodeMartV1UserModel extends AppModel
{
    use RunsModelTransactions;

    protected $table = 'users';

    /**
     * Global Laravel identity is the only login identity: the shared users
     * table lives on the default connection, not the CodeMart database.
     */
    protected ?string $appKey = null;

    public function getConnectionName(): ?string
    {
        return config('database.default');
    }

    protected $fillable = [
        'username',
        'email',
        'password',
        'name',
        'nickname',
        'avatar',
        'about',
        'website',
        'github',
        'wechat',
        'weibo',
        'qq',
        'age',
        'gender',
        'birthday',
        'city',
        'education',
        'occupation',
        'language',
        'religion',
        'rolename',
        'rolelevel',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Nested users (assignee, submitter, reviewer, payer, ...) reach every
     * counterparty, so only the public identity is serialized; self and
     * administrator payloads build their fields explicitly.
     */
    protected $visible = [
        'id',
        'username',
        'name',
        'nickname',
        'avatar',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
    ];

    public function phoneVerifications(): HasMany
    {
        return $this->hasMany(CodeMartV1PhoneVerificationModel::class, 'user_id');
    }

    public function kycVerification(): HasOne
    {
        return $this->hasOne(CodeMartV1KycVerificationModel::class, 'user_id');
    }

    public function userRoles(): HasMany
    {
        return $this->hasMany(CodeMartV1UserRoleModel::class, 'user_id');
    }

    public function developerProfile(): HasOne
    {
        return $this->hasOne(CodeMartV1DeveloperProfileModel::class, 'user_id');
    }

    public function clientProfile(): HasOne
    {
        return $this->hasOne(CodeMartV1ClientProfileModel::class, 'user_id');
    }

    public function hasRole(string $role): bool
    {
        return $this->userRoles()
            ->where('role_type', $role)
            ->where('role_status', 'active')
            ->exists();
    }

    public function getActiveRoles(): array
    {
        return $this->userRoles()
            ->where('role_status', 'active')
            ->pluck('role_type')
            ->toArray();
    }

    public static function findByEmail(string $email): ?self
    {
        return static::query()->where('email', $email)->first();
    }

    /**
     * email_verified_at is not mass assignable, so it is set explicitly.
     */
    public function markEmailVerified(): bool
    {
        return $this->forceFill(['email_verified_at' => now()])->saveRecord();
    }

    public static function findRegistration(int $userId): ?self
    {
        return static::query()->with(['userRoles', 'phoneVerifications', 'kycVerification'])->find($userId);
    }

    public function hasVerifiedPhone(): bool
    {
        if ($this->relationLoaded('phoneVerifications')) {
            return $this->phoneVerifications->contains(fn ($verification): bool => $verification->verified_at !== null);
        }

        return $this->phoneVerifications()->whereNotNull('verified_at')->exists();
    }

    public function roleStatusMap(): array
    {
        if ($this->relationLoaded('userRoles')) {
            return $this->userRoles->pluck('role_status', 'role_type')->toArray();
        }

        return $this->userRoles()->pluck('role_status', 'role_type')->toArray();
    }

    public function isRegistrationComplete(): bool
    {
        return $this->email_verified_at !== null
            && ($this->hasVerifiedPhone() || !CodeMartV1OtpService::smsDeliveryAvailable())
            && ($this->kycVerification?->isApproved() ?? false);
    }
}
