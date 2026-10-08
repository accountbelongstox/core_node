<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Services\WorkLeases\WorkLeaseService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Log;

/**
 * sys:init self-heal of the sentence quality floor (queue_center_contract
 * work_leases.sentence_quality.accepted_engines_by_language). Only floor
 * languages are swept: sentence audio of a floor language whose recorded
 * provider is not one of its engines is not final and returns to the pool
 * (has_audio false, file kept; the next accepted report replaces it). Other
 * languages accept any engine and are never touched (otherwise their CPU
 * clips would be regenerated forever). Rows with audio but no recorded
 * provider are only counted. Idempotent.
 */
final class AppQyV1SentenceQualityRepair
{
    private const PROVIDER = "(metadata::jsonb ->> 'audio_provider')";

    /** @return array{requeued:int,unknown_provider:int,by_provider:array<string,int>} */
    public function run(): array
    {
        $result = ['requeued' => 0, 'unknown_provider' => 0, 'by_provider' => []];
        $floorLanguages = QueueCenterContract::sentenceFloorLanguages();

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $accepted = QueueCenterContract::sentenceFloorEngines((string) $language);
            if ($accepted === null || !in_array(strtolower((string) $language), $floorLanguages, true)) {
                continue;
            }
            try {
                $db = LangSentence::for($language)->getConnection();
                $table = '"' . AppQyV1TableMaps::getSentenceTableName($language) . '"';
                foreach ($db->select("SELECT COALESCE(lower(" . self::PROVIDER . "), '') AS provider, count(*) AS rows FROM {$table} WHERE has_audio IS TRUE GROUP BY 1") as $row) {
                    $provider = (string) $row->provider;
                    if ($provider === '') {
                        $result['unknown_provider'] += (int) $row->rows;
                    } elseif (!in_array($provider, $accepted, true)) {
                        $result['by_provider'][$language . ':' . $provider] = (int) $row->rows;
                    }
                }
                if ($accepted === []) {
                    continue;
                }
                $result['requeued'] += $db->update(
                    "UPDATE {$table} SET has_audio = FALSE, tts_status = 'pending', tts_attempts = 0, tts_error = NULL, "
                    . 'tts_lease_id = NULL, tts_lease_expires_at = NULL, tts_locked_by = NULL, tts_locked_at = NULL'
                    . " WHERE has_audio IS TRUE AND COALESCE(" . self::PROVIDER . ", '') <> '' AND lower(" . self::PROVIDER . ') NOT IN (' . implode(',', array_fill(0, count($accepted), '?')) . ')',
                    $accepted
                );
            } catch (\Throwable $e) {
                Log::warning('[SentenceQuality] repair skipped language', ['language' => $language, 'error' => $e->getMessage()]);
            }
        }
        Log::info('[SentenceQuality] low-quality sentence audio returned to the pool', $result);

        return $result;
    }
}
