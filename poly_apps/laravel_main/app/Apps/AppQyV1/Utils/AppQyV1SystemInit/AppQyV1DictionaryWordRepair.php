<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel as Dictionary;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PerLanguageMetricsModel as PerLanguage;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Support\QueueProgress;
use Illuminate\Support\Facades\DB;

/**
 * sys:init self-heal of dictionary words stored with HTML entities
 * (`wretch&#39;s`), the rows the import normalizer (Dictionary::canonicalWord)
 * now keeps out. Idempotent and non-destructive, keyset walk per language:
 * - the canonical word is added when absent (it enters the gap lanes as a new
 *   unchecked word);
 * - the entity row is kept and marked invalid (validity_source "normalize"),
 *   so it leaves the audio gap and the translation work; re-runs skip it.
 */
final class AppQyV1DictionaryWordRepair
{
    public const VALIDITY_SOURCE = 'normalize';
    private const CHUNK = 500;
    private const NOTE_DECODED = 'html_entity_decoded';
    private const NOTE_REJECTED = 'html_entity_rejected';

    /** @return array<string,int> language => entity rows still to repair (one UNION ALL) */
    public function scan(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

        return PerLanguage::countByLanguage($connection, $this->tables($connection), $this->pendingSql(), [Dictionary::entityContentPattern(), self::VALIDITY_SOURCE]);
    }

    /**
     * @return array{rows:int,created:int,rejected:int,languages:array<string,int>,progress:array}
     */
    public function repair(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $pending = $this->scan();
        $result = ['rows' => 0, 'created' => 0, 'rejected' => 0, 'languages' => $pending];
        $cursor = 0;

        foreach ($pending as $language => $count) {
            $cursor = 0;
            do {
                $rows = DB::connection($connection)->table(AppQyV1TableMaps::getDictionaryTableName($language))
                    ->whereRaw($this->pendingSql(), [Dictionary::entityContentPattern(), self::VALIDITY_SOURCE])
                    ->where('id', '>', $cursor)
                    ->orderBy('id')
                    ->limit(self::CHUNK)
                    ->get(['id', 'content']);
                if ($rows->isEmpty()) {
                    break;
                }
                $result = $this->repairChunk($connection, (string) $language, $rows->all(), $result);
                $cursor = (int) $rows->last()->id;
            } while ($rows->count() === self::CHUNK);
        }
        $result['progress'] = QueueProgress::make($result['rows'] - $result['rejected'], $result['rejected'], 0, $cursor);

        return $result;
    }

    private function repairChunk(string $connection, string $language, array $rows, array $result): array
    {
        $canonical = [];
        $decodedIds = [];
        $rejectedIds = [];
        $now = now();

        foreach ($rows as $row) {
            $word = Dictionary::canonicalWord((string) $row->content);
            if ($word === null) {
                $rejectedIds[] = (int) $row->id;
                continue;
            }
            $canonical[] = $word;
            $decodedIds[] = (int) $row->id;
        }
        if ($canonical !== []) {
            $result['created'] += Dictionary::ensureContents($language, $canonical)['created'];
        }
        foreach ([self::NOTE_DECODED => $decodedIds, self::NOTE_REJECTED => $rejectedIds] as $note => $ids) {
            if ($ids === []) {
                continue;
            }
            DB::connection($connection)->table(AppQyV1TableMaps::getDictionaryTableName($language))
                ->whereIn('id', $ids)
                ->update([
                    'is_valid' => false,
                    'validity_checked_at' => $now,
                    'validity_source' => self::VALIDITY_SOURCE,
                    'validity_note' => $note,
                    'updated_at' => $now,
                ]);
        }
        $result['rows'] += count($rows);
        $result['rejected'] += count($rejectedIds);
        Dictionary::forgetMetricsCache($language);

        return $result;
    }

    private function pendingSql(): string
    {
        return 'content ~ ? AND validity_source IS DISTINCT FROM ?';
    }

    /** @return array<string,string> language => existing dictionary table */
    private function tables(string $connection): array
    {
        $tables = [];

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $tables[$language] = AppQyV1TableMaps::getDictionaryTableName($language);
        }

        return PerLanguage::requireColumns($connection, $tables, ['content', 'is_valid', 'validity_source', 'validity_note']);
    }
}
