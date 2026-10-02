<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Models\GlobalTask;
use App\Services\QueueCenter\QueueCenterService;

/**
 * sys:init self-heal of the sentence library's sources. Idempotent and
 * non-destructive:
 * - agent-history articles mapped into the library earlier (they are not
 *   content; MediaIngestService now rejects them) have their live slots moved
 *   to the obsolete grains, and their sentence rows no live slot references any
 *   more get obsolete_at;
 * - legacy rows (origin IS NULL) are classified once: referenced rows become
 *   content, unreferenced playback-resolver rows become ad-hoc;
 * - live sentence_audio tasks of rows that left the library are cancelled.
 */
final class AppQyV1SentenceOriginRepair
{
    private const LOOKUP_CHUNK = 500;
    private const ARTICLE_CHUNK = 200;

    /** @return array{agent_sources:int,retired_slots:int,obsolete:int,content:int,adhoc:int,cancelled_tasks:int} */
    public function run(): array
    {
        $result = ['agent_sources' => 0, 'retired_slots' => 0, 'obsolete' => 0, 'content' => 0, 'adhoc' => 0, 'cancelled_tasks' => 0];
        $agentRows = [];

        AppQyV1ArticleModel::chunkAgentHistoryArticleIds(self::ARTICLE_CHUNK, function (array $articleIds) use (&$result, &$agentRows): void {
            foreach ($articleIds as $articleId) {
                $referenced = SourceSentence::liveContentIdsOfSource('article', $articleId);
                if ($referenced === []) {
                    continue;
                }
                $result['agent_sources']++;
                $result['retired_slots'] += SourceSentence::retireLiveSlots('article', $articleId)['moved'];
                foreach ($referenced as $language => $contentIds) {
                    $agentRows[$language] = array_merge($agentRows[$language] ?? [], $contentIds);
                }
            }
        });
        foreach ($agentRows as $language => $contentIds) {
            $retired = $this->unreferenced((string) $language, array_values(array_unique($contentIds)));
            $result['obsolete'] += LangSentence::markObsolete((string) $language, $retired);
            $result['cancelled_tasks'] += $this->cancelTasks((string) $language, $retired);
        }
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $classified = LangSentence::classifyLegacyOrigins($language);
            $result['content'] += $classified['content'];
            $result['adhoc'] += count($classified['adhoc']);
            $result['cancelled_tasks'] += $this->cancelTasks($language, $classified['adhoc']);
        }

        return $result;
    }

    /** @return array<int,string> */
    private function unreferenced(string $language, array $contentIds): array
    {
        $stillLive = [];

        foreach (array_chunk($contentIds, self::LOOKUP_CHUNK) as $chunk) {
            $stillLive += SourceSentence::liveReferencedContentIds($language, $chunk);
        }

        return array_values(array_filter($contentIds, static fn (string $contentId): bool => !isset($stillLive[$contentId])));
    }

    private function cancelTasks(string $language, array $contentIds): int
    {
        $cancelled = 0;

        foreach (array_chunk($contentIds, self::LOOKUP_CHUNK) as $chunk) {
            $groupKeys = array_map(
                static fn (string $contentId): string => QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_SENTENCE_AUDIO, $language, $contentId),
                $chunk
            );
            foreach (GlobalTask::liveTaskIdsByGroupKeys(QueueCenterService::QUEUE_SENTENCE_AUDIO, $groupKeys) as $taskId) {
                if (app(QueueCenterService::class)->cancel($taskId) === 'cancelled') {
                    $cancelled++;
                }
            }
        }

        return $cancelled;
    }
}
