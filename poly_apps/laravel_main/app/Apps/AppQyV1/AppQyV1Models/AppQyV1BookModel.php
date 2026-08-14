<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaSourceQueries;
use App\Models\Concerns\QueriesPosterMedia;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\Schema;

/**
 * Book source. Maps sentences + audio only, NO video.
 */
class AppQyV1BookModel extends Model
{
    use AppQyV1MediaSourceQueries, QueriesPosterMedia;

    public static function legacyCollectionBooks(string $collection)
    {
        return self::query()
            ->where('metadata->collection', $collection)
            ->whereNotNull('metadata->abbr')
            ->get();
    }

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books');
    }

    protected $fillable = [
        'source_key',
        'content_id',
        'title',
        'original_name',
        'ascii_name',
        'language',
        'full_content',
        'audio',
        'sentence_seq',
        'word_ids',
        'sentence_count',
        'synced_at',
        'metadata',
        'poster_filename',
        'poster_provider',
        'poster_source_id',
        'poster_status',
        'poster_meta',
        'poster_fetched_at',
        'poster_mcp_submitted_at',
        'assist_claimed_at',
        'assist_claimed_by',
    ];

    protected $casts = [
        'audio' => 'array',
        'sentence_seq' => 'array',
        'word_ids' => 'array',
        'sentence_count' => 'integer',
        'synced_at' => 'datetime',
        'metadata' => 'array',
        'poster_meta' => 'array',
        'poster_fetched_at' => 'datetime',
        'poster_mcp_submitted_at' => 'datetime',
        'assist_claimed_at' => 'datetime',
    ];

    public function sourceSentences(): HasMany
    {
        return $this->hasMany(AppQyV1SourceSentenceModel::class, 'source_key', 'source_key');
    }

    public static function studyMarkerColumnsReady(): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())
            ->hasColumn($model->getTable(), 'study_gen_status');
    }

    public static function studySourceCount(?string $search): int
    {
        $query = self::query();
        if ($search !== null && $search !== '') {
            $query->where('title', 'like', '%' . $search . '%');
        }

        return $query->count();
    }

    public static function studySourceRows(?string $search, int $offset, int $limit): EloquentCollection
    {
        $columns = ['id', 'source_key', 'title', 'language', 'sentence_count'];
        if (self::studyMarkerColumnsReady()) {
            $columns[] = 'study_gen_status';
            $columns[] = 'study_gen_progress';
        }

        $query = self::query();
        if ($search !== null && $search !== '') {
            $query->where('title', 'like', '%' . $search . '%');
        }

        return $query->select($columns)->orderBy('id')->skip($offset)->take($limit)->get();
    }

    public static function sourceMetadata(string $sourceKey): mixed
    {
        return self::query()->where('source_key', $sourceKey)->value('metadata');
    }

    public static function sourceLanguage(string $sourceKey): string
    {
        return (string) (self::query()->where('source_key', $sourceKey)->value('language') ?? '');
    }

    public static function updateStudyMarker(string $sourceKey, array $attributes): int
    {
        return self::query()->where('source_key', $sourceKey)->update($attributes);
    }

    /**
     * Per-language chapters of this book (Books v3.1 model). Chapters live in
     * {prefix}_chapters_{lang}, so this returns a query against the requested
     * language's chapter table scoped to this book (source_type='book').
     */
    public function chaptersForLang(string $lang)
    {
        return AppQyV1LangChapterModel::onLang($lang)
            ->where('source_type', 'book')
            ->where('source_key', $this->source_key)
            ->orderBy('chapter_index');
    }
}
