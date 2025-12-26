<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1KycVerificationModel extends Model
{
    protected $connection = 'codemartv1';
    protected $table = 'codemart_kyc_verifications';

    protected $fillable = [
        'user_id',
        'identity_type',
        'identity_number',
        'real_name',
        'date_of_birth',
        'id_front_image_path',
        'id_back_image_path',
        'selfie_image_path',
        'verification_status',
        'verification_notes',
        'verified_at',
        'verified_by',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'verified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public function isApproved(): bool
    {
        return $this->verification_status === 'approved' && $this->verified_at !== null;
    }

    public function isPending(): bool
    {
        return $this->verification_status === 'pending';
    }

    public function isRejected(): bool
    {
        return $this->verification_status === 'rejected';
    }
}
