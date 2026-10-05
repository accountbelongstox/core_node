<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SentencePhraseModel as SentencePhrase;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Support\AudioOrchestrationContract;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phrases of sentences (queue_center_contract endpoint phrases_by_sentences,
 * docs_fix/DESIGN_PHRASE_PIPELINE.md section 5): per requested sentence its
 * extraction status and its phrases (link order) with audio state and clip
 * version. Pending sentences are raised in the extraction queue, so the
 * extraction timer works the sentences a reader asks for first.
 */
final class AppQyV1PhraseLookupService
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_DONE = 'done';
    public const STATUS_NONE = 'none';
    public const STATUS_FAILED = 'failed';
    public const STATUS_UNKNOWN = 'unknown';

    private const PHRASE_STATUS_COLUMN = 'phrase_status';
    private const TERMINAL_STATUSES = [self::STATUS_DONE, self::STATUS_NONE, self::STATUS_FAILED];

    /** @var array<string,true> sentence tables known to carry the phrase columns (columns are add-only) */
    private static array $phraseReady = [];

    private ConnectionInterface $db;

    public function __construct()
    {
        $this->db = DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1));
    }

    /**
     * @param array<int,string> $contentIds sentence content ids, request order
     * @return array<int,array{content_id:string,status:string,phrases:array<int,array{content_id:string,text:string,meaning:?string,has_audio:bool,version:?int}>}>
     */
    public function bySentences(string $language, array $contentIds): array
    {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        $unique = array_values(array_unique(array_map('strval', $contentIds)));
        $sentences = $this->sentences($language, $unique);
        $phrases = $sentences === [] ? [] : $this->phrases($language, array_keys($sentences));
        $pending = [];
        $items = [];

        foreach ($sentences as $contentId => $sentence) {
            if ($sentence['status'] === self::STATUS_PENDING && !isset($phrases[$contentId])) {
                $pending[] = $contentId;
            }
        }
        $this->raisePending($language, $pending);
        foreach ($contentIds as $contentId) {
            $contentId = (string) $contentId;
            $status = $sentences[$contentId]['status'] ?? self::STATUS_UNKNOWN;
            if ($status === self::STATUS_PENDING && isset($phrases[$contentId])) {
                $status = self::STATUS_DONE;
            }
            $items[] = [
                'content_id' => $contentId,
                'status' => $status,
                'phrases' => $phrases[$contentId] ?? [],
            ];
        }

        return $items;
    }

    /**
     * Raises pending sentences (phrase_status NULL, live) of one language to
     * $priority in the extraction queue; never lowers a higher priority.
     *
     * @param array<int,string> $contentIds
     */
    public function raisePending(string $language, array $contentIds, ?int $priority = null): int
    {
        $table = AppQyV1TableMaps::getSentenceTableName($language);
        $priority ??= (int) AudioOrchestrationContract::bookPlan('head_priority');

        if ($contentIds === [] || !$this->phraseReady($table)) {
            return 0;
        }

        return $this->db->table($table)
            ->whereIn('content_id', $contentIds)
            ->whereRaw(AppQyV1MediaGaps::SENTENCE_PHRASES)
            ->where('phrase_priority', '<', $priority)
            ->update(['phrase_priority' => $priority]);
    }

    /**
     * @param array<int,string> $contentIds
     * @return array<string,array{status:string}> existing sentences by content id
     */
    private function sentences(string $language, array $contentIds): array
    {
        $table = AppQyV1TableMaps::getSentenceTableName($language);
        $rows = [];

        if ($contentIds === [] || !AppQyV1TableMaps::isLanguageSupported($language) || !Schema::connection($this->db->getName())->hasTable($table)) {
            return [];
        }
        $ready = $this->phraseReady($table);
        $columns = $ready
            ? ['content_id', self::PHRASE_STATUS_COLUMN, $this->db->raw('(' . AppQyV1MediaGaps::SENTENCE_LIVE . ') AS live')]
            : ['content_id'];
        foreach ($this->db->table($table)->whereIn('content_id', $contentIds)->get($columns) as $row) {
            $rows[(string) $row->content_id] = ['status' => $ready ? $this->status($row) : self::STATUS_PENDING];
        }

        return $rows;
    }

    /** A sentence that is not live (retired, adhoc) is never extracted: it reports none instead of pending forever. */
    private function status(object $row): string
    {
        $status = $row->{self::PHRASE_STATUS_COLUMN};

        if (in_array($status, self::TERMINAL_STATUSES, true)) {
            return (string) $status;
        }

        return (bool) $row->live ? self::STATUS_PENDING : self::STATUS_NONE;
    }

    /**
     * @param array<int,string> $sentenceIds
     * @return array<string,array<int,array{content_id:string,text:string,meaning:?string,has_audio:bool,version:?int}>>
     */
    private function phrases(string $language, array $sentenceIds): array
    {
        $phrases = [];

        foreach (SentencePhrase::phrasesForSentences($language, $sentenceIds) as $sentenceId => $rows) {
            foreach ($rows as $row) {
                $version = $row['has_audio'] ? AppQyV1PhraseClipLocator::fileVersion($language, $row['content_id']) : null;
                $phrases[(string) $sentenceId][] = [
                    'content_id' => $row['content_id'],
                    'text' => $row['text'],
                    'meaning' => $row['meaning'],
                    'has_audio' => $version !== null,
                    'version' => $version,
                ];
            }
        }

        return $phrases;
    }

    private function phraseReady(string $table): bool
    {
        if (isset(self::$phraseReady[$table])) {
            return true;
        }
        $schema = Schema::connection($this->db->getName());
        if ($schema->hasTable($table) && $schema->hasColumn($table, self::PHRASE_STATUS_COLUMN)) {
            self::$phraseReady[$table] = true;

            return true;
        }

        return false;
    }
}
