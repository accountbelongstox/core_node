<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWord;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AppQyV1ArticleManagementService
{
    public function list(int $limit = 50, int $offset = 0, ?string $category = null): array
    {
        $query = null;
        $rows = null;
        $categoryRows = null;
        $items = [];
        $categories = [];
        $total = 0;

        $limit = max(1, min($limit, 100));
        $offset = max(0, $offset);
        $category = $category !== null ? trim($category) : null;
        $query = AppQyV1Article::query();

        if ($category !== null && $category !== '') {
            if ($category === 'daily') {
                $query->where(function ($dailyQuery): void {
                    $dailyQuery
                        ->where('source', 'daily')
                        ->orWhere('article_type', 'daily')
                        ->orWhere('is_daily_reading', true);
                });
            } else {
                $query->where('article_type', $category);
            }
        }

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->offset($offset)->limit($limit)->get();
        foreach ($rows as $row) {
            $items[] = $this->mapArticle($row);
        }

        $categoryRows = AppQyV1Article::query()
            ->select(['article_type', 'source', 'is_daily_reading'])
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy(['article_type', 'source', 'is_daily_reading'])
            ->get();

        foreach ($categoryRows as $row) {
            $rowCategory = $this->categoryFromValues(
                $row->article_type,
                $row->source,
                (bool) $row->is_daily_reading
            );
            $categories[$rowCategory] = ($categories[$rowCategory] ?? 0) + (int) $row->aggregate;
        }
        ksort($categories);

        return [
            'items' => $items,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'categories' => $categories,
        ];
    }

    public function mapArticle(AppQyV1Article $article): array
    {
        $metadata = [];
        $category = '';

        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $category = $this->categoryFromValues(
            $article->article_type,
            $article->source,
            (bool) $article->is_daily_reading
        );

        return [
            'id' => $article->article_id,
            'article_id' => $article->article_id,
            'source_key' => $article->article_id,
            'category' => $category,
            'source' => $article->source,
            'article_type' => $article->article_type,
            'title' => $article->title,
            'title_en' => $metadata['title_en'] ?? $article->title,
            'title_cn' => $metadata['title_cn'] ?? null,
            'article_en' => $article->content,
            'reference_cn' => $metadata['reference_cn'] ?? null,
            'language' => $article->language,
            'difficulty_level' => $article->difficulty_level,
            'word_count' => (int) $article->word_count,
            'unique_word_count' => (int) $article->unique_word_count,
            'sentence_count' => (int) $article->sentence_count,
            'is_daily_reading' => (bool) $article->is_daily_reading,
            'tts_generated' => (bool) $article->tts_generated,
            'task_id' => $article->task_id,
            'audio_url' => $metadata['audio_url'] ?? null,
            'document_id' => $metadata['document_id'] ?? null,
            'reading_date' => $article->reading_date ? $article->reading_date->toDateString() : null,
            'created_at' => $article->created_at ? $article->created_at->toIso8601String() : null,
        ];
    }

    public function delete(string $articleId): ?array
    {
        $article = null;
        $metadata = [];
        $category = '';
        $documentId = null;
        $audioPaths = [];
        $audioExisted = false;
        $connection = '';
        $result = [];

        $article = AppQyV1Article::query()->where('article_id', $articleId)->first();
        if ($article === null) {
            return null;
        }

        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $category = $this->categoryFromValues(
            $article->article_type,
            $article->source,
            (bool) $article->is_daily_reading
        );
        $documentId = isset($metadata['document_id']) ? (int) $metadata['document_id'] : null;

        if ($category === 'daily') {
            $audioPaths = $this->dailyAudioPaths($article->article_id, $article->language);
            foreach ($audioPaths as $audioPath) {
                $audioExisted = FileSystemManager::exists($audioPath) || $audioExisted;
                if (!FileSystemManager::delete($audioPath)) {
                    throw new RuntimeException('Article audio could not be deleted.');
                }
            }
        }

        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $result = DB::connection($connection)->transaction(function () use ($article, $category, $documentId): array {
            $articleWordsDeleted = 0;
            $documentDeleted = 0;

            $articleWordsDeleted = AppQyV1ArticleWord::query()
                ->where('article_id', $article->article_id)
                ->delete();

            if ($documentId !== null && $documentId > 0) {
                $documentDeleted = AppQyV1UploadedDocumentModel::query()
                    ->whereKey($documentId)
                    ->delete();
            }

            $article->delete();

            return [
                'article_id' => $article->article_id,
                'category' => $category,
                'article_words_deleted' => $articleWordsDeleted,
                'document_deleted' => $documentDeleted > 0,
            ];
        });

        $result['audio_deleted'] = $audioExisted;
        return $result;
    }

    private function categoryFromValues(?string $articleType, ?string $source, bool $isDailyReading): string
    {
        if ($source === 'daily' || $articleType === 'daily' || $isDailyReading) {
            return 'daily';
        }

        return $articleType !== null && trim($articleType) !== '' ? trim($articleType) : 'general';
    }

    private function dailyAudioPaths(string $articleId, string $language): array
    {
        $languageCode = '';
        $safeId = '';
        $filename = '';
        $dailyDirectory = '';
        $legacyDirectory = '';

        $languageCode = AppQyV1TableMaps::normalizeLangCode($language);
        $languageCode = $languageCode !== '' ? $languageCode : 'en';
        $safeId = preg_replace('/[^A-Za-z0-9._-]/', '_', $articleId) ?: 'article';
        $filename = $safeId . '.mp3';
        $dailyDirectory = PathMapper::getAppQyV1AudioBaseDir('daily/' . $languageCode);
        $legacyDirectory = PathMapper::getAppQyV1AudioBaseDir('agent_history/' . $languageCode);

        return [
            $dailyDirectory . DIRECTORY_SEPARATOR . $filename,
            $legacyDirectory . DIRECTORY_SEPARATOR . $filename,
        ];
    }
}
