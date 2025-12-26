<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;

class CodeMartV1ReviewerApplicationModel extends Model
{
    protected $connection = 'codemartv1';
    protected $table = 'codemart_v1_reviewer_applications';

    protected $fillable = [
        'user_id',
        'status',
        'test_cases',
        'user_reviews',
        'similarity_score',
        'completed_at',
    ];

    protected $casts = [
        'similarity_score' => 'decimal:2',
        'completed_at' => 'datetime',
    ];
}
