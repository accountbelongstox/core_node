<?php

// AI editing rules for this file:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, migrate, or start
//    the server. Delivering the written code is the entire task.

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Models\Book;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * AppQyV1BookSeedImporter
 * -------------------------------------------------------------------------
 * Idempotently seeds an INITIAL book list into the AppQyV1 database from a
 * compressed corpus that ships in the repository, so a fresh install already
 * has books to read without any network fetch.
 *
 * The shipped corpus is the zeoinjesus.com Chinese/English parallel Bible
 * (66 books, public-domain KJV + 和合本 chosen as the seeded bilingual pair).
 * For personal academic / devotional study use only.
 *
 * Pipeline (called from AppQyV1Initializer's `seed_books` step, AFTER the
 * Books v3 tables exist and are verified):
 *   1. Locate the committed blob. It ships with a `.js` extension so it lives
 *      cleanly in the code tree; nothing else from it is ever written there.
 *   2. Copy it to a RUNTIME temp dir (PathMapper::getLaravelTmpDir) under its
 *      real `.tar.xz` name, ensure decompression tooling, and extract THERE.
 *      The code tree is never polluted with the extracted JSON.
 *   3. Transcode each book document into a Books v3 ingest payload
 *      (chapter -> per-language correspondence slots) and hand it to
 *      MediaIngestService::ingest(), which upserts fill-missing / never clobber.
 *   4. Delete the temp dir.
 *
 * Idempotency: a completion sentinel (the last book) is checked first via
 * isSeeded(); MediaIngestService is itself fill-missing, so a partial/repeat
 * run only adds what is missing and never regresses existing rows.
 */
class AppQyV1BookSeedImporter
{
    /** Committed blob, relative to the laravel_main app dir. `.js`-disguised xz tar. */
    private const SEED_REL_PATH = 'database/seed_data/books/bible-corpus.unique.tar.xz.js';

    /** Top-level directory name packed inside the archive. */
    private const CORPUS_DIRNAME = 'zeoinjesus-bible';

    /** Stable namespace for this seed collection (part of every source_key). */
    private const COLLECTION = 'zeoinjesus-bible';

    /** Primary language (L0) for the seeded bilingual pair. */
    private const PRIMARY_LANGUAGE = 'en';

    /**
     * Which corpus version maps onto each seeded language code. Both chosen
     * editions are public-domain so the seed is safe to commit:
     *   en <- KJV (King James Version, 1611)
     *   zh <- CUV (和合本 Chinese Union Version, 1919)
     * The other four editions (lzz/ncv/nasb/niv) remain available inside the
     * shipped corpus blob and are recorded in book metadata, but are not
     * inserted to keep the seeded DB lean.
     */
    private const LANG_VERSION = [
        'en' => 'kjv',
        'zh' => 'cuv',
    ];

    /** All editions present in the corpus (for book metadata only). */
    private const AVAILABLE_VERSIONS = ['cuv', 'kjv', 'lzz', 'nasb', 'ncv', 'niv'];

    /** Last book in the catalogue order; its presence means a full seed completed. */
    private const SENTINEL_ABBR = 'mal';

    /**
     * Deterministic per-book source_key. Stable across machines/runs so re-seeds
     * reconcile onto the same rows.
     */
    public static function seedSourceKey(string $abbr): string
    {
        return sha1(self::COLLECTION . '|book|' . strtolower($abbr));
    }

    /**
     * Cheap DB truth check: is the corpus already fully seeded? Used both by the
     * importer fast-path and by AppQyV1Initializer::stepStillSatisfiedInDb so a
     * stale status flag can never wrongly skip an un-seeded database.
     */
    public static function isSeeded(): bool
    {
        try {
            return Book::where('source_key', self::seedSourceKey(self::SENTINEL_ABBR))->exists();
        } catch (\Throwable $e) {
            // Cannot determine -> treat as not seeded so the seed step can run.
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
            return [
                'status' => 'warning',
                'message' => 'Book seed blob not found: ' . $blobPath,
            ];
        }

        if (self::isSeeded()) {
            return [
                'status' => 'success',
                'message' => 'Book corpus already seeded (sentinel present)',
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
                return [
                    'status' => 'warning',
                    'message' => 'No book files found inside the extracted corpus',
                ];
            }

            $books = 0;
            $failed = 0;
            $sentences = 0;
            $chapters = 0;

            foreach ($files as $file) {
                $doc = json_decode((string) file_get_contents($file), true);
                if (!is_array($doc) || !isset($doc['book'])) {
                    $failed++;
                    continue;
                }
                try {
                    $res = $this->ingestBook($doc);
                    $books++;
                    $chapters += (int) ($res['chapters']['created'] ?? 0);
                    $sentences += (int) ($res['sentences']['created'] ?? 0);
                } catch (\Throwable $e) {
                    $failed++;
                    Log::warning('[AppQyV1BookSeed] Book ingest failed', [
                        'file' => basename($file),
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // A clean run is only "success" when the completion sentinel actually
            // landed in the DB; otherwise stay 'warning' so the step re-runs and
            // fills the remainder (fill-missing makes that safe).
            $complete = $failed === 0 && self::isSeeded();

            return [
                'status' => $complete ? 'success' : 'warning',
                'message' => sprintf(
                    'Seeded %d book(s) (%d new chapters, %d new sentences)%s',
                    $books,
                    $chapters,
                    $sentences,
                    $failed ? ", {$failed} failed" : ''
                ),
                'books' => $books,
                'failed' => $failed,
            ];
        } catch (\Throwable $e) {
            Log::error('[AppQyV1BookSeed] Seed failed: ' . $e->getMessage());
            return [
                'status' => 'warning',
                'message' => 'Book seed error: ' . $e->getMessage(),
            ];
        } finally {
            // Never leave the extracted corpus behind (no code-tree pollution and
            // no runtime bloat).
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
     * Build a Books v3 ingest payload from one corpus book document and hand it
     * to MediaIngestService. All idempotency/dedup happens inside the service.
     */
    private function ingestBook(array $doc): array
    {
        $payload = $this->buildBookPayload($doc);
        return app(MediaIngestService::class)->ingest($payload);
    }

    /**
     * Transcode a corpus book document into the model_version:3 payload
     * (chapter -> per-language slot tree). See BOOKS_FEATURE_SPECIFICATION.md §7.
     */
    private function buildBookPayload(array $doc): array
    {
        $book = $doc['book'];
        $abbr = (string) ($book['abbr'] ?? '');
        $sourceKey = self::seedSourceKey($abbr);

        $chapters = [];
        $slots = [];
        $seq = 0;
        $verseTotal = 0;

        foreach (($doc['chapters'] ?? []) as $chapter) {
            $chapterNo = (int) ($chapter['chapter'] ?? 0);
            $chapterIndex = max(0, $chapterNo - 1);

            $chapters[] = [
                'chapter_index' => $chapterIndex,
                'title' => 'Chapter ' . $chapterNo,
                'sentence_count' => (int) ($chapter['verseCount'] ?? count($chapter['verses'] ?? [])),
            ];

            foreach (($chapter['verses'] ?? []) as $verse) {
                $texts = is_array($verse['texts'] ?? null) ? $verse['texts'] : [];
                $langs = [];
                foreach (self::LANG_VERSION as $langCode => $version) {
                    $text = isset($texts[$version]) ? (string) $texts[$version] : '';
                    // null when the edition lacks this verse -> recorded as an
                    // empty correspondence (留空) by the ingest service.
                    $langs[$langCode] = $text !== '' ? $text : null;
                }

                $slots[] = [
                    'chapter_index' => $chapterIndex,
                    'grain' => 'sentence',
                    'seq' => $seq,
                    'primary_language' => self::PRIMARY_LANGUAGE,
                    'langs' => $langs,
                    'metadata' => [
                        'chapter' => $chapterNo,
                        'verse' => (int) ($verse['verse'] ?? 0),
                    ],
                ];
                $seq++;
                $verseTotal++;
            }
        }

        return [
            'source_type' => 'book',
            'model_version' => 3,
            'source' => [
                'source_key' => $sourceKey,
                'title' => (string) ($book['english'] ?? $abbr),
                'original_name' => (string) ($book['name'] ?? ''),
                'ascii_name' => (string) ($book['english'] ?? ''),
                'language' => self::PRIMARY_LANGUAGE,
                // Drives MediaIngestService::selectedLanguages() so a per-language
                // chapter row is created for BOTH seeded languages (a language
                // without a chapter title gets a null-title row / 留空), not just
                // the primary. Without this, zh chapters would be missing.
                'selected_languages' => array_keys(self::LANG_VERSION),
                'sentence_count' => $verseTotal,
                'metadata' => [
                    'source' => 'zeoinjesus.com',
                    'collection' => self::COLLECTION,
                    'testament' => (string) ($book['testament'] ?? ''),
                    'order' => (int) ($book['order'] ?? 0),
                    'abbr' => $abbr,
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
     * Restore the `.js`-disguised blob to its real `.tar.xz` name inside the
     * temp dir and extract it there. Returns the corpus root dir on success,
     * null if every decompression strategy failed.
     *
     * Strategies (first that yields the corpus dir wins), all cross-OS:
     *   A. `tar -xJf` (GNU tar with built-in xz)
     *   B. `xz -dkc > file.tar` then `tar -xf`
     *   C. 7z two-step (`7z x` xz -> tar, then `7z x` tar)
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
            // 7z may name the inner tar after the archive stem.
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
     * attempts a platform install. Never fatal — extraction is tried regardless
     * and the step degrades to a 'warning' (retry next init) if it cannot run.
     */
    private function ensureDecompressors(): void
    {
        $haveTar = $this->commandExists('tar');
        $haveXz = $this->commandExists('xz');
        $have7z = $this->commandExists('7z');

        if ($haveTar && ($haveXz || $have7z)) {
            return;
        }

        // Windows dev/runtime ships tar + xz via Git for Windows and a 7z binary;
        // do not attempt a package-manager install there.
        if (PathMapper::isWindows()) {
            return;
        }

        // Linux: try apt-get (Debian/Ubuntu, the project's target). Harmless if
        // it lacks privileges — we just fall through and let extraction try.
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
     * Run a shell command, capturing combined output and return code. Returns
     * ['rc' => int, 'out' => string]. exec() is the same primitive the existing
     * AppQyV1 archive extractor uses.
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
