<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1ClientProfileModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::CLIENT_PROFILES_TABLE;

    protected $fillable = [
        'user_id',
        'company_name',
        'company_registration_number',
        'industry',
        'company_description',
        'contact_person',
        'contact_phone',
        'company_website',
        'posted_projects',
        'average_rating',
        'profile_completed_at',
    ];

    protected $casts = [
        'average_rating' => 'float',
        'profile_completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public function isProfileComplete(): bool
    {
        return $this->profile_completed_at !== null;
    }
}
