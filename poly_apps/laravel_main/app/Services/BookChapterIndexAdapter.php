<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangChapterModel as LangChapter;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;

/**
 * Maps LangChapter metadata chapter_index to SourceSentence slot chapter_index.
 *
 * Duoreader and similar importers can emit metadata at 0..N-1 while slots
 * start at 1..N. When the requested index already has slots, data pass through
 * unchanged.
 */
class BookChapterIndexAdapter
{
    /** @var array<string, array<int, int>> */
    private array $slotCountCache = [];

    /** @var array<string, int> */
    private array $metaOffsetCache = [];

    /**
     * @return array<int, int> chapter_index => slot_count
     */
    public function slotCounts(string $sourceKey, string $grain = 'sentence'): array
    {
        $cacheKey = $sourceKey . ':' . $grain;
        if (isset($this->slotCountCache[$cacheKey])) {
            return $this->slotCountCache[$cacheKey];
        }

        $query = SourceSentence::where('source_key', $sourceKey);
        if ($grain !== 'all') {
            $query->where('grain', $grain);
        }

        $counts = [];
        foreach ($query->selectRaw('chapter_index, COUNT(*) as slot_count')
            ->groupBy('chapter_index')
            ->pluck('slot_count', 'chapter_index') as $ci => $n) {
            $counts[(int) $ci] = (int) $n;
        }

        $this->slotCountCache[$cacheKey] = $counts;
        return $counts;
    }

    /**
     * @return array<int, int>
     */
    public function nonEmptySlotIndices(string $sourceKey, string $grain = 'sentence'): array
    {
        $indices = [];
        foreach ($this->slotCounts($sourceKey, $grain) as $ci => $n) {
            if ($n > 0) {
                $indices[] = $ci;
            }
        }
        sort($indices, SORT_NUMERIC);
        return $indices;
    }

    /**
     * @return array<int, int>
     */
    public function metadataIndices(string $sourceType, string $sourceKey, array $languages): array
    {
        $seen = [];
        foreach ($languages as $lang) {
            $lang = AppQyV1TableMaps::normalizeLangCode((string) $lang);
            if ($lang === '') {
                continue;
            }
            foreach (LangChapter::onLang($lang)
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->orderBy('chapter_index')
                ->pluck('chapter_index') as $ci) {
                $seen[(int) $ci] = true;
            }
        }

        $indices = array_keys($seen);
        sort($indices, SORT_NUMERIC);
        return $indices;
    }

    public function metadataToSlotOffset(
        string $sourceType,
        string $sourceKey,
        array $languages,
        string $grain = 'sentence'
    ): int {
        $cacheKey = $sourceType . ':' . $sourceKey . ':' . implode(',', $languages) . ':' . $grain;
        if (isset($this->metaOffsetCache[$cacheKey])) {
            return $this->metaOffsetCache[$cacheKey];
        }

        $meta = $this->metadataIndices($sourceType, $sourceKey, $languages);
        $slots = $this->nonEmptySlotIndices($sourceKey, $grain);
        $offset = 0;
        if ($meta !== [] && $slots !== []) {
            $offset = $slots[0] - $meta[0];
        }

        $this->metaOffsetCache[$cacheKey] = $offset;
        return $offset;
    }

    /**
     * @return array{slot_index: ?int, requested: ?int, adapted: bool}
     */
    public function resolve(
        string $sourceType,
        string $sourceKey,
        array $languages,
        ?int $requestedChapterIndex,
        string $grain = 'sentence'
    ): array {
        if ($requestedChapterIndex === null) {
            return ['slot_index' => null, 'requested' => null, 'adapted' => false];
        }

        $counts = $this->slotCounts($sourceKey, $grain);
        if (($counts[$requestedChapterIndex] ?? 0) > 0) {
            return [
                'slot_index' => $requestedChapterIndex,
                'requested' => $requestedChapterIndex,
                'adapted' => false,
            ];
        }

        $offset = $this->metadataToSlotOffset($sourceType, $sourceKey, $languages, $grain);
        if ($offset !== 0) {
            $candidate = $requestedChapterIndex + $offset;
            if (($counts[$candidate] ?? 0) > 0) {
                return [
                    'slot_index' => $candidate,
                    'requested' => $requestedChapterIndex,
                    'adapted' => true,
                ];
            }
        }

        $meta = $this->metadataIndices($sourceType, $sourceKey, $languages);
        $slots = $this->nonEmptySlotIndices($sourceKey, $grain);
        $pos = array_search($requestedChapterIndex, $meta, true);
        if ($pos !== false && isset($slots[$pos])) {
            $slot = $slots[$pos];
            if ($slot !== $requestedChapterIndex) {
                return [
                    'slot_index' => $slot,
                    'requested' => $requestedChapterIndex,
                    'adapted' => true,
                ];
            }
        }

        return [
            'slot_index' => $requestedChapterIndex,
            'requested' => $requestedChapterIndex,
            'adapted' => false,
        ];
    }

    public function slotCountForMetadataChapter(
        string $sourceType,
        string $sourceKey,
        array $languages,
        int $metadataChapterIndex,
        string $grain = 'sentence'
    ): int {
        $resolved = $this->resolve($sourceType, $sourceKey, $languages, $metadataChapterIndex, $grain);
        $slot = $resolved['slot_index'];
        if ($slot === null) {
            return 0;
        }

        return (int) ($this->slotCounts($sourceKey, $grain)[$slot] ?? 0);
    }
}
