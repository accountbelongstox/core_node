<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Support\AudioOrchestrationContract;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent store of one phrase-extraction batch (docs_fix/DESIGN_PHRASE_PIPELINE.md §3).
 *
 * Phrases upsert by content_id (fill-missing: meaning, source_model; audio
 * columns never touched), links upsert by (sentence, phrase), sentence_count is
 * recomputed for the touched phrases, and each batch sentence leaves the
 * phrase lease: done (>= 1 phrase), none (answer listed it without a valid
 * phrase) or one more phrase_attempt (missing from the answer; failed after
 * max_attempts).
 */
final class AppQyV1PhraseWriter
{
    public const STATUS_DONE = 'done';
    public const STATUS_NONE = 'none';
    public const STATUS_FAILED = 'failed';
    public const ORIGIN_AI = 'ai';

    private const SOURCE_MODEL_MAX_CHARS = 120;

    /**
     * @param array<int, array{n:int, content_id:string, text:string}> $sentences the batch
     * @param array<int, array<int, array{content_id:string, text:string, meaning:?string}>> $items parser items keyed by n
     * @param bool $chargeMissing false when the answer was cut off: the sentences it did not reach go back to the pool without an attempt
     * @return array{done:int, none:int, missing:int, phrases:int, links:int}
     */
    public function store(string $language, array $sentences, array $items, ?string $sourceModel, bool $chargeMissing = true): array
    {
        $language = strtolower($language);
        $now = now();
        $phraseRows = [];
        $linkRows = [];
        $done = [];
        $none = [];
        $missing = [];
        $model = $sourceModel !== null && trim($sourceModel) !== '' ? mb_substr(trim($sourceModel), 0, self::SOURCE_MODEL_MAX_CHARS) : null;

        foreach ($sentences as $sentence) {
            $n = (int) $sentence['n'];
            $sentenceId = (string) $sentence['content_id'];
            if (!array_key_exists($n, $items)) {
                $missing[] = $sentenceId;
                continue;
            }
            if ($items[$n] === []) {
                $none[] = $sentenceId;
                continue;
            }
            $done[] = $sentenceId;
            foreach (array_values($items[$n]) as $ord => $phrase) {
                $phraseRows[$phrase['content_id']] ??= [
                    'content_id' => $phrase['content_id'],
                    'text' => $phrase['text'],
                    'language' => $language,
                    'meaning' => $phrase['meaning'],
                    'sentence_count' => 0,
                    'origin' => self::ORIGIN_AI,
                    'source_model' => $model,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                if ($phraseRows[$phrase['content_id']]['meaning'] === null && $phrase['meaning'] !== null) {
                    $phraseRows[$phrase['content_id']]['meaning'] = $phrase['meaning'];
                }
                $linkRows[$sentenceId . ':' . $phrase['content_id']] = [
                    'sentence_content_id' => $sentenceId,
                    'phrase_content_id' => $phrase['content_id'],
                    'ord' => $ord + 1,
                    'created_at' => $now,
                ];
            }
        }

        $connection = self::connection();
        $connection->transaction(function () use ($connection, $language, $phraseRows, $linkRows, $done, $none, $now): void {
            $this->upsertPhrases($connection, $language, array_values($phraseRows), $now);
            $this->upsertLinks($connection, $language, array_values($linkRows));
            $this->recountSentences($connection, $language, array_keys($phraseRows), $now);
            $this->finishSentences($connection, $language, $done, self::STATUS_DONE, $now);
            $this->finishSentences($connection, $language, $none, self::STATUS_NONE, $now);
        });
        if ($chargeMissing) {
            $this->recordFailure($language, $missing);
        } else {
            $this->releaseLease($language, $missing);
        }

        return [
            'done' => count($done),
            'none' => count($none),
            'missing' => count($missing),
            'phrases' => count($phraseRows),
            'links' => count($linkRows),
        ];
    }

    /**
     * One failed try for these pending sentences: phrase_attempts + 1, failed
     * at max_attempts, phrase lease cleared.
     *
     * @param array<int, string> $contentIds
     */
    public function recordFailure(string $language, array $contentIds): int
    {
        $maxAttempts = (int) AudioOrchestrationContract::phrasePipeline('extraction.max_attempts');
        $table = AppQyV1TableMaps::getSentenceTableName($language);

        if ($contentIds === []) {
            return 0;
        }

        return self::connection()->table($table)
            ->whereIn('content_id', array_values(array_unique($contentIds)))
            ->whereNull('phrase_status')
            ->update([
                'phrase_attempts' => DB::raw('COALESCE(phrase_attempts, 0) + 1'),
                'phrase_status' => DB::raw('CASE WHEN COALESCE(phrase_attempts, 0) + 1 >= ' . max(1, $maxAttempts)
                    . " THEN '" . self::STATUS_FAILED . "' ELSE NULL END"),
                'phrase_lease_id' => null,
                'phrase_lease_expires_at' => null,
                'phrase_locked_by' => null,
            ]);
    }

    /**
     * Return claimed sentences to the pool without counting an attempt.
     *
     * @param array<int, string> $contentIds
     */
    public function releaseLease(string $language, array $contentIds, ?string $leaseId = null): int
    {
        $query = null;

        if ($contentIds === []) {
            return 0;
        }
        $query = self::connection()->table(AppQyV1TableMaps::getSentenceTableName($language))
            ->whereIn('content_id', array_values(array_unique($contentIds)));
        if ($leaseId !== null) {
            $query->where('phrase_lease_id', $leaseId);
        }

        return $query->update([
            'phrase_lease_id' => null,
            'phrase_lease_expires_at' => null,
            'phrase_locked_by' => null,
        ]);
    }

    /**
     * Sentence counts by phrase_status (pending = NULL) and the phrase total of one language.
     *
     * @return array{pending:int, done:int, none:int, failed:int, leased:int, phrases:int}
     */
    public function statusCounts(string $language): array
    {
        $connection = self::connection();
        $table = AppQyV1TableMaps::getSentenceTableName($language);
        $counts = ['pending' => 0, 'done' => 0, 'none' => 0, 'failed' => 0, 'leased' => 0, 'phrases' => 0];

        foreach ($connection->table($table)->selectRaw('phrase_status, COUNT(*) AS total')->groupBy('phrase_status')->get() as $row) {
            $key = $row->phrase_status === null ? 'pending' : (string) $row->phrase_status;
            if (isset($counts[$key])) {
                $counts[$key] = (int) $row->total;
            }
        }
        $counts['leased'] = (int) $connection->table($table)->whereNull('phrase_status')->where('phrase_lease_expires_at', '>', now())->count();
        $counts['phrases'] = (int) $connection->table(AppQyV1TableMaps::getPhraseTableName($language))->count();

        return $counts;
    }

    public static function connection(): ConnectionInterface
    {
        return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1));
    }

    private function upsertPhrases(ConnectionInterface $connection, string $language, array $rows, $now): void
    {
        $table = AppQyV1TableMaps::getPhraseTableName($language);
        $existing = $connection->getQueryGrammar()->wrapTable($table);

        if ($rows === []) {
            return;
        }
        $connection->table($table)->upsert($rows, ['content_id'], [
            'meaning' => DB::raw("COALESCE(NULLIF({$existing}.meaning, ''), excluded.meaning)"),
            'source_model' => DB::raw("COALESCE(NULLIF({$existing}.source_model, ''), excluded.source_model)"),
            'origin' => DB::raw("COALESCE(NULLIF({$existing}.origin, ''), excluded.origin)"),
            'updated_at' => $now,
        ]);
    }

    private function upsertLinks(ConnectionInterface $connection, string $language, array $rows): void
    {
        if ($rows === []) {
            return;
        }
        $connection->table(AppQyV1TableMaps::getSentencePhraseTableName($language))
            ->upsert($rows, ['sentence_content_id', 'phrase_content_id'], ['ord']);
    }

    /** @param array<int, string> $phraseIds */
    private function recountSentences(ConnectionInterface $connection, string $language, array $phraseIds, $now): void
    {
        $grammar = $connection->getQueryGrammar();
        $phrases = $grammar->wrapTable(AppQyV1TableMaps::getPhraseTableName($language));
        $links = $grammar->wrapTable(AppQyV1TableMaps::getSentencePhraseTableName($language));

        if ($phraseIds === []) {
            return;
        }
        $connection->table(AppQyV1TableMaps::getPhraseTableName($language))
            ->whereIn('content_id', $phraseIds)
            ->update([
                'sentence_count' => DB::raw("(SELECT COUNT(*) FROM {$links} l WHERE l.phrase_content_id = {$phrases}.content_id)"),
                'updated_at' => $now,
            ]);
    }

    /** @param array<int, string> $contentIds */
    private function finishSentences(ConnectionInterface $connection, string $language, array $contentIds, string $status, $now): void
    {
        $query = null;

        if ($contentIds === []) {
            return;
        }
        $query = $connection->table(AppQyV1TableMaps::getSentenceTableName($language))
            ->whereIn('content_id', $contentIds);
        if ($status === self::STATUS_NONE) {
            $query->where(static fn ($q) => $q->whereNull('phrase_status')->orWhere('phrase_status', '<>', self::STATUS_DONE));
        }
        $query->update([
            'phrase_status' => $status,
            'phrase_generated_at' => $now,
            'phrase_lease_id' => null,
            'phrase_lease_expires_at' => null,
            'phrase_locked_by' => null,
        ]);
    }
}
