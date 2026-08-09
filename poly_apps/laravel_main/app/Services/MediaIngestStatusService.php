<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioFiles;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangChapterModel as LangChapter;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;

/**
 * Idempotent ingest progress for external importers (mcp-chrome Duoreader, pycore).
 *
 * Text and audio completeness are tracked separately per chapter so callers can
 * skip CDN fetch / text upload while still backfilling missing audio variants.
 */
class MediaIngestStatusService
{
    private AppQyV1SentenceAudioService $audioService;

    private BookChapterIndexAdapter $chapterIndexAdapter;

    public function __construct(
        ?AppQyV1SentenceAudioService $audioService = null,
        ?BookChapterIndexAdapter $chapterIndexAdapter = null
    ) {
        $this->audioService = $audioService ?? new AppQyV1SentenceAudioService();
        $this->chapterIndexAdapter = $chapterIndexAdapter ?? new BookChapterIndexAdapter();
    }

    /**
     * @param array<int,string> $languages Normalized language codes to check audio for.
     * @return array<string,mixed>
     */
    public function buildBookStatus(
        string $sourceKey,
        array $languages = [],
        string $variantKey = '',
        bool $includeSlots = false,
        bool $includeTextForMissingAudio = false
    ): array {
        $book = Book::where('source_key', $sourceKey)->first();
        if (!$book) {
            return [
                'source_key' => $sourceKey,
                'book_exists' => false,
                'text_complete' => false,
                'audio_complete' => false,
                'variant_key' => $variantKey,
                'languages' => $languages,
                'total_slots' => 0,
                'chapters' => [],
            ];
        }

        $sourceLanguages = $this->sourceLanguagesFromBook($book);
        if ($languages === []) {
            $languages = $sourceLanguages;
        } else {
            $languages = array_values(array_unique(array_filter(array_map(
                static fn (string $code): string => AppQyV1TableMaps::normalizeLangCode($code),
                $languages
            ))));
        }

        $chapterRows = $this->buildChapterRows('book', $sourceKey, $sourceLanguages);
        $slotCounts = SourceSentence::where('source_key', $sourceKey)
            ->where('grain', 'sentence')
            ->selectRaw('chapter_index, COUNT(*) as slot_count')
            ->groupBy('chapter_index')
            ->pluck('slot_count', 'chapter_index');

        $slotsByChapter = [];
        if ($includeSlots || $languages !== []) {
            $rows = SourceSentence::where('source_key', $sourceKey)
                ->where('grain', 'sentence')
                ->orderBy('chapter_index')
                ->orderBy('seq')
                ->get();
            foreach ($rows as $row) {
                $ci = (int) $row->chapter_index;
                if (!isset($slotsByChapter[$ci])) {
                    $slotsByChapter[$ci] = [];
                }
                $slotsByChapter[$ci][] = $row;
            }
        }

        $sentenceCache = [];
        $chapters = [];
        $bookTextComplete = true;
        $bookAudioComplete = $languages !== [];

        foreach ($chapterRows as $row) {
            $ci = (int) $row['chapter_index'];
            $sentenceCount = (int) ($row['sentence_count'] ?? 0);
            $resolved = $this->chapterIndexAdapter->resolve('book', $sourceKey, $sourceLanguages, $ci);
            $slotCi = $resolved['slot_index'] ?? $ci;
            $slotCount = (int) ($slotCounts[$slotCi] ?? 0);
            $textComplete = $sentenceCount > 0 && $slotCount >= $sentenceCount;
            if (!$textComplete) {
                $bookTextComplete = false;
            }

            $audioSummary = $this->summarizeChapterAudio(
                $slotsByChapter[$slotCi] ?? [],
                $languages,
                $variantKey,
                $sentenceCache,
                $includeSlots,
                $includeTextForMissingAudio
            );

            if ($languages !== [] && !$audioSummary['complete']) {
                $bookAudioComplete = false;
            }

            $chapterPayload = [
                'chapter_index' => $ci,
                'sentence_count' => $sentenceCount,
                'slot_count' => $slotCount,
                'text_complete' => $textComplete,
                'audio' => $audioSummary['by_lang'],
                'audio_complete' => $audioSummary['complete'],
                'complete' => $textComplete,
            ];
            if ($resolved['adapted']) {
                $chapterPayload['slot_chapter_index'] = $slotCi;
            }

            if ($includeSlots) {
                $chapterPayload['slots'] = $audioSummary['slots'];
            }

            $chapters[] = $chapterPayload;
        }

        if ($languages === []) {
            $bookAudioComplete = false;
        }

        $totalSlots = (int) SourceSentence::where('source_key', $sourceKey)
            ->where('grain', 'sentence')
            ->count();

        return [
            'source_key' => $sourceKey,
            'book_exists' => true,
            'text_complete' => $bookTextComplete,
            'audio_complete' => $bookAudioComplete,
            'variant_key' => $variantKey,
            'languages' => $languages,
            'total_slots' => $totalSlots,
            'chapters' => $chapters,
        ];
    }

    /**
     * @param array<int,SourceSentence> $slots
     * @param array<int,string> $languages
     * @param array<string,array<string,LangSentence|null>> $sentenceCache
     * @return array{complete:bool,by_lang:array<string,array<string,int|bool>>,slots:array<int,array<string,mixed>>}
     */
    private function summarizeChapterAudio(
        array $slots,
        array $languages,
        string $variantKey,
        array &$sentenceCache,
        bool $includeSlots,
        bool $includeTextForMissingAudio
    ): array {
        $byLang = [];
        foreach ($languages as $lang) {
            $byLang[$lang] = [
                'expected' => 0,
                'with_audio' => 0,
                'complete' => false,
            ];
        }

        $slotPayloads = [];
        $allLangsComplete = $languages !== [];

        foreach ($slots as $slot) {
            $map = $slot->lang_content_ids;
            if (!is_array($map)) {
                $map = [];
            }

            $slotAudio = [];
            $slotTexts = [];
            $contentIds = [];

            foreach ($languages as $lang) {
                $contentId = isset($map[$lang]) ? trim((string) $map[$lang]) : '';
                if ($contentId === '') {
                    $slotAudio[$lang] = false;
                    continue;
                }

                $byLang[$lang]['expected'] += 1;
                $contentIds[$lang] = $contentId;
                $sentence = $this->cachedSentence($sentenceCache, $lang, $contentId);
                $hasAudio = $this->slotHasVariantAudio($lang, $contentId, $variantKey, $sentence);
                $slotAudio[$lang] = $hasAudio;
                if ($hasAudio) {
                    $byLang[$lang]['with_audio'] += 1;
                } elseif ($includeTextForMissingAudio && $sentence !== null && is_string($sentence->text) && $sentence->text !== '') {
                    $slotTexts[$lang] = $sentence->text;
                }
            }

            if ($includeSlots) {
                $entry = [
                    'seq' => (int) $slot->seq,
                    'corr_id' => $slot->corr_id,
                    'lang_content_ids' => $contentIds,
                    'audio' => $slotAudio,
                ];
                if ($slotTexts !== []) {
                    $entry['text'] = $slotTexts;
                }
                $slotPayloads[] = $entry;
            }
        }

        foreach ($languages as $lang) {
            $expected = (int) $byLang[$lang]['expected'];
            $withAudio = (int) $byLang[$lang]['with_audio'];
            $langComplete = $expected > 0 && $withAudio >= $expected;
            $byLang[$lang]['complete'] = $langComplete;
            if (!$langComplete) {
                $allLangsComplete = false;
            }
        }

        if ($languages === [] || $slots === []) {
            $allLangsComplete = false;
        }

        return [
            'complete' => $allLangsComplete,
            'by_lang' => $byLang,
            'slots' => $slotPayloads,
        ];
    }

    /**
     * @param array<string,array<string,LangSentence|null>> $cache
     */
    private function cachedSentence(array &$cache, string $lang, string $contentId): ?LangSentence
    {
        if (!isset($cache[$lang])) {
            $cache[$lang] = [];
        }
        if (array_key_exists($contentId, $cache[$lang])) {
            return $cache[$lang][$contentId];
        }
        if (!$this->langTableExists($lang)) {
            $cache[$lang][$contentId] = null;
            return null;
        }
        $row = LangSentence::onLang($lang)->where('content_id', $contentId)->first();
        $cache[$lang][$contentId] = $row;
        return $row;
    }

    private function slotHasVariantAudio(
        string $lang,
        string $contentId,
        string $variantKey,
        ?LangSentence $sentence
    ): bool {
        $variant = $variantKey !== '' ? $variantKey : null;
        if ($this->audioService->variantExistsOnDisk($lang, $contentId, $variant)) {
            return true;
        }
        if ($sentence !== null && AppQyV1SentenceAudioFiles::hasVariantWithFile($sentence, $variantKey)) {
            return true;
        }
        return false;
    }

    private function langTableExists(string $lang): bool
    {
        $table = AppQyV1TableMaps::getSentenceTableName($lang);
        return \Illuminate\Support\Facades\Schema::connection(
            \App\Providers\AppTablePrefixServiceProvider::getConnection(\App\Constants\AppKeys::APPQYV1)
        )->hasTable($table);
    }

    /** @return array<int,string> */
    private function sourceLanguagesFromBook(Book $book): array
    {
        $meta = is_array($book->metadata ?? null) ? $book->metadata : [];
        $raw = isset($meta['seeded_languages']) && is_array($meta['seeded_languages'])
            ? $meta['seeded_languages']
            : [];

        if ($raw === []) {
            $sample = SourceSentence::where('source_type', 'book')
                ->where('source_key', $book->source_key)
                ->whereNotNull('lang_content_ids')
                ->first();
            if ($sample && is_array($sample->lang_content_ids)) {
                $raw = array_keys($sample->lang_content_ids);
            }
            if ($sample && !empty($sample->primary_language)) {
                $raw[] = $sample->primary_language;
            }
        }

        $out = [];
        foreach ($raw as $lang) {
            $code = AppQyV1TableMaps::normalizeLangCode((string) $lang);
            if ($code !== '' && AppQyV1TableMaps::isLanguageSupported($code) && !in_array($code, $out, true)) {
                $out[] = $code;
            }
        }
        return $out === [] ? ['en'] : $out;
    }

    /**
     * @param array<int,string> $languages
     * @return array<int,array<string,mixed>>
     */
    private function buildChapterRows(string $sourceType, string $sourceKey, array $languages): array
    {
        $byIndex = [];

        foreach ($languages as $lang) {
            $rows = LangChapter::onLang($lang)
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->orderBy('chapter_index')
                ->get();

            foreach ($rows as $row) {
                $ci = (int) $row->chapter_index;
                if (!isset($byIndex[$ci])) {
                    $byIndex[$ci] = [
                        'chapter_index' => $ci,
                        'sentence_count' => 0,
                    ];
                }
                $count = (int) $row->sentence_count;
                if ($count > $byIndex[$ci]['sentence_count']) {
                    $byIndex[$ci]['sentence_count'] = $count;
                }
            }
        }

        if ($byIndex === [] && $languages !== []) {
            $maxChapter = SourceSentence::where('source_key', $sourceKey)
                ->where('grain', 'sentence')
                ->max('chapter_index');
            if ($maxChapter !== null) {
                for ($ci = 0; $ci <= (int) $maxChapter; $ci += 1) {
                    $slotCount = SourceSentence::where('source_key', $sourceKey)
                        ->where('grain', 'sentence')
                        ->where('chapter_index', $ci)
                        ->count();
                    if ($slotCount > 0) {
                        $byIndex[$ci] = [
                            'chapter_index' => $ci,
                            'sentence_count' => $slotCount,
                        ];
                    }
                }
            }
        }

        ksort($byIndex);
        return array_values($byIndex);
    }
}
