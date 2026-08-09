<?php

// AI editing rules for this file:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, migrate, or start
//    the server. Delivering the written code is the entire task.

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Providers\PathMapper;
use App\Providers\AppTablePrefixServiceProvider;
use App\Constants\AppKeys;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MediaIngestService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

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
 *   1. Locate the committed `.js`-disguised blob (lives cleanly in the code tree).
 *   2. Copy it to a RUNTIME temp dir, ensure decompression tooling, extract THERE
 *      (the code tree is never polluted with the extracted JSON).
 *   3. Transcode the WHOLE corpus into ONE model_version:3 payload (one book ->
 *      66 chapters -> per-language verse slots) and hand it to
 *      MediaIngestService::ingest() (one atomic transaction, fill-missing).
 *   4. Supersede any legacy per-book rows from the earlier (wrong) one-book-per-
 *      file seed, then delete the temp dir.
 *
 * Idempotency: the completion sentinel is the single Bible book's source_key
 * (isSeeded()); the v3 ingest is one transaction, so the book row exists iff the
 * whole seed committed.
 */
class AppQyV1BookSeedImporter
{
    /** Committed blob, relative to the laravel_main app dir. `.js`-disguised xz tar. */
    private const SEED_REL_PATH = 'database/seed_data/books/bible-corpus.unique.tar.xz.js';

    /** Top-level directory name packed inside the archive. */
    private const CORPUS_DIRNAME = 'zeoinjesus-bible';

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
    public static function isSeeded(): bool
    {
        try {
            return Book::where('source_key', self::bibleSourceKey())->exists();
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
        $blobPath = PathMapper::getLaravelMainDir() . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, self::SEED_REL_PATH);

        if (!is_file($blobPath)) {
            return ['status' => 'warning', 'message' => 'Book seed blob not found: ' . $blobPath];
        }

        // Already the single Bible book: clean up any leftover legacy per-book rows
        // (idempotent) and return WITHOUT decompressing.
        if (self::isSeeded()) {
            $removed = $this->supersedeLegacyPerBookSeed();
            return [
                'status' => 'success',
                'message' => 'Bible already seeded as one book'
                    . ($removed ? " (removed {$removed} legacy per-book rows)" : ''),
            ];
        }

        $tempDir = PathMapper::getLaravelTmpDir('books_seed_' . uniqid());

        try {
            File::makeDirectory($tempDir, 0755, true, true);

            $this->ensureDecompressors();

            $corpusRoot = $this->restoreAndExtract($blobPath, $tempDir);
            if ($corpusRoot === null) {
                return [
                    'status' => 'warning',
                    'message' => 'Could not decompress the book seed (xz/tar/7z unavailable); will retry next init',
                ];
            }

            $files = $this->listBookFiles($corpusRoot);
            if (empty($files)) {
                return ['status' => 'warning', 'message' => 'No book files found inside the extracted corpus'];
            }

            $docs = [];
            foreach ($files as $file) {
                $doc = json_decode((string) file_get_contents($file), true);
                if (is_array($doc) && isset($doc['book'])) {
                    $docs[] = $doc;
                }
            }
            if (empty($docs)) {
                return ['status' => 'warning', 'message' => 'No valid book documents in the corpus'];
            }

            // ONE book -> N chapters (one per biblical sub-book), one atomic ingest.
            $payload = $this->buildBiblePayload($docs);
            try {
                app(MediaIngestService::class)->ingest($payload);
            } catch (\Throwable $e) {
                Log::error('[AppQyV1BookSeed] Bible ingest failed: ' . $e->getMessage());
                return ['status' => 'warning', 'message' => 'Bible ingest failed: ' . $e->getMessage()];
            }

            // Now the single Bible book exists -> remove the legacy 66-book rows.
            $removed = $this->supersedeLegacyPerBookSeed();
            $complete = self::isSeeded();

            return [
                'status' => $complete ? 'success' : 'warning',
                'message' => sprintf(
                    'Seeded the Bible as ONE book (%d chapters, %d verses)%s',
                    count($payload['chapters']),
                    count($payload['slots']),
                    $removed ? " [superseded {$removed} legacy per-book rows]" : ''
                ),
            ];
        } catch (\Throwable $e) {
            Log::error('[AppQyV1BookSeed] Seed failed: ' . $e->getMessage());
            return ['status' => 'warning', 'message' => 'Book seed error: ' . $e->getMessage()];
        } finally {
            try {
                if (is_dir($tempDir)) {
                    File::deleteDirectory($tempDir);
                }
            } catch (\Throwable $e) {
                Log::warning('[AppQyV1BookSeed] Temp cleanup failed: ' . $e->getMessage());
            }
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
            $bookVerseStart = $verseTotal;

            foreach (($doc['chapters'] ?? []) as $chapter) {
                $chapterNo = (int) ($chapter['chapter'] ?? 0);
                foreach (($chapter['verses'] ?? []) as $verse) {
                    $texts = is_array($verse['texts'] ?? null) ? $verse['texts'] : [];
                    $langs = [];
                    foreach (self::LANG_VERSION as $langCode => $version) {
                        $text = isset($texts[$version]) ? (string) $texts[$version] : '';
                        // null when the edition lacks this verse -> empty correspondence (留空).
                        $langs[$langCode] = $text !== '' ? $text : null;
                    }
                    $verseNo = (int) ($verse['verse'] ?? 0);

                    $slots[] = [
                        // One chapter == this sub-book; the verse's REAL chapter:verse
                        // lives in metadata so the reader can show "Genesis 1:1".
                        'chapter_index' => $chapterIndex,
                        'grain' => 'sentence',
                        'seq' => $seq,
                        'primary_language' => self::PRIMARY_LANGUAGE,
                        'langs' => $langs,
                        'metadata' => [
                            'book' => $english,
                            'abbr' => $abbr,
                            'book_chapter' => $chapterNo,
                            'verse' => $verseNo,
                            'ref' => $chapterNo . ':' . $verseNo,
                        ],
                    ];
                    $seq++;
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
                'sentence_count' => $verseTotal - $bookVerseStart,
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
                'sentence_count' => $verseTotal,
                'metadata' => [
                    'source' => 'zeoinjesus.com',
                    'collection' => self::COLLECTION,
                    'kind' => 'bible',
                    'chapter_count' => $chapterIndex,
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
            $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
            $langs = AppQyV1TableMaps::getSupportedLanguages();

            $legacy = Book::query()
                ->where('metadata->collection', self::COLLECTION)
                ->whereNotNull('metadata->abbr')
                ->get();

            foreach ($legacy as $book) {
                $key = $book->source_key;
                try {
                    SourceSentence::where('source_type', 'book')->where('source_key', $key)->delete();

                    foreach ($langs as $lang) {
                        $table = AppQyV1TableMaps::getChapterTableName($lang);
                        if (Schema::connection($connection)->hasTable($table)) {
                            DB::connection($connection)->table($table)
                                ->where('source_type', 'book')
                                ->where('source_key', $key)
                                ->delete();
                        }
                    }

                    $book->delete();
                    $removed++;
                } catch (\Throwable $e) {
                    Log::warning('[AppQyV1BookSeed] legacy supersede failed for ' . $key . ': ' . $e->getMessage());
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1BookSeed] legacy supersede query failed: ' . $e->getMessage());
        }
        return $removed;
    }

    /**
     * Restore the `.js`-disguised blob to its real `.tar.xz` name inside the
     * temp dir and extract it there. Returns the corpus root dir on success,
     * null if every decompression strategy failed.
     */
    private function restoreAndExtract(string $blobPath, string $tempDir): ?string
    {
        $archive = $tempDir . DIRECTORY_SEPARATOR . 'bible-corpus.unique.tar.xz';
        if (!@copy($blobPath, $archive)) {
            Log::warning('[AppQyV1BookSeed] Failed to copy seed blob into temp dir');
            return null;
        }

        $corpusRoot = $tempDir . DIRECTORY_SEPARATOR . self::CORPUS_DIRNAME;

        // A. GNU tar with xz.
        $this->runCommand('tar -xJf ' . escapeshellarg($archive) . ' -C ' . escapeshellarg($tempDir));
        if ($this->corpusReady($corpusRoot)) {
            return $corpusRoot;
        }

        // B. Decompress xz to a plain tar, then untar (no pipes -> portable).
        $tarPath = $tempDir . DIRECTORY_SEPARATOR . 'bible-corpus.unique.tar';
        $this->runCommand('xz -dkc ' . escapeshellarg($archive) . ' > ' . escapeshellarg($tarPath));
        if (is_file($tarPath)) {
            $this->runCommand('tar -xf ' . escapeshellarg($tarPath) . ' -C ' . escapeshellarg($tempDir));
            if ($this->corpusReady($corpusRoot)) {
                return $corpusRoot;
            }
        }

        // C. 7z two-step.
        $this->runCommand('7z x ' . escapeshellarg($archive) . ' -o' . escapeshellarg($tempDir) . ' -y');
        if (!is_file($tarPath)) {
            $candidates = glob($tempDir . DIRECTORY_SEPARATOR . '*.tar') ?: [];
            $tarPath = $candidates[0] ?? $tarPath;
        }
        if (is_file($tarPath)) {
            $this->runCommand('7z x ' . escapeshellarg($tarPath) . ' -o' . escapeshellarg($tempDir) . ' -y');
            if ($this->corpusReady($corpusRoot)) {
                return $corpusRoot;
            }
        }

        return null;
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

    /**
     * Best-effort, idempotent guarantee that decompression tooling exists. If
     * tar plus (xz or 7z) are already present this is a no-op; otherwise it
     * attempts a platform install. Never fatal — extraction is tried regardless.
     */
    private function ensureDecompressors(): void
    {
        $haveTar = $this->commandExists('tar');
        $haveXz = $this->commandExists('xz');
        $have7z = $this->commandExists('7z');

        if ($haveTar && ($haveXz || $have7z)) {
            return;
        }

        if (PathMapper::isWindows()) {
            return;
        }

        if ($this->commandExists('apt-get')) {
            $this->runCommand('apt-get install -y xz-utils tar || sudo apt-get install -y xz-utils tar');
        }
    }

    /** True if a command is resolvable on PATH (cross-OS). */
    private function commandExists(string $name): bool
    {
        $probe = PathMapper::isWindows()
            ? 'where ' . escapeshellarg($name)
            : 'command -v ' . escapeshellarg($name);
        $res = $this->runCommand($probe);
        return $res['rc'] === 0 && trim($res['out']) !== '';
    }

    /**
     * Run a shell command, capturing combined output and return code.
     * Returns ['rc' => int, 'out' => string].
     */
    private function runCommand(string $command): array
    {
        if (!function_exists('exec')) {
            return ['rc' => 127, 'out' => 'exec() disabled'];
        }
        $out = [];
        $rc = 1;
        @exec($command . ' 2>&1', $out, $rc);
        return ['rc' => (int) $rc, 'out' => implode("\n", $out)];
    }
}
