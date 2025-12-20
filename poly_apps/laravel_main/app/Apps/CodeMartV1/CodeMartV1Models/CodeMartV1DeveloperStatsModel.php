<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;

class CodeMartV1DeveloperStatsModel extends Model
{
    protected $connection = 'codemartv1';
    protected $table = 'codemart_v1_developer_stats';

    protected $fillable = [
        'user_id',
        'completed_projects',
        'avg_code_score',
        'avg_client_satisfaction',
        'total_earnings',
        'on_time_delivery_rate',
    ];

    protected $casts = [
        'completed_projects' => 'integer',
        'avg_code_score' => 'decimal:2',
        'avg_client_satisfaction' => 'decimal:2',
        'total_earnings' => 'decimal:2',
        'on_time_delivery_rate' => 'decimal:2',
    ];
}
