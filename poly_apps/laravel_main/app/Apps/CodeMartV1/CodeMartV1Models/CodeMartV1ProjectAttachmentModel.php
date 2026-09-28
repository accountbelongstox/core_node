<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1ProjectAttachmentModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_project_attachments';

    protected $fillable = [
        'project_id',
        'file_name',
        'original_name',
        'mime_type',
        'size',
        'path',
        'uploaded_by',
    ];

    protected $hidden = [
        'path',
    ];

    public static function pageForProject(int $projectId, int $page, int $pageSize): array
    {
        $query = static::query()->where('project_id', $projectId)->latest();

        return self::paginateQuery($query, 'attachments', $page, $pageSize);
    }

    public static function findForProject(int $projectId, int $attachmentId): ?self
    {
        return static::query()->where('project_id', $projectId)->whereKey($attachmentId)->first();
    }

    public static function forProject(int $projectId): \Illuminate\Support\Collection
    {
        return static::query()->where('project_id', $projectId)->get();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'uploaded_by');
    }
}
