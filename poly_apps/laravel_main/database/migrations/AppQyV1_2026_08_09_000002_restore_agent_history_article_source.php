<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel;
use App\Constants\AppKeys;
use App\Models\GlobalTask;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\QueueCenter\QueueCenterService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
    }

    public function up(): void
    {
        $article = new AppQyV1Article();
        $sourceSentence = new AppQyV1SourceSentenceModel();
        $articleSchema = Schema::connection($article->getConnectionName());
        $sourceSentenceSchema = Schema::connection($sourceSentence->getConnectionName());

        if (!$articleSchema->hasTable($article->getTable())) {
            return;
        }

        AppQyV1Article::query()
            ->where('source', AppQyV1Article::TYPE_DAILY)
            ->where('article_type', AppQyV1Article::TYPE_DAILY)
            ->where('is_daily_reading', true)
            ->where('user_id', 0)
            ->whereRaw("metadata::jsonb ? 'raw_word_count'")
            ->whereRaw("metadata::jsonb ? 'reference_lang'")
            ->update(['source' => AppQyV1Article::SOURCE_AGENT_HISTORY]);

        AppQyV1Article::query()
            ->where('source', AppQyV1Article::SOURCE_AGENT_HISTORY)
            ->where('article_type', AppQyV1Article::TYPE_DAILY)
            ->select(['id', 'article_id'])
            ->chunkById(500, function ($rows): void {
                $articleIds = $rows
                    ->pluck('article_id')
                    ->filter(static fn ($articleId): bool => is_string($articleId) && $articleId !== '')
                    ->values()
                    ->all();
                $this->cancelLiveTasks('article_id', $articleIds);
            });

        if (!$sourceSentenceSchema->hasTable($sourceSentence->getTable())) {
            return;
        }

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $this->cancelLegacySentenceTasks($language, $article, $sourceSentence);
        }
    }

    public function down(): void
    {
    }

    private function cancelLegacySentenceTasks(
        string $language,
        AppQyV1Article $article,
        AppQyV1SourceSentenceModel $sourceSentence
    ): void {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        $linkTable = $sourceSentence->getTable();
        $articleTable = $article->getTable();

        AppQyV1SourceSentenceModel::query()
            ->from($linkTable . ' as source_links')
            ->join(
                $articleTable . ' as source_articles',
                'source_articles.article_id',
                '=',
                'source_links.source_key'
            )
            ->where('source_links.source_type', 'article')
            ->where('source_articles.source', AppQyV1Article::SOURCE_AGENT_HISTORY)
            ->where('source_articles.article_type', AppQyV1Article::TYPE_DAILY)
            ->whereRaw('(source_links.lang_content_ids ->> ?) IS NOT NULL', [$language])
            ->select('source_links.id as link_id')
            ->selectRaw('(source_links.lang_content_ids ->> ?) as content_id', [$language])
            ->chunkById(500, function ($rows) use ($language): void {
                $contentIds = $rows
                    ->pluck('content_id')
                    ->filter(static fn ($contentId): bool => is_string($contentId) && $contentId !== '')
                    ->unique()
                    ->values()
                    ->all();
                $exclusiveIds = AppQyV1SourceSentenceModel::contentIdsExclusiveToAgentHistory(
                    $language,
                    $contentIds
                );
                if ($exclusiveIds === []) {
                    return;
                }

                $this->cancelLiveTasks('content_id', $exclusiveIds);
            }, 'source_links.id', 'link_id');
    }

    private function cancelLiveTasks(string $payloadField, array $values): void
    {
        if ($values === []) {
            return;
        }

        GlobalTask::query()
            ->where('task_type', QueueCenterService::QUEUE_SENTENCE_AUDIO)
            ->whereIn('status', GlobalTask::statuses('live'))
            ->whereIn('payload->' . $payloadField, $values)
            ->update([
                'status' => GlobalTask::status('cancelled'),
                'assigned_to' => null,
                'assigned_at' => null,
                'timeout_at' => null,
                'completed_at' => now(),
                'error' => 'Agent History daily articles use their uploaded whole-article audio.',
                'updated_at' => now(),
            ]);
    }
};
