<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
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
