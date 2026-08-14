<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1TaskCommentModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_task_comments';

    protected $fillable = [
        'task_id',
        'user_id',
        'comment',
        'mentions',
    ];

    protected $casts = [
        'mentions' => 'json',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1TaskModel::class, 'task_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }
}
