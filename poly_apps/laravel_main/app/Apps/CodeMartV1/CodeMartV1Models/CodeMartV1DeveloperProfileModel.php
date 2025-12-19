<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1DeveloperProfileModel extends Model
{
    protected $connection = 'codemartv1';
    protected $table = 'codemart_developer_profiles';

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
