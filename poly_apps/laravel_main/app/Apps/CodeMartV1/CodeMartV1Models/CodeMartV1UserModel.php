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

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CodeMartV1UserModel extends Model
{
    protected $table = 'users';

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
}
