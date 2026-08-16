<?php

namespace App\Services\TimerTasks;

use App\Services\UserConfig\UserConfigService;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ArticleSentenceAudioService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Services\QueueCenter\QueueCenterService;
use App\Support\QueueCenterContract;

/**
 * Queue Center audio feeder for contract-owned persistent queues.
 *
 * Every 60s advances persistent ID-only page catalogs for the canonical word
 * and sentence tables. Already cataloged IDs are skipped by high-water cursor.
 * Full rows are loaded for one pending ID page only when the corresponding
 * queue is below its backlog target, then enqueued through QueueCenterService.
 *
 *   - words:     mirrors the worker claim selection
 *                (AppQyV1DictionaryTTSCoordinator::pendingWordsQuery — pending,
 *                unleased, valid, retry budget left), capped per tick.
 *   - sentences: {prefix}_sentences_{lang} rows with has_audio=false, scanned
 *                by stable ID; global_tasks.queue_position owns queue order.
 *
 * Cheap by construction: bounded ID pages, one full page in process memory,
 * indexed queue-capacity probes, and no repeated full-row scans.
 *
 * Registered automatically by the auto-discovering OctaneTimerServiceProvider.
 */
class QueueCenterAudioScanTask extends DiffQueueFeederTaskAbstract
{
    private const WORDS_PER_TICK = 200;
    private const SENTENCES_PER_TICK = 200;
    private const WORD_BACKLOG_TARGET = 400;
    private const SENTENCE_BACKLOG_TARGET = 400;
    private const ARTICLES_PER_TICK = 50;
    private const LIBRARY_ARTICLES_PER_TICK = 50;

    private QueueCenterService $queueCenter;
    private AppQyV1ArticleSentenceAudioService $articleAudioService;
    public function __construct()
    {
        parent::__construct();
        $this->queueCenter = app(QueueCenterService::class);
        $this->articleAudioService = new AppQyV1ArticleSentenceAudioService($this->queueCenter);
    }

    public function getName(): string
    {
        return 'queue_center_audio_scan';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function isEnabled(): bool
    {
        return (bool) app(UserConfigService::class)->get(UserConfigService::QUEUE_CENTER_AUDIO_SCAN, true);
    }

    public function exec(): void
    {
        $wordsCreated = $this->scanWords();
        $sentencesCreated = $this->scanSentences();
        $articlesCreated = $this->scanArticles();
        $libraryArticlesCreated = $this->scanLibraryArticles();

        if ($wordsCreated + $sentencesCreated + $articlesCreated + $libraryArticlesCreated > 0) {
            $this->logInfo('Queue center audio scan enqueued tasks', [
                'word_audio' => $wordsCreated,
                'sentence_audio' => $sentencesCreated,
                'article_sentence_audio' => $articlesCreated,
                'library_article_sentence_audio' => $libraryArticlesCreated,
            ]);
        }
    }

    /**
     * Enqueue word_audio tasks for dictionary rows missing audio.
     *
     * @return int Number of NEW tasks created (dedup skips are not counted)
     */
    private function scanWords(): int
    {
        $cataloged = 0;
        $loaded = 0;
        $created = 0;
        $hasCapacity = $this->hasQueueCapacity(
            QueueCenterService::QUEUE_WORD_AUDIO,
            self::WORD_BACKLOG_TARGET
        );

        foreach ($this->rotatedLanguages(AppQyV1DictionaryTTSCoordinator::supportedLanguages()) as $lang) {
            if ($cataloged >= self::WORDS_PER_TICK && (!$hasCapacity || $loaded >= self::WORDS_PER_TICK)) {
                break;
            }

            try {
                $model = AppQyV1LangDictionaryModel::forLanguage($lang)->getModel();
                if (!$model->diffIdTableExists()) {
                    continue;
                }
                $scope = QueueCenterService::QUEUE_WORD_AUDIO . ':' . $lang . ':' . $model->getTable();
                if ($cataloged < self::WORDS_PER_TICK) {
                    $discovery = $this->diffIds->discover(
                        $scope,
                        $model,
                        self::WORDS_PER_TICK - $cataloged
                    );
                    $cataloged += (int) ($discovery['cataloged'] ?? 0);
                }
                if (!$hasCapacity || $loaded >= self::WORDS_PER_TICK) {
                    continue;
                }
                $page = $this->diffIds->pendingPage($scope);
                $ids = is_array($page['ids'] ?? null) ? $page['ids'] : [];
                if ($ids === []) {
                    continue;
                }
                $loaded += count($ids);
                $rows = $this->diffIds->materialize(
                    $scope,
                    (int) ($page['page'] ?? 0),
                    $ids,
                    static fn (array $pageIds): array => AppQyV1LangDictionaryModel::pendingTtsRowsByIds(
                        $lang,
                        $pageIds,
                        AppQyV1DictionaryTTSCoordinator::STATUS_PENDING,
                        AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS,
                        AppQyV1DictionaryTTSCoordinator::LOCK_STALE_MINUTES,
                        AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES,
                        AppQyV1DictionaryTTSCoordinator::ASSIST_WORKER_PREFIX
                    )
                );
            } catch (\Throwable $e) {
                $this->logWarning('Word scan skipped language', [
                    'language' => $lang,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            $pageFailed = false;
            foreach ($rows as $row) {
                $word = trim((string) ($row->content ?? ''));
                if ($word === '') {
                    continue;
                }
                $md5 = (string) ($row->md5 ?? '') !== '' ? (string) $row->md5 : md5($word);

                try {
                    $result = $this->queueCenter->enqueue(
                        QueueCenterService::QUEUE_WORD_AUDIO,
                        [
                            'word' => $word,
                            'language' => $lang,
                            'md5' => $md5,
                            'dict_row_id' => (int) $row->id,
                        ],
                        QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_WORD_AUDIO, $lang, $md5),
                        [
                            'dict_row_id' => (int) $row->id,
                            'dict_language' => $lang,
                            'dict_row_table' => $model->getTable(),
                        ],
                        300
                    );
                    if ($result['created']) {
                        $created++;
                    }
                } catch (\Throwable $e) {
                    $pageFailed = true;
                    $this->logWarning('Word enqueue failed', [
                        'language' => $lang,
                        'md5' => $md5,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
            if (!$pageFailed) {
                $this->diffIds->consume($scope, (int) ($page['page'] ?? 0), $ids);
            }
        }

        return $created;
    }

    /**
     * Enqueue sentence_audio tasks for sentence rows with has_audio=false.
     *
     * @return int Number of NEW tasks created (dedup skips are not counted)
     */
    private function scanSentences(): int
    {
        $cataloged = 0;
        $loaded = 0;
        $created = 0;
        $hasCapacity = $this->hasQueueCapacity(
            QueueCenterService::QUEUE_SENTENCE_AUDIO,
            self::SENTENCE_BACKLOG_TARGET
        );

        foreach ($this->rotatedLanguages(AppQyV1TableMaps::getSupportedLanguages()) as $lang) {
            if ($cataloged >= self::SENTENCES_PER_TICK && (!$hasCapacity || $loaded >= self::SENTENCES_PER_TICK)) {
                break;
            }

            try {
                $model = LangSentence::for($lang);
                if (!$model->diffIdTableExists()) {
                    continue;
                }
                $scope = QueueCenterService::QUEUE_SENTENCE_AUDIO . ':' . $lang . ':' . $model->getTable();
                if ($cataloged < self::SENTENCES_PER_TICK) {
                    $discovery = $this->diffIds->discover(
                        $scope,
                        $model,
                        self::SENTENCES_PER_TICK - $cataloged
                    );
                    $cataloged += (int) ($discovery['cataloged'] ?? 0);
                }
                if (!$hasCapacity || $loaded >= self::SENTENCES_PER_TICK) {
                    continue;
                }
                $page = $this->diffIds->pendingPage($scope);
                $ids = is_array($page['ids'] ?? null) ? $page['ids'] : [];
                if ($ids === []) {
                    continue;
                }
                $loaded += count($ids);
                $rows = $this->diffIds->materialize(
                    $scope,
                    (int) ($page['page'] ?? 0),
                    $ids,
                    static fn (array $pageIds): array => LangSentence::pendingAudioRowsByIds(
                        $lang,
                        $pageIds
                    )
                );
                $excludedContentIds = AppQyV1SourceSentenceModel::contentIdsExclusiveToAgentHistory(
                    $lang,
                    array_map(static fn ($row): string => (string) ($row->content_id ?? ''), $rows)
                );
            } catch (\Throwable $e) {
                $this->logWarning('Sentence scan skipped language', [
                    'language' => $lang,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            $pageFailed = false;
            $excludedContentIdMap = array_fill_keys($excludedContentIds, true);
            foreach ($rows as $row) {
                $contentId = trim((string) ($row->content_id ?? ''));
                $text = trim((string) ($row->text ?? ''));
                if ($contentId === '' || $text === '' || isset($excludedContentIdMap[$contentId])) {
                    continue;
                }

                try {
                    $result = $this->queueCenter->enqueue(
                        QueueCenterService::QUEUE_SENTENCE_AUDIO,
                        [
                            'text' => $text,
                            'language' => $lang,
                            'content_id' => $contentId,
                        ],
                        QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_SENTENCE_AUDIO, $lang, $contentId),
                        [],
                        120
                    );
                    if ($result['created']) {
                        $created++;
                    }
                } catch (\Throwable $e) {
                    $pageFailed = true;
                    $this->logWarning('Sentence enqueue failed', [
                        'language' => $lang,
                        'content_id' => $contentId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
            if (!$pageFailed) {
                $this->diffIds->consume($scope, (int) ($page['page'] ?? 0), $ids);
            }
        }

        return $created;
    }

    private function scanArticles(): int
    {
        $created = 0;
        $scope = 'article_sentence_audio:' . (new AppQyV1Article())->getTable();

        try {
            $page = $this->rowsForPendingPage(
                $scope,
                new AppQyV1Article(),
                self::ARTICLES_PER_TICK,
                static fn (array $ids): array => AppQyV1Article::sentenceAudioQueueRowsByIds($ids)
            );
        } catch (\Throwable $e) {
            $this->logWarning('Article scan skipped', ['error' => $e->getMessage()]);
            return 0;
        }

        $pageFailed = false;
        foreach ($page['rows'] as $row) {
            try {
                $result = $this->articleAudioService->enqueueArticle(
                    $row,
                    false,
                    $row->sentenceAudioScope()
                );
                if ($result['created'] ?? false) {
                    $created++;
                }
            } catch (\Throwable $e) {
                $pageFailed = true;
                $this->logWarning('Article sentence-audio enqueue failed', [
                    'article_id' => $row->article_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        if (!$pageFailed) {
            $this->consumePendingPage($scope, $page);
        }

        return $created;
    }

    private function scanLibraryArticles(): int
    {
        $processed = 0;
        $created = 0;

        foreach ($this->rotatedLanguages(AppQyV1TableMaps::getSupportedLanguages()) as $lang) {
            if ($processed >= self::LIBRARY_ARTICLES_PER_TICK) {
                break;
            }

            try {
                $model = AppQyV1ArticleLibraryModel::forLanguage($lang);
                if (!$model->diffIdTableExists()) {
                    continue;
                }
                $scope = 'library_article_sentence_audio:' . $lang . ':' . $model->getTable();
                $page = $this->rowsForPendingPage(
                    $scope,
                    $model,
                    self::LIBRARY_ARTICLES_PER_TICK - $processed,
                    static fn (array $ids): array => AppQyV1ArticleLibraryModel::pendingSentenceAudioRowsByIds(
                        $lang,
                        $ids
                    )
                );
            } catch (\Throwable $e) {
                $this->logWarning('Library article scan skipped language', [
                    'language' => $lang,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            $pageFailed = false;
            foreach ($page['rows'] as $row) {
                $processed++;
                try {
                    $result = $this->articleAudioService->enqueueLibraryArticle($row, $lang, false);
                    if ($result['created'] ?? false) {
                        $created++;
                    }
                } catch (\Throwable $e) {
                    $pageFailed = true;
                    $this->logWarning('Library article sentence-audio enqueue failed', [
                        'language' => $lang,
                        'md5' => $row->md5,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
            if (!$pageFailed) {
                $this->consumePendingPage($scope, $page);
            }
        }

        return $created;
    }

    private function hasQueueCapacity(string $taskType, int $target): bool
    {
        $target = max(1, $target);
        $hasTargetBacklog = GlobalTask::hasBacklogAtLeast(
            $taskType,
            QueueCenterContract::taskStatuses('live'),
            $target
        );

        return !$hasTargetBacklog;
    }

    /** @param array<int,string> $languages */
    private function rotatedLanguages(array $languages): array
    {
        $languages = array_values($languages);
        $count = count($languages);
        if ($count < 2) {
            return $languages;
        }

        $offset = intdiv(now()->getTimestamp(), $this->getInterval()) % $count;
        return array_merge(array_slice($languages, $offset), array_slice($languages, 0, $offset));
    }
}
