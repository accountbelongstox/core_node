<?php

// AI editing rules for this file:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, migrate, or start
//    the server. Delivering the written code is the entire task.

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Providers\PathMapper;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MediaIngestService;
use App\Support\SentenceSegmenter;
use App\Support\ServiceContract;
use Illuminate\Support\Facades\Log;

/**
 * AppQyV1BookSeedImporter
 * -------------------------------------------------------------------------
 * Idempotently seeds an INITIAL book into the AppQyV1 database from a compressed
 * corpus that ships in the repository, so a fresh install already has a book to
 * read without any network fetch.
 *
 * The shipped corpus is the zeoinjesus.com Chinese/English parallel Bible. It is
 * seeded as ONE book ("Holy Bible") with N CHAPTERS — one chapter per biblical
 * sub-book (Genesis … Revelation), in canonical order — NOT as N separate books.
 * Each verse keeps its real `book chapter:verse` reference in slot metadata. The
 * seeded bilingual pair is public-domain (en <- KJV, zh <- 和合本 CUV); the other
 * four editions stay inside the blob and are noted in metadata. For personal
 * academic / devotional study use only.
 *
 * Pipeline (called from AppQyV1Initializer's `seed_books` step, AFTER the Books
 * v3 tables exist and are verified):
 *   1. The prerequisite shell step 175 (175_laravel_main_start.sh /
 *      Step175_LaravelMainStart.ps1) idempotently extracts the committed
 *      `.js`-disguised xz tar into <laravel_db>/seed_data/books/<corpus> (the
 *      code tree is never polluted). Laravel runs no decompression tool.
 *   2. Transcode the WHOLE corpus into ONE model_version:3 payload (one book ->
 *      66 chapters -> per-language verse slots) and hand it to
 *      MediaIngestService::ingest() (one atomic transaction, fill-missing).
 *   3. Supersede any legacy per-book rows from the earlier (wrong) one-book-per-
 *      file seed.
 *
 * Idempotency: the completion sentinel is the single Bible book's source_key
 * (isSeeded()); the v3 ingest is one transaction, so the book row exists iff the
 * whole seed committed.
 */
class AppQyV1BookSeedImporter
{
    private const PREREQUISITE_STEP = '175_laravel_main_start.sh / Step175_LaravelMainStart.ps1';

    /** Rejected-sentence examples kept in the gate report. */
    private const GATE_EXAMPLES = 5;

    /** Import gate counters of the last payload build. */
    private array $gateStats = ['sentences' => 0, 'rejected' => 0, 'unpaired_verses' => 0, 'by_code' => [], 'examples' => []];

    /** Stable namespace for this seed collection (part of the source_key). */
    private const COLLECTION = 'zeoinjesus-bible';

    /** The single seeded book's title (English; FE localizes the display name). */
    private const BIBLE_TITLE = 'Holy Bible';

    /** Primary language (L0) for the seeded bilingual pair. */
    private const PRIMARY_LANGUAGE = 'en';

    /**
     * Which corpus version maps onto each seeded language code. Both chosen
     * editions are public-domain so the seed is safe to commit:
     *   en <- KJV (King James Version, 1611)
     *   zh <- CUV (和合本 Chinese Union Version, 1919)
     */
    private const LANG_VERSION = [
        'en' => 'kjv',
        'zh' => 'cuv',
    ];

    /** All editions present in the corpus (for book metadata only). */
    private const AVAILABLE_VERSIONS = ['cuv', 'kjv', 'lzz', 'nasb', 'ncv', 'niv'];

    /** The single Bible book's deterministic source_key (one book, not 66). */
    public static function bibleSourceKey(): string
    {
        return sha1(self::COLLECTION);
    }

    /**
     * Deterministic LEGACY per-book source_key — kept only to find/remove the rows
     * left by the earlier (wrong) one-book-per-file seed. New data never uses it.
     */
    public static function legacyBookSourceKey(string $abbr): string
    {
        return sha1(self::COLLECTION . '|book|' . strtolower($abbr));
    }

    /**
     * Cheap DB truth check: is the Bible already seeded as the single book? Used
     * both by the importer fast-path and by AppQyV1Initializer::stepStillSatisfiedInDb.
     */
    /**
     * Where shell step 175 extracts the corpus: <laravel_db>/<book_seed.target_subpath>/<book_seed.top_dir>
     * (config/service_contract.json book_seed, shared with the shell step).
     */
    private static function corpusRoot(): string
    {
        $seed = ServiceContract::section('book_seed');

        return PathMapper::getLaravelDataDir($seed['target_subpath'] . '/' . $seed['top_dir']);
    }

    public static function isSeeded(): bool
    {
        try {
            return Book::sourceExists(self::bibleSourceKey());
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Run the seed. Returns an AppQyV1Initializer step result array
     * (status: success|warning, message, ...). Never throws.
     */
    public function import(): array
    {
        $corpusRoot = self::corpusRoot();

        // Already the single Bible book: clean up any leftover legacy per-book rows
        // (idempotent) and return WITHOUT decompressing.
        if (self::isSeeded()) {
            $removed = $this->supersedeLegacyPerBookSeed();
            return [
                'status' => 'success',
                'message' => $removed
                    ? __('app_qy_v1.messages.book_seed_bible_already_seeded_removed', ['removed' => $removed])
                    : __('app_qy_v1.messages.book_seed_bible_already_seeded'),
            ];
        }

        if (!$this->corpusReady($corpusRoot)) {
            return [
                'status' => 'warning',
                'message' => __('app_qy_v1.messages.book_seed_corpus_missing', [
                    'path' => $corpusRoot,
                    'step' => self::PREREQUISITE_STEP,
                ]),
            ];
        }

        try {
            $files = $this->listBookFiles($corpusRoot);
            if (empty($files)) {
                return ['status' => 'warning', 'message' => __('app_qy_v1.messages.book_seed_no_book_files')];
            }

            $docs = [];
            foreach ($files as $file) {
                $doc = json_decode((string) file_get_contents($file), true);
                if (is_array($doc) && isset($doc['book'])) {
                    $docs[] = $doc;
                }
            }
            if (empty($docs)) {
                return ['status' => 'warning', 'message' => __('app_qy_v1.messages.book_seed_no_valid_documents')];
            }

            // ONE book -> N chapters (one per biblical sub-book), one atomic ingest.
            $payload = $this->buildBiblePayload($docs);
            try {
                app(MediaIngestService::class)->ingest($payload);
            } catch (\Throwable $e) {
                Log::error('[AppQyV1BookSeed] Bible ingest failed: ' . $e->getMessage());
                return ['status' => 'warning', 'message' => __('app_qy_v1.messages.book_seed_bible_ingest_failed', ['error' => $e->getMessage()])];
            }

            // Now the single Bible book exists -> remove the legacy 66-book rows.
            $removed = $this->supersedeLegacyPerBookSeed();
            $complete = self::isSeeded();

            return [
                'status' => $complete ? 'success' : 'warning',
                'message' => __(
                    $removed
                        ? 'app_qy_v1.messages.book_seed_bible_seeded_superseded'
                        : 'app_qy_v1.messages.book_seed_bible_seeded',
                    [
                        'chapters' => count($payload['chapters']),
                        'verses' => $payload['source']['metadata']['verse_count'],
                        'removed' => $removed,
                    ]
                ),
            ];
        } catch (\Throwable $e) {
            Log::error('[AppQyV1BookSeed] Seed failed: ' . $e->getMessage());
            return ['status' => 'warning', 'message' => __('app_qy_v1.messages.book_seed_error', ['error' => $e->getMessage()])];
        }
    }

    /**
     * Ordered list of per-book JSON files (NN_*.json), excluding index/stats.
     */
    private function listBookFiles(string $corpusRoot): array
    {
        $all = glob($corpusRoot . DIRECTORY_SEPARATOR . '*.json') ?: [];
        $files = array_values(array_filter($all, function ($p) {
            $base = basename($p);
            return preg_match('/^\d{2}_.+\.json$/', $base) === 1;
        }));
        sort($files);
        return $files;
    }

    /**
     * Canonical full-Bible order key: Old Testament (Genesis … Malachi) FIRST,
     * then New Testament (Matthew … Revelation). The corpus `order` is canonical
     * WITHIN each testament (OT 28..66, NT 1..27); shifting NT past OT yields the
     * proper reading order for the single Bible book.
     */
    private function canonicalIndex(array $book): int
    {
        $order = (int) ($book['order'] ?? 0);
        $testament = strtoupper((string) ($book['testament'] ?? ''));
        return $testament === 'NT' ? $order + 1000 : $order;
    }

    /**
     * Transcode the WHOLE corpus into ONE model_version:3 payload: one book whose
     * chapters are the biblical sub-books (one chapter each, canonical order) and
     * whose verse slots carry a GLOBAL seq + the chapter_index of their sub-book.
     * Each verse keeps its real `book chapter:verse` reference in slot metadata.
     */
    private function buildBiblePayload(array $docs): array
    {
        // Canonical order: OT (Genesis..Malachi) then NT (Matthew..Revelation).
        usort($docs, function ($a, $b) {
            return $this->canonicalIndex($a['book'] ?? []) <=> $this->canonicalIndex($b['book'] ?? []);
        });

        $sourceKey = self::bibleSourceKey();
        $chapters = [];
        $slots = [];
        $seq = 0;          // global verse index across the whole Bible
        $verseTotal = 0;
        $chapterIndex = 0; // one chapter per sub-book (0..N-1)

        foreach ($docs as $doc) {
            $book = $doc['book'];
            $english = (string) ($book['english'] ?? '');
            $zhName = (string) ($book['name'] ?? '');
            $abbr = (string) ($book['abbr'] ?? '');
            $bookSlotStart = count($slots);

            foreach (($doc['chapters'] ?? []) as $chapter) {
                $chapterNo = (int) ($chapter['chapter'] ?? 0);
                foreach (($chapter['verses'] ?? []) as $verse) {
                    $verseNo = (int) ($verse['verse'] ?? 0);
                    $ref = ['book' => $english, 'abbr' => $abbr, 'book_chapter' => $chapterNo, 'verse' => $verseNo];
                    foreach ($this->verseSlots($ref, is_array($verse['texts'] ?? null) ? $verse['texts'] : []) as $sentenceIndex => $langs) {
                        $slots[] = [
                            // One chapter == this sub-book; the verse's REAL chapter:verse
                            // lives in metadata so the reader can show "Genesis 1:1".
                            'chapter_index' => $chapterIndex,
                            'grain' => 'sentence',
                            'seq' => $seq,
                            'primary_language' => self::PRIMARY_LANGUAGE,
                            'langs' => $langs,
                            'metadata' => $ref + ['ref' => $chapterNo . ':' . $verseNo, 'sentence' => $sentenceIndex],
                        ];
                        $seq++;
                    }
                    $verseTotal++;
                }
            }

            // ONE chapter per sub-book, titled per language (zh from corpus data).
            $chapters[] = [
                'chapter_index' => $chapterIndex,
                'titles' => [
                    'en' => $english !== '' ? $english : ('Book ' . ($chapterIndex + 1)),
                    'zh' => $zhName !== '' ? $zhName : null,
                ],
                'sentence_count' => count($slots) - $bookSlotStart,
                'metadata' => [
                    'abbr' => $abbr,
                    'testament' => (string) ($book['testament'] ?? ''),
                ],
            ];
            $chapterIndex++;
        }

        return [
            'source_type' => 'book',
            'model_version' => 3,
            'source' => [
                'source_key' => $sourceKey,
                'title' => self::BIBLE_TITLE,
                // No hardcoded CJK in code; the FE localizes the display title.
                'original_name' => self::BIBLE_TITLE,
                'ascii_name' => self::BIBLE_TITLE,
                'language' => self::PRIMARY_LANGUAGE,
                // Drives MediaIngestService::selectedLanguages() so a per-language
                // chapter row is created for BOTH seeded languages.
                'selected_languages' => array_keys(self::LANG_VERSION),
                'sentence_count' => count($slots),
                'metadata' => [
                    'source' => 'zeoinjesus.com',
                    'collection' => self::COLLECTION,
                    'kind' => 'bible',
                    'chapter_count' => $chapterIndex,
                    'verse_count' => $verseTotal,
                    'seeded_languages' => array_keys(self::LANG_VERSION),
                    'seeded_versions' => self::LANG_VERSION,
                    'available_versions' => self::AVAILABLE_VERSIONS,
                    'usage' => 'Personal academic / devotional study only.',
                ],
            ],
            'chapters' => $chapters,
            'slots' => $slots,
        ];
    }

    /**
     * The sentence slots of ONE verse, parsed from the corpus's structural verse
     * fields (never from flattened text). Each language's verse text is cut
     * into sentences by the shared SentenceSegmenter; the languages pair
     * sentence by sentence when their counts match, else the verse stays one
     * slot. No slot spans two verses. Every sentence passes the import gate
     * (contract verses.gate); a rejected one is counted, logged with its
     * reference and never stored.
     *
     * @param array{book:string,abbr:string,book_chapter:int,verse:int} $ref
     * @return array<int,array<string,?string>> slot index => [lang => sentence|null]
     */
    private function verseSlots(array $ref, array $texts): array
    {
        $sentencesByLang = [];
        $counts = [];
        $slots = [];

        foreach (self::LANG_VERSION as $langCode => $version) {
            $text = isset($texts[$version]) ? trim((string) $texts[$version]) : '';
            // An edition without this verse leaves the correspondence empty (留空).
            $sentencesByLang[$langCode] = $text !== '' ? SentenceSegmenter::split($text) : [];
            if ($sentencesByLang[$langCode] !== []) {
                $counts[] = count($sentencesByLang[$langCode]);
            }
        }
        if (count(array_unique($counts)) > 1) {
            foreach ($sentencesByLang as $langCode => $sentences) {
                $sentencesByLang[$langCode] = $sentences === [] ? [] : [implode(' ', $sentences)];
            }
            $this->gateStats['unpaired_verses']++;
        }
        foreach ($sentencesByLang as $langCode => $sentences) {
            foreach ($sentences as $index => $sentence) {
                $slots[$index][$langCode] = $this->gate($sentence, $langCode, $ref);
            }
        }
        foreach ($slots as $index => $langs) {
            $slots[$index] = array_merge(array_fill_keys(array_keys(self::LANG_VERSION), null), $langs);
            if (array_filter($slots[$index], static fn (?string $text): bool => $text !== null) === []) {
                unset($slots[$index]);
            }
        }

        return array_values($slots);
    }

    /** The sentence when the import gate accepts it, else null (counted and logged). */
    private function gate(string $sentence, string $langCode, array $ref): ?string
    {
        $violation = SentenceSegmenter::gateViolation($sentence);

        $this->gateStats['sentences']++;
        if ($violation === null) {
            return $sentence;
        }
        $this->gateStats['rejected']++;
        $this->gateStats['by_code'][$violation] = ($this->gateStats['by_code'][$violation] ?? 0) + 1;
        if (count($this->gateStats['examples']) < self::GATE_EXAMPLES) {
            $this->gateStats['examples'][] = $ref + ['language' => $langCode, 'violation' => $violation, 'text' => mb_substr($sentence, 0, 120)];
        }
        Log::warning('[AppQyV1BookSeed] sentence rejected by the import gate', $ref + ['language' => $langCode, 'violation' => $violation]);

        return null;
    }

    /**
     * Read-only gate report over the extracted corpus: verses, slots and
     * gate results of the old one-slot-per-verse text ("before") and of the
     * sentence parser ("after"). Writes nothing.
     */
    public function dryRun(?string $corpusRoot = null): array
    {
        $corpusRoot = $corpusRoot ?? self::corpusRoot();
        $docs = [];
        $before = ['verse_texts' => 0, 'rejected' => 0, 'by_code' => [], 'examples' => []];

        foreach ($this->listBookFiles($corpusRoot) as $file) {
            $doc = json_decode((string) file_get_contents($file), true);
            if (is_array($doc) && isset($doc['book'])) {
                $docs[] = $doc;
            }
        }
        foreach ($docs as $doc) {
            foreach (($doc['chapters'] ?? []) as $chapter) {
                foreach (($chapter['verses'] ?? []) as $verse) {
                    foreach (self::LANG_VERSION as $langCode => $version) {
                        $text = trim((string) ($verse['texts'][$version] ?? ''));
                        $violation = $text !== '' ? SentenceSegmenter::gateViolation($text) : null;
                        $before['verse_texts'] += $text !== '' ? 1 : 0;
                        if ($violation !== null) {
                            $before['rejected']++;
                            $before['by_code'][$violation] = ($before['by_code'][$violation] ?? 0) + 1;
                            if (count($before['examples']) < self::GATE_EXAMPLES) {
                                $before['examples'][] = ['abbr' => $doc['book']['abbr'] ?? '', 'book_chapter' => $chapter['chapter'] ?? 0, 'verse' => $verse['verse'] ?? 0, 'language' => $langCode, 'violation' => $violation, 'text' => mb_substr($text, 0, 120)];
                            }
                        }
                    }
                }
            }
        }
        $payload = $docs === [] ? ['slots' => [], 'source' => ['metadata' => ['verse_count' => 0]]] : $this->buildBiblePayload($docs);

        return [
            'corpus' => $corpusRoot,
            'books' => count($docs),
            'verses' => $payload['source']['metadata']['verse_count'],
            'before' => $before + ['slots' => $payload['source']['metadata']['verse_count']],
            'after' => ['slots' => count($payload['slots'])] + $this->gateStats,
        ];
    }

    /**
     * Remove rows from the earlier (wrong) one-book-per-file seed: each biblical
     * sub-book was a separate Book. They are identified by collection metadata +
     * the presence of an `abbr` (the new single Bible book has kind='bible' and no
     * abbr). Deletes each legacy book's positional slots and per-language chapter
     * rows, then the Book row. The SHARED per-language SENTENCE rows are content-
     * keyed and reused by the new single book, so they are NEVER deleted.
     *
     * @return int number of legacy book rows removed
     */
    private function supersedeLegacyPerBookSeed(): int
    {
        $removed = 0;
        try {
            $langs = AppQyV1TableMaps::getSupportedLanguages();

            $legacy = Book::legacyCollectionBooks(self::COLLECTION);
            $sourceKeys = $legacy->pluck('source_key')->filter()->values()->all();
            $bookIds = $legacy->modelKeys();

            SourceSentence::deleteForSources('book', $sourceKeys);

            foreach ($langs as $lang) {
                \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangChapterModel::deleteForSources(
                    $lang,
                    'book',
                    $sourceKeys
                );
            }

            $removed = Book::deleteByIds($bookIds);
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1BookSeed] legacy supersede query failed: ' . $e->getMessage());
        }
        return $removed;
    }

    /** The corpus is ready when its dir exists and holds at least one book file. */
    private function corpusReady(string $corpusRoot): bool
    {
        if (!is_dir($corpusRoot)) {
            return false;
        }
        $files = glob($corpusRoot . DIRECTORY_SEPARATOR . '*.json') ?: [];
        return count($files) > 0;
    }
}
