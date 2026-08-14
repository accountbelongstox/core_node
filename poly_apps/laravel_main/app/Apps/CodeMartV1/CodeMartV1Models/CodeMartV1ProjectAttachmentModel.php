<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1ProjectAttachmentModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
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

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'uploaded_by');
    }

    public function getUrl(): string
    {
        return \Storage::url($this->path);
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }
}
