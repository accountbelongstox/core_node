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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1StudySegmentModel as StudySegment;

/**
 * Study-content generation SEGMENTER (Book Study-Content Generation pipeline §4 —
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md).
 *
 * Deterministic, server-side segmentation: segments are computed from the
 * language-independent source_sentences slots (ORDER BY seq), greedy-packed to a
 * ~500-char primary-language budget, closing on chapter boundaries. Segment
 * identity is stable across claims/retries/re-reads (never client-side slicing).
 *
 * Slot text (§4 step 2 / §5.2): the per-language LIBRARY text resolved from the
 * slot's lang_content_ids[primary] -> sentences_{primary}.text. The v2 dashboard
 * book punctuation reconstruction (AppQyV1MediaContentPublicController::
 * buildBookV2Content) is private and pagination-scoped (keyed by content_id via
 * book.sentence_seq, not by an arbitrary seq range), so it is NOT reusable here;
 * the contract (§5.2) explicitly permits plain library text as the alternative,
 * which is what this uses so char_count and slot text stay consistent.
 */
class AppQyV1StudyGenSegmenter
{
    public const DEFAULT_TARGET_CHARS = 500;

    /**
     * Plan (idempotent). No-op when segment rows already exist for the source
     * (returns existing totals). force=true re-plans ONLY when no segment is
     * done/generating (else error 'plan_locked'). Greedy-packs by char budget OR
     * chapter change; a segment always ends on a slot boundary; empty-text slots
     * contribute 0 chars but stay in the current segment.
     *
     * @return array{segments_total:int,planned:int,status?:string,error?:string,already_planned:bool}
     */
    public function plan(string $sourceType, string $sourceKey, bool $force, int $targetChars): array
    {
        $targetChars = $targetChars > 0 ? $targetChars : self::DEFAULT_TARGET_CHARS;

        $existingCount = StudySegment::countForSource($sourceType, $sourceKey);

        if ($existingCount > 0) {
            if (!$force) {
                return ['segments_total' => $existingCount, 'planned' => 0, 'already_planned' => true];
            }
            // force: re-planning after any content was generated would orphan the
            // phrase/grammar batches linked by segment_index — block it.
            $locked = StudySegment::hasGeneratedSourceRows($sourceType, $sourceKey);
            if ($locked) {
                return ['segments_total' => $existingCount, 'planned' => 0, 'already_planned' => true, 'error' => 'plan_locked'];
            }
            StudySegment::deleteForSource($sourceType, $sourceKey);
        }

        [$slots, $grain] = $this->loadOrderedSlots($sourceType, $sourceKey);
        if ($slots->isEmpty()) {
            return ['segments_total' => 0, 'planned' => 0, 'already_planned' => false];
        }

        $primaryLanguage = $this->resolvePrimaryLanguage($sourceType, $sourceKey, $slots);
        $textById = $this->primaryTextMap($slots, $primaryLanguage);

        $rows = $this->packSegments($sourceType, $sourceKey, $grain, $primaryLanguage, $slots, $textById, $targetChars);

        // Insert atomically. A concurrent claim that also planned would collide on
        // the (source_type,source_key,segment_index) unique key — treat that as
        // "already planned" and return the now-existing totals.
        try {
            StudySegment::createPlanRows($rows);
        } catch (\Throwable $e) {
            $total = StudySegment::countForSource($sourceType, $sourceKey);
            return ['segments_total' => $total, 'planned' => 0, 'already_planned' => true];
        }

        return ['segments_total' => count($rows), 'planned' => count($rows), 'already_planned' => false];
    }

    /**
     * Greedy pack the ordered slots into segment rows.
     *
     * @param \Illuminate\Support\Collection<int,SourceSentence> $slots
     * @param array<string,string> $textById  primary content_id -> text
     * @return array<int,array<string,mixed>> study_segments insert rows
     */
    private function packSegments(
        string $sourceType,
        string $sourceKey,
        string $grain,
        string $primaryLanguage,
        $slots,
        array $textById,
        int $targetChars
    ): array {
        $rows = [];
        $segIndex = 0;

        $startSeq = null;
        $endSeq = null;
        $firstChapter = 0;
        $chars = 0;

        $flush = function () use (&$rows, &$segIndex, &$startSeq, &$endSeq, &$firstChapter, &$chars, $sourceType, $sourceKey, $grain, $primaryLanguage, $targetChars) {
            if ($startSeq === null) {
                return;
            }
            $rows[] = [
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'segment_index' => $segIndex,
                'grain' => $grain,
                'seq_start' => $startSeq,
                'seq_end' => $endSeq,
                'chapter_index' => $firstChapter,
                'primary_language' => $primaryLanguage !== '' ? $primaryLanguage : null,
                'char_count' => $chars,
                'status' => 'pending',
                'attempts' => 0,
                'metadata' => ['target_chars' => $targetChars],
            ];
            $segIndex++;
            $startSeq = null;
            $endSeq = null;
            $firstChapter = 0;
            $chars = 0;
        };

        foreach ($slots as $slot) {
            $seq = (int) $slot->seq;
            $chapter = (int) $slot->chapter_index;

            $primaryCid = $this->slotPrimaryContentId($slot, $primaryLanguage);
            $text = ($primaryCid !== '' && isset($textById[$primaryCid])) ? $textById[$primaryCid] : '';
            $len = ($text === '') ? 0 : mb_strlen($text);

            // Chapter boundary: close the open segment BEFORE this slot starts a
            // fresh one (chapter boundaries are natural study units).
            if ($startSeq !== null && $chapter !== $firstChapter) {
                $flush();
            }

            if ($startSeq === null) {
                $startSeq = $seq;
                $firstChapter = $chapter;
                $chars = 0;
            }
            $endSeq = $seq;

            // Char budget is measured on the primary texts joined by one space;
            // empty-text slots contribute 0 chars but still belong to the segment.
            if ($len > 0) {
                if ($chars > 0) {
                    $chars += 1;
                }
                $chars += $len;
            }

            // Budget reached: close AFTER adding so the segment ends on this slot
            // boundary (never mid-sentence).
            if ($chars >= $targetChars) {
                $flush();
            }
        }

        // Keep the final partial segment.
        $flush();

        return $rows;
    }

    /**
     * Build the per-slot text list for a claimed segment (§5.2 response `slots`):
     * [{n (1-based in-segment number), seq, text}]. Text is the primary-language
     * library text (empty string where the slot has no primary correspondence).
     *
     * @return array<int,array{n:int,seq:int,text:string}>
     */
    public function buildSegmentSlots(StudySegment $segment): array
    {
        $primaryLanguage = (string) ($segment->primary_language ?? '');

        $slots = SourceSentence::studySlotsBetween(
            (string) $segment->source_type,
            (string) $segment->source_key,
            (string) $segment->grain,
            (int) $segment->seq_start,
            (int) $segment->seq_end
        );

        $textById = $this->primaryTextMap($slots, $primaryLanguage);

        $out = [];
        $n = 1;
        foreach ($slots as $slot) {
            $cid = $this->slotPrimaryContentId($slot, $primaryLanguage);
            $text = ($cid !== '' && isset($textById[$cid])) ? $textById[$cid] : '';
            $out[] = [
                'n' => $n,
                'seq' => (int) $slot->seq,
                'text' => $text,
            ];
            $n++;
        }

        return $out;
    }

    /**
     * Load the ordered correspondence slots for a source. Grain is 'sentence'
     * when any sentence-grain slot exists, else 'cue'.
     *
     * @return array{0:\Illuminate\Support\Collection<int,SourceSentence>,1:string}
     */
    private function loadOrderedSlots(string $sourceType, string $sourceKey): array
    {
        $result = SourceSentence::orderedStudySlots($sourceType, $sourceKey);

        return [$result['rows'], $result['grain']];
    }

    /**
     * Primary language for a source: the source row's language (books/articles)
     * else the slots' primary_language else 'en'. Normalized to a code.
     *
     * @param \Illuminate\Support\Collection<int,SourceSentence> $slots
     */
    private function resolvePrimaryLanguage(string $sourceType, string $sourceKey, $slots): string
    {
        $raw = '';
        if ($sourceType === 'book') {
            $raw = Book::sourceLanguage($sourceKey);
        } elseif ($sourceType === 'article') {
            $raw = AppQyV1Article::sourceLanguage($sourceKey);
        }

        if ($raw === '') {
            foreach ($slots as $slot) {
                $candidate = (string) ($slot->primary_language ?? '');
                if ($candidate !== '') {
                    $raw = $candidate;
                    break;
                }
            }
        }

        $code = AppQyV1TableMaps::normalizeLangCode($raw);
        return $code !== '' ? $code : 'en';
    }

    /** The slot's primary-language content_id (empty string when留空/absent). */
    private function slotPrimaryContentId(SourceSentence $slot, string $primaryLanguage): string
    {
        if ($primaryLanguage === '') {
            return '';
        }
        $map = $slot->lang_content_ids;
        if (!is_array($map) || empty($map[$primaryLanguage])) {
            return '';
        }
        return (string) $map[$primaryLanguage];
    }

    /**
     * Batch-resolve primary content_id -> text for a slot collection from the
     * primary language's sentence table. Returns [] when the table is absent.
     *
     * @param \Illuminate\Support\Collection<int,SourceSentence> $slots
     * @return array<string,string>
     */
    private function primaryTextMap($slots, string $primaryLanguage): array
    {
        if ($primaryLanguage === '') {
            return [];
        }

        $ids = [];
        foreach ($slots as $slot) {
            $cid = $this->slotPrimaryContentId($slot, $primaryLanguage);
            if ($cid !== '') {
                $ids[$cid] = true;
            }
        }
        if (empty($ids)) {
            return [];
        }

        return LangSentence::textMapByContentIds($primaryLanguage, array_keys($ids));
    }
}
