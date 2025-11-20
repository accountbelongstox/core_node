<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1PhoneVerificationModel extends Model
{
    protected $table = 'codemart_phone_verifications';

    protected $fillable = [
        'user_id',
        'phone',
        'otp_code',
        'otp_attempts',
        'otp_expires_at',
        'verified_at',
    ];

    protected $casts = [
        'otp_expires_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public function isOtpExpired(): bool
    {
        return now()->isAfter($this->otp_expires_at);
    }

    public function canRetryOtp(): bool
    {
        return $this->otp_attempts < 5 && !$this->isOtpExpired();
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }
}
