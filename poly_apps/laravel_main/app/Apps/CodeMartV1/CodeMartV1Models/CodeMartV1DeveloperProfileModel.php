<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1DeveloperProfileModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::DEVELOPER_PROFILES_TABLE;

    protected $fillable = [
        'user_id',
        'company_name',
        'bio',
        'skills',
        'certifications',
        'completed_projects',
        'average_rating',
        'followers_count',
        'profile_completed_at',
    ];

    protected $casts = [
        'skills' => 'json',
        'certifications' => 'json',
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
