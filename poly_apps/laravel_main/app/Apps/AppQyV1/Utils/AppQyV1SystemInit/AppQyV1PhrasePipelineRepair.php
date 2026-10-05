<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1PhraseTableSchema;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangPhraseModel as LangPhrase;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Support\AudioOrchestrationContract;
use Illuminate\Support\Facades\Log;

/**
 * sys:init step of the phrase pipeline (docs_fix/DESIGN_PHRASE_PIPELINE.md §4).
 * Idempotent and add-only:
 * - aligns every language's phrase and link tables and their partial indexes
 *   (the sentence phrase columns/indexes come with the sentence alignment);
 * - returns failed phrase extractions to the gap with a fresh attempt budget;
 * - releases expired phrase-extraction leases;
 * - logs the extraction and phrase-audio gaps of the phrase_pipeline languages.
 * The prompt row is seeded by the seed_ai_prompts step.
 */
final class AppQyV1PhrasePipelineRepair
{
    /**
     * @return array{tables:array<string,string>,errors:int,repooled:int,released:int,gaps:array<string,array{sentences:int,phrase_audio:int}>}
     */
    public function run(): array
    {
        $result = ['tables' => AppQyV1PhraseTableSchema::ensureAll(), 'errors' => 0, 'repooled' => 0, 'released' => 0, 'gaps' => []];
        $languages = array_values(array_unique(array_map(
            static fn ($language): string => AppQyV1TableMaps::normalizeLangCode((string) $language),
            (array) AudioOrchestrationContract::phrasePipeline('languages')
        )));

        foreach ($result['tables'] as $status) {
            if (str_starts_with((string) $status, 'error:')) {
                $result['errors']++;
            }
        }
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            try {
                $result['repooled'] += LangSentence::repoolFailedPhrases($language);
                $result['released'] += LangSentence::clearExpiredPhraseLeases($language);
            } catch (\Throwable $e) {
                $result['errors']++;
                Log::warning('[AppQyV1PhrasePipelineRepair] sentence phrase state not repaired', ['language' => $language, 'error' => $e->getMessage()]);
            }
        }
        foreach ($languages as $language) {
            try {
                $result['gaps'][$language] = [
                    'sentences' => LangSentence::pendingPhraseCount($language),
                    'phrase_audio' => LangPhrase::pendingAudioCount($language),
                ];
            } catch (\Throwable $e) {
                $result['errors']++;
                Log::warning('[AppQyV1PhrasePipelineRepair] gap count failed', ['language' => $language, 'error' => $e->getMessage()]);
            }
        }
        Log::info('[AppQyV1PhrasePipelineRepair] phrase pipeline aligned', [
            'tables' => count($result['tables']),
            'errors' => $result['errors'],
            'repooled' => $result['repooled'],
            'released' => $result['released'],
            'gaps' => $result['gaps'],
        ]);

        return $result;
    }
}
