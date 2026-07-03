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
use App\Models\LangSentence;
use App\Models\SourceSentence;
use App\Models\StudyGrammarPoint;
use App\Models\StudyPhrase;
use App\Models\StudySegment;
use App\Services\MediaIngestService;

/**
 * Study-content generation WRITEBACK (Book Study-Content Generation pipeline §5.3
 * — development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md).
 *
 * The submit fan-out, run INSIDE the caller's single transaction (§5.3):
 *   - translations -> per-language sentence library {prefix}_sentences_{lang},
 *     idempotent insert-if-missing by content_id (existing text NEVER clobbered,
 *     occurrence_count bumped, empty sentence_id/corr_id backfilled) — the exact
 *     semantics of MediaIngestService::upsertLangSentence (which is private, so
 *     reimplemented here) using its PUBLIC content-id / sentence-id / corr-id
 *     formulas so the keys stay identical to the whole library.
 *   - slot lang_content_ids -> fill-null-only (never overwrite a correspondence).
 *   - explanations (释意) -> sentences_{lang}.explanation, fill-missing only.
 *   - short-phrase intros / grammar points -> the study batch tables.
 */
class AppQyV1StudyGenWriteback
{
    /**
     * Apply one submission's artifacts for a claimed segment. Slots whose seq is
     * outside the segment's [seq_start,seq_end] range are skipped and counted;
     * unsupported slot languages are skipped and counted. Caller wraps this in a
     * transaction and flips the segment to done.
     *
     * @param array<int,array<string,mixed>> $slots   [{seq, langs:{code:{text,explanation}}}]
     * @param array<int,array<string,mixed>> $phrases [{language, phrase, meaning}]
     * @param array<int,array<string,mixed>> $grammar [{language, point, explanation}]
     * @return array{applied:array<string,int>,languages_done:array<int,string>}
     */
    public function apply(StudySegment $segment, array $slots, array $phrases, array $grammar): array
    {
        $counters = [
            'sentences_inserted' => 0,
            'sentences_existing' => 0,
            'lang_links_filled' => 0,
            'explanations_filled' => 0,
            'phrases_saved' => 0,
            'grammar_saved' => 0,
            'skipped_out_of_range' => 0,
            'skipped_unsupported_lang' => 0,
        ];
        $languagesDone = [];

        $sourceType = (string) $segment->source_type;
        $sourceKey = (string) $segment->source_key;
        $grain = (string) $segment->grain;
        $segmentIndex = (int) $segment->segment_index;
        $seqStart = (int) $segment->seq_start;
        $seqEnd = (int) $segment->seq_end;

        foreach ($slots as $slot) {
            if (!is_array($slot) || !isset($slot['seq'])) {
                continue;
            }
            $seq = (int) $slot['seq'];
            if ($seq < $seqStart || $seq > $seqEnd) {
                $counters['skipped_out_of_range']++;
                continue;
            }

            $langs = (isset($slot['langs']) && is_array($slot['langs'])) ? $slot['langs'] : [];
            if (empty($langs)) {
                continue;
            }

            // The language-independent slot row carries lang_content_ids + corr_id.
            $link = SourceSentence::query()
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where('grain', $grain)
                ->where('seq', $seq)
                ->first();

            $linkMap = ($link && is_array($link->lang_content_ids)) ? $link->lang_content_ids : [];
            $linkChanged = false;
            $corrId = ($link && !empty($link->corr_id))
                ? (string) $link->corr_id
                : MediaIngestService::computeCorrId($sourceKey, $grain, $seq);

            foreach ($langs as $lang => $payload) {
                $code = AppQyV1TableMaps::normalizeLangCode((string) $lang);
                if ($code === '' || !AppQyV1TableMaps::isLanguageSupported($code)) {
                    $counters['skipped_unsupported_lang']++;
                    continue;
                }

                $text = '';
                $explanation = null;
                if (is_array($payload)) {
                    $text = isset($payload['text']) ? (string) $payload['text'] : '';
                    $explanation = (isset($payload['explanation']) && trim((string) $payload['explanation']) !== '')
                        ? (string) $payload['explanation'] : null;
                } elseif (is_string($payload)) {
                    $text = $payload;
                }
                if (trim($text) === '') {
                    // No text -> nothing to key the sentence row on (explanation
                    // lives on that row); the slot stays留空 for this language.
                    continue;
                }

                $contentId = MediaIngestService::computeContentId($text);
                $this->upsertSentence($code, $contentId, $text, $corrId, $explanation, $counters);
                $languagesDone[$code] = true;

                // Slot correspondence: fill ONLY when currently null/missing.
                if (empty($linkMap[$code])) {
                    $linkMap[$code] = $contentId;
                    $linkChanged = true;
                    $counters['lang_links_filled']++;
                }
            }

            if ($link && $linkChanged) {
                $link->lang_content_ids = $linkMap;
                $link->save();
            }
        }

        // Short-phrase introductions.
        foreach ($phrases as $phrase) {
            if (!is_array($phrase)) {
                continue;
            }
            $code = AppQyV1TableMaps::normalizeLangCode((string) ($phrase['language'] ?? ''));
            $text = trim((string) ($phrase['phrase'] ?? ''));
            if ($code === '' || !AppQyV1TableMaps::isLanguageSupported($code) || $text === '') {
                continue;
            }
            StudyPhrase::create([
                'segment_id' => (int) $segment->id,
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'segment_index' => $segmentIndex,
                'language' => $code,
                'phrase' => $text,
                'meaning' => (isset($phrase['meaning']) && trim((string) $phrase['meaning']) !== '') ? (string) $phrase['meaning'] : null,
            ]);
            $counters['phrases_saved']++;
        }

        // Grammar points.
        foreach ($grammar as $point) {
            if (!is_array($point)) {
                continue;
            }
            $code = AppQyV1TableMaps::normalizeLangCode((string) ($point['language'] ?? ''));
            $label = trim((string) ($point['point'] ?? ''));
            if ($code === '' || !AppQyV1TableMaps::isLanguageSupported($code) || $label === '') {
                continue;
            }
            StudyGrammarPoint::create([
                'segment_id' => (int) $segment->id,
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'segment_index' => $segmentIndex,
                'language' => $code,
                'point' => $label,
                'explanation' => (isset($point['explanation']) && trim((string) $point['explanation']) !== '') ? (string) $point['explanation'] : null,
            ]);
            $counters['grammar_saved']++;
        }

        return [
            'applied' => $counters,
            'languages_done' => array_keys($languagesDone),
        ];
    }

    /**
     * Upsert one sentence into {prefix}_sentences_{lang} by content_id
     * (MediaIngestService::upsertLangSentence semantics) plus the fill-missing
     * explanation write. Mutates $counters in place.
     *
     * @param array<string,int> $counters
     */
    private function upsertSentence(string $code, string $contentId, string $text, string $corrId, ?string $explanation, array &$counters): void
    {
        $row = LangSentence::onLang($code)->where('content_id', $contentId)->first();

        if (!$row) {
            $model = LangSentence::for($code);
            $model->fill([
                'content_id' => $contentId,
                'sentence_id' => MediaIngestService::computeSentenceId($text, $code),
                'corr_id' => $corrId,
                'text' => $text,
                'language' => $code,
                'occurrence_count' => 1,
            ]);
            if ($explanation !== null) {
                $model->explanation = $explanation;
                $counters['explanations_filled']++;
            }
            $model->save();
            $counters['sentences_inserted']++;
            return;
        }

        // Existing: never clobber text/AI/audio. Bump occurrence_count; backfill
        // empty sentence_id/corr_id; fill explanation only when currently empty.
        $counters['sentences_existing']++;
        if ($this->isEmpty($row->getAttribute('sentence_id'))) {
            $row->setAttribute('sentence_id', MediaIngestService::computeSentenceId($text, $code));
        }
        if ($this->isEmpty($row->getAttribute('corr_id')) && $corrId !== '') {
            $row->setAttribute('corr_id', $corrId);
        }
        if ($explanation !== null && $this->isEmpty($row->getAttribute('explanation'))) {
            $row->setAttribute('explanation', $explanation);
            $counters['explanations_filled']++;
        }
        $row->occurrence_count = (int) $row->occurrence_count + 1;
        $row->save();
    }

    /** Empty test for the fill-missing rule (null / whitespace-only string). */
    private function isEmpty($value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value) && trim($value) === '') {
            return true;
        }
        return false;
    }
}
