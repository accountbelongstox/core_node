<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Models\GlobalTask;
use App\Services\MediaIngestService;
use App\Services\QueueCenter\QueueCenterService;
use App\Support\SentenceSegmenter;

/**
 * Re-segments book/document sources whose stored sentences still carry verse
 * numbers glued to the text ("9My men ...", merged verses), per the contract
 * verses rule (config/sentence_segmentation_contract.json).
 *
 * Idempotent and non-destructive, run on every sys:init (the data state is the
 * guard: a repaired source has no marker left):
 * - the source's live slots move to the obsolete grains (kept);
 * - its slots are rebuilt verse by verse through MediaIngestService's set-based
 *   path, so clean sentence rows (content_id from the clean text) exist and
 *   enter the audio gap;
 * - dirty sentence rows no live slot references any more get obsolete_at
 *   (kept, never audio work again);
 * - live sentence_audio tasks of those rows are cancelled.
 */
final class AppQyV1VerseResegmentation
{
    private const SOURCE_TYPES = ['book', 'document'];
    private const LOOKUP_CHUNK = 500;

    /**
     * PostgreSQL prefilter that narrows the scan to rows with a digit run that
     * could be a marker; SentenceSegmenter::hasVerseMarker decides.
     */
    private const CANDIDATE_PATTERN = '(^|[[:space:][:punct:]]|[^\x01-\x7f])[0-9]{1,3}([[:upper:]]|[("\'\[{]|[^\x01-\x7f])';

    /**
     * Read-only counts of what repair() would change.
     *
     * @return array{languages:array<string,array{dirty_sentences:int,sources:int,live_slots:int,live_audio_tasks:int}>,dirty_sentences:int,sources:int,live_slots:int,live_audio_tasks:int}
     */
    public function scan(): array
    {
        $report = ['languages' => [], 'dirty_sentences' => 0, 'sources' => 0, 'live_slots' => 0, 'live_audio_tasks' => 0];
        $allSources = [];

        foreach ($this->dirtyContentIds() as $language => $contentIds) {
            $sources = $this->sourcesOf($language, $contentIds);
            $slots = 0;
            foreach ($sources as $key => $source) {
                $slots += SourceSentence::liveSlotsOfSource($source['source_type'], $source['source_key'])->count();
                $allSources[$key] = true;
            }
            $tasks = count($this->liveAudioTaskIds($language, $contentIds));
            $report['languages'][$language] = [
                'dirty_sentences' => count($contentIds),
                'sources' => count($sources),
                'live_slots' => $slots,
                'live_audio_tasks' => $tasks,
            ];
            $report['dirty_sentences'] += count($contentIds);
            $report['live_slots'] += $slots;
            $report['live_audio_tasks'] += $tasks;
        }
        $report['sources'] = count($allSources);

        return $report;
    }

    /**
     * @return array{sources:int,retired_slots:int,new_slots:int,clean_sentences:int,obsolete_sentences:int,cancelled_tasks:int}
     */
    public function repair(): array
    {
        $result = ['sources' => 0, 'retired_slots' => 0, 'new_slots' => 0, 'clean_sentences' => 0, 'obsolete_sentences' => 0, 'cancelled_tasks' => 0];
        $dirty = $this->dirtyContentIds();
        $sources = [];

        foreach ($dirty as $language => $contentIds) {
            $sources += $this->sourcesOf($language, $contentIds);
        }
        foreach ($sources as $source) {
            $rebuilt = $this->rebuildSource($source['source_type'], $source['source_key']);
            $result['sources']++;
            $result['retired_slots'] += $rebuilt['retired_slots'];
            $result['new_slots'] += $rebuilt['new_slots'];
            $result['clean_sentences'] += $rebuilt['clean_sentences'];
        }
        foreach ($dirty as $language => $contentIds) {
            $retired = $this->unreferenced($language, $contentIds);
            $result['obsolete_sentences'] += LangSentence::markObsolete($language, $retired);
            foreach ($this->liveAudioTaskIds($language, $retired) as $taskId) {
                if (app(QueueCenterService::class)->cancel($taskId) === 'cancelled') {
                    $result['cancelled_tasks']++;
                }
            }
        }

        return $result;
    }

    /** @return array<string,array<int,string>> language => dirty content ids */
    private function dirtyContentIds(): array
    {
        $dirty = [];

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            foreach (LangSentence::verseMarkerCandidates($language, self::CANDIDATE_PATTERN) as $contentId => $text) {
                if (SentenceSegmenter::hasVerseMarker($text)) {
                    $dirty[$language][] = (string) $contentId;
                }
            }
        }

        return $dirty;
    }

    /** @return array<string,array{source_type:string,source_key:string}> keyed "type:key" */
    private function sourcesOf(string $language, array $contentIds): array
    {
        $sources = [];

        foreach (array_chunk($contentIds, self::LOOKUP_CHUNK) as $chunk) {
            foreach (SourceSentence::sourcesReferencing($language, $chunk, self::SOURCE_TYPES) as $source) {
                $sources[$source['source_type'] . ':' . $source['source_key']] = $source;
            }
        }

        return $sources;
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

    /** @return array<int,string> */
    private function liveAudioTaskIds(string $language, array $contentIds): array
    {
        $taskIds = [];

        foreach (array_chunk($contentIds, self::LOOKUP_CHUNK) as $chunk) {
            $groupKeys = array_map(
                static fn (string $contentId): string => QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_SENTENCE_AUDIO, $language, $contentId),
                $chunk
            );
            array_push($taskIds, ...GlobalTask::liveTaskIdsByGroupKeys(QueueCenterService::QUEUE_SENTENCE_AUDIO, $groupKeys));
        }

        return $taskIds;
    }

    /**
     * Retires one source's live slots and writes them again verse by verse.
     *
     * @return array{retired_slots:int,new_slots:int,clean_sentences:int}
     */
    private function rebuildSource(string $sourceType, string $sourceKey): array
    {
        $slots = SourceSentence::liveSlotsOfSource($sourceType, $sourceKey);
        $texts = $this->slotTexts($slots);
        $newSlots = [];
        $seqByGrain = [];
        $primary = '';

        foreach ($slots as $slot) {
            $primary = $primary !== '' ? $primary : (string) $slot->primary_language;
            foreach ($this->slotPieces($slot, $texts) as $piece) {
                $grain = (string) $slot->grain;
                $seqByGrain[$grain] = ($seqByGrain[$grain] ?? -1) + 1;
                $newSlots[] = [
                    'grain' => $grain,
                    'seq' => $seqByGrain[$grain],
                    'chapter_index' => (int) $slot->chapter_index,
                    'primary_language' => $slot->primary_language,
                    'langs' => $piece['langs'],
                    'seg_index' => $slot->seg_index,
                    'sub_idx' => $slot->sub_idx,
                    'start_sec' => $slot->start_sec,
                    'end_sec' => $slot->end_sec,
                    'metadata' => $piece['metadata'],
                ];
            }
        }

        return SourceSentence::runInTransaction(function () use ($sourceType, $sourceKey, $primary, $newSlots): array {
            $retired = SourceSentence::retireLiveSlots($sourceType, $sourceKey);
            $written = app(MediaIngestService::class)->ingestSlots($sourceType, $sourceKey, $primary !== '' ? $primary : 'en', $newSlots);

            return [
                'retired_slots' => $retired,
                'new_slots' => $written['source_sentences']['created'],
                'clean_sentences' => $written['sentences']['created'],
            ];
        });
    }

    /** @return array<string,array<string,string>> language => content_id => stored text */
    private function slotTexts($slots): array
    {
        $ids = [];
        $texts = [];

        foreach ($slots as $slot) {
            foreach ((array) $slot->lang_content_ids as $language => $contentId) {
                if (is_string($contentId) && $contentId !== '') {
                    $ids[$language][$contentId] = true;
                }
            }
        }
        foreach ($ids as $language => $contentIds) {
            $texts[$language] = LangSentence::textMapByContentIds((string) $language, array_keys($contentIds));
        }

        return $texts;
    }

    /**
     * The verse pieces one old slot becomes. A clean slot stays one piece; a
     * single-language dirty slot splits at its markers (a cue keeps one piece
     * per verse, a sentence one per sentence); a multi-language dirty slot only
     * loses its markers, so the language correspondence stays intact.
     *
     * @return array<int,array{langs:array<string,?string>,metadata:array}>
     */
    private function slotPieces(SourceSentence $slot, array $texts): array
    {
        $metadata = is_array($slot->metadata) ? $slot->metadata : [];
        $langs = [];
        $dirty = [];

        foreach ((array) $slot->lang_content_ids as $language => $contentId) {
            $text = is_string($contentId) ? ($texts[$language][$contentId] ?? null) : null;
            $langs[$language] = $text;
            if ($text !== null && SentenceSegmenter::hasVerseMarker($text)) {
                $dirty[$language] = SentenceSegmenter::splitVerses($text);
            }
        }
        if ($dirty === []) {
            return [['langs' => $langs, 'metadata' => $metadata]];
        }
        if (count(array_filter($langs, static fn (?string $text): bool => $text !== null)) > 1) {
            foreach ($dirty as $language => $pieces) {
                $langs[$language] = implode(' ', array_column($pieces, 'text'));
            }
            $verse = array_values(array_filter(array_column(array_merge(...array_values($dirty)), 'verse'), static fn ($v): bool => $v !== null))[0] ?? null;

            return [['langs' => $langs, 'metadata' => $this->withVerse($metadata, $verse, null)]];
        }

        $language = (string) array_key_first($dirty);
        $out = [];
        foreach ($this->groupedPieces($dirty[$language], (string) $slot->grain === 'cue') as $piece) {
            $out[] = [
                'langs' => array_merge(array_fill_keys(array_keys($langs), null), [$language => $piece['text']]),
                'metadata' => $this->withVerse($metadata, $piece['verse'], $piece['chapter']),
            ];
        }

        return $out;
    }

    /** Cue slots join consecutive sentences of one verse; sentence slots keep each. */
    private function groupedPieces(array $pieces, bool $byVerse): array
    {
        $grouped = [];

        foreach ($pieces as $piece) {
            $last = array_key_last($grouped);
            if ($byVerse && $last !== null && $grouped[$last]['verse'] === $piece['verse']) {
                $grouped[$last]['text'] .= ' ' . $piece['text'];
                continue;
            }
            $grouped[] = $piece;
        }

        return $grouped;
    }

    private function withVerse(array $metadata, ?int $verse, ?int $chapter): array
    {
        if ($verse !== null) {
            $metadata['verse'] = $verse;
        }
        if ($chapter !== null) {
            $metadata['book_chapter'] = $chapter;
        }

        return $metadata;
    }
}
