<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use App\Utils\RedisBucketIndex;
use Generator;

/**
 * Central index of the static resources pycore delivers (contract:
 * docs_fix/REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md,
 * "W7 contract"). Redis (RedisBucketIndex) is only an accelerator: an index
 * hit whose value matches is trusted, every other key is verified against the
 * database/disk and self-healed into the index. Writers call record*() /
 * forget*() after every store or delete; rebuild() re-derives a kind from
 * its source of truth.
 */
final class AppQyV1ResourceIndexService
{
    public const KIND_WORD_AUDIO = 'word_audio';
    public const KIND_SENTENCE_AUDIO = 'sentence_audio';
    public const KIND_ORCH_SEGMENT = 'orch_segment';
    public const KIND_ARTICLE = 'article';
    public const KIND_STATIC_FILE = 'static_file';
    public const INDEXED_KINDS = [
        self::KIND_WORD_AUDIO,
        self::KIND_SENTENCE_AUDIO,
        self::KIND_ORCH_SEGMENT,
        self::KIND_ARTICLE,
        self::KIND_STATIC_FILE,
    ];

    public const REJECT_NO_TARGET = 'no_target';
    public const REJECT_INVALID_KEY = 'invalid_key';
    public const REJECT_UNSUPPORTED_LANGUAGE = 'unsupported_language';

    public const PRESENT_VALUE = '1';
    public const AUDIO_STATIC_SUBDIR = 'app_qy_v1/audio';
    private const MEDIA_KEY_PATTERN = '/^([A-Za-z][A-Za-z_-]{1,15}):([a-f0-9]{32})(?::([A-Za-z0-9_-]{1,32}))?$/';
    private const SHA256_PATTERN = '/^[a-f0-9]{64}$/';
    private const SENTENCE_FILE_PATTERN = '/^([^\/]+)\/([a-f0-9]{32})(?:_([A-Za-z0-9_-]{1,32}))?\.mp3$/';
    private const ORCH_FILE_PATTERN = '/^[a-f0-9]{2}\/([a-f0-9]{64})\.mp3$/';
    private const RECORD_ID_MAX_LENGTH = 191;
    private const REBUILD_CHUNK = 1000;
    private const RECONCILE_ADD_SLICE = 1000;
    private const RECONCILE_VERIFY_SLICE = 500;
    private const META_RECONCILE_BUCKET = 'reconcile:bucket_cursor';
    private const META_RECONCILE_PASS = 'reconcile:pass_completed_at';
    private const META_RECONCILE_ADD = 'reconcile:add_cursor:';

    public function backend(): string
    {
        return RedisBucketIndex::available() ? 'redis' : 'database';
    }

    public static function wordKey(string $language, string $md5, ?string $variantKey = null): string
    {
        return self::mediaKey($language, $md5, $variantKey);
    }

    public static function sentenceKey(string $language, string $contentId, ?string $variantKey = null): string
    {
        return self::mediaKey($language, $contentId, $variantKey);
    }

    public function recordWord(string $language, string $md5, ?string $variantKey = null): void
    {
        RedisBucketIndex::put(self::KIND_WORD_AUDIO, [self::wordKey($language, $md5, $variantKey) => self::PRESENT_VALUE]);
    }

    public function recordSentence(string $language, string $contentId, ?string $variantKey = null): void
    {
        RedisBucketIndex::put(self::KIND_SENTENCE_AUDIO, [self::sentenceKey($language, $contentId, $variantKey) => self::PRESENT_VALUE]);
    }

    public function recordOrchSegment(string $sha256): void
    {
        RedisBucketIndex::put(self::KIND_ORCH_SEGMENT, [strtolower($sha256) => self::PRESENT_VALUE]);
    }

    /** Index the published audio hash of an agent-history article under every pycore record id it carries. */
    public function recordArticle(AppQyV1Article $article): void
    {
        $canonical = AppQyV1Article::resolveCanonicalArticle($article);
        $canonical = AppQyV1Article::findByArticleId((string) $canonical->article_id) ?? $canonical;
        $metadata = is_array($canonical->metadata) ? $canonical->metadata : [];
        $sha256 = (string) ($metadata['audio_sha256'] ?? '');
        $values = [];

        if ((string) $canonical->source !== AppQyV1Article::SOURCE_AGENT_HISTORY || $sha256 === '') {
            return;
        }
        foreach (array_unique(array_merge(self::articleRecordIds($article), self::articleRecordIds($canonical))) as $recordId) {
            $values[$recordId] = $sha256;
        }
        RedisBucketIndex::put(self::KIND_ARTICLE, $values);
    }

    public function forgetArticle(AppQyV1Article $article): void
    {
        RedisBucketIndex::remove(self::KIND_ARTICLE, self::articleRecordIds($article));
    }

    public function recordStaticFile(string $relativePath, int $bytes): void
    {
        RedisBucketIndex::put(self::KIND_STATIC_FILE, [self::normalizeStaticPath($relativePath) => (string) $bytes]);
    }

    public function forgetStaticFile(string $relativePath): void
    {
        RedisBucketIndex::remove(self::KIND_STATIC_FILE, [self::normalizeStaticPath($relativePath)]);
    }

    /** Forget a deleted file given its absolute path; paths outside the static root are ignored. */
    public function forgetStaticPath(string $absolutePath): void
    {
        $root = rtrim(str_replace('\\', '/', PathMapper::getLaravelStaticDir()), '/') . '/';
        $path = str_replace('\\', '/', $absolutePath);

        if (str_starts_with($path, $root)) {
            $this->forgetStaticFile(substr($path, strlen($root)));
        }
    }

    /**
     * Current state of each key: ['value' => stored value|null (absent), 'rejected' => reason|null].
     * $expected maps key => expected value (null = presence only); an index
     * hit is trusted only when it equals the expected value.
     *
     * @param array<string,?string> $expected
     * @return array<string,array{value:?string,rejected:?string}>
     */
    public function resolve(string $kind, array $expected): array
    {
        $indexed = RedisBucketIndex::available() ? RedisBucketIndex::lookup($kind, array_map('strval', array_keys($expected))) : null;
        $result = [];
        $unverified = [];
        $healed = [];
        $dropped = [];

        foreach ($expected as $key => $want) {
            $key = (string) $key;
            $hit = $indexed[$key] ?? null;
            if ($hit !== null && ($want === null || hash_equals($hit, (string) $want))) {
                $result[$key] = ['value' => $hit, 'rejected' => null];
            } else {
                $unverified[] = $key;
            }
        }
        if ($unverified === []) {
            return $result;
        }
        foreach ($this->verify($kind, $unverified) as $key => $state) {
            $result[$key] = $state;
            if ($indexed !== null && $state['value'] !== null && ($indexed[$key] ?? null) !== $state['value']) {
                $healed[$key] = $state['value'];
            } elseif ($indexed !== null && $state['value'] === null && ($indexed[$key] ?? null) !== null) {
                $dropped[] = $key;
            }
        }
        RedisBucketIndex::put($kind, $healed);
        RedisBucketIndex::remove($kind, $dropped);

        return $result;
    }

    /** @return array{backend:string,kinds:array<string,array{entries:?int,built_at:?string}>} */
    public function status(): array
    {
        $meta = RedisBucketIndex::available() ? RedisBucketIndex::meta() : [];
        $kinds = [];

        foreach (self::INDEXED_KINDS as $kind) {
            $kinds[$kind] = [
                'entries' => isset($meta[$kind . ':entries']) ? (int) $meta[$kind . ':entries'] : null,
                'built_at' => $meta[$kind . ':built_at'] ?? null,
            ];
        }

        return ['backend' => $this->backend(), 'kinds' => $kinds];
    }

    /** True when Redis is reachable and every indexed kind has a completed rebuild. */
    public function built(): bool
    {
        $status = $this->status();

        if ($status['backend'] !== 'redis') {
            return false;
        }
        foreach ($status['kinds'] as $kind) {
            if ($kind['built_at'] === null) {
                return false;
            }
        }

        return true;
    }

    /**
     * Time-boxed incremental reconciliation with persisted cursors, at most
     * one full pass per call: (1) add one slice of entries from the
     * database-backed rebuild sources (word, article) after their row cursor;
     * (2) walk the index buckets of every kind in order and re-verify each
     * stored entry against the database/disk, dropping vanished entries and
     * fixing changed values. File-backed kinds get additions from diff
     * self-healing and full rebuilds.
     *
     * @return array{buckets:int,checked:int,dropped:int,updated:int,added:int,pass_completed:bool}
     */
    public function reconcile(float $budgetSeconds): array
    {
        $deadline = microtime(true) + max(0.1, $budgetSeconds);
        $stats = ['buckets' => 0, 'checked' => 0, 'dropped' => 0, 'updated' => 0, 'added' => 0, 'pass_completed' => false];
        $buckets = RedisBucketIndex::buckets();
        $position = (int) (RedisBucketIndex::meta()[self::META_RECONCILE_BUCKET] ?? 0);
        $total = count(self::INDEXED_KINDS) * count($buckets);

        foreach ([self::KIND_WORD_AUDIO, self::KIND_ARTICLE] as $kind) {
            $stats['added'] += $this->reconcileAdditions($kind);
        }
        while (microtime(true) < $deadline && !$stats['pass_completed']) {
            $position %= $total;
            $kind = self::INDEXED_KINDS[intdiv($position, count($buckets))];
            if (!$this->reconcileBucket($kind, $buckets[$position % count($buckets)], $stats)) {
                return $stats;
            }
            $stats['buckets']++;
            $position++;
            if ($position >= $total) {
                $stats['pass_completed'] = true;
                RedisBucketIndex::setMeta([self::META_RECONCILE_PASS => gmdate('c')]);
            }
            RedisBucketIndex::setMeta([self::META_RECONCILE_BUCKET => (string) ($position % $total)]);
        }

        return $stats;
    }

    private function reconcileBucket(string $kind, string $bucket, array &$stats): bool
    {
        $entries = RedisBucketIndex::bucketEntries($kind, $bucket);
        $dropped = [];
        $updated = [];

        if ($entries === null) {
            return false;
        }
        foreach (array_chunk(array_map('strval', array_keys($entries)), self::RECONCILE_VERIFY_SLICE) as $keys) {
            foreach ($this->verify($kind, $keys) as $key => $state) {
                if ($state['value'] === null) {
                    $dropped[] = $key;
                } elseif ($state['value'] !== (string) $entries[$key]) {
                    $updated[$key] = $state['value'];
                }
            }
            $stats['checked'] += count($keys);
        }
        RedisBucketIndex::remove($kind, $dropped);
        RedisBucketIndex::put($kind, $updated);
        $stats['dropped'] += count($dropped);
        $stats['updated'] += count($updated);

        return true;
    }

    /** One slice of rebuild-source entries after the persisted row cursor; wraps at the end. */
    private function reconcileAdditions(string $kind): int
    {
        $metaKey = self::META_RECONCILE_ADD . $kind;
        $after = (string) (RedisBucketIndex::meta()[$metaKey] ?? '');
        $values = [];
        $cursor = $after;

        foreach ($kind === self::KIND_WORD_AUDIO ? $this->wordEntries($after) : $this->articleEntries($after) as [$field, $value, $rowCursor]) {
            // Stop only on a row boundary so a row's variants are never split across runs.
            if (count($values) >= self::RECONCILE_ADD_SLICE && $rowCursor !== $cursor) {
                RedisBucketIndex::put($kind, $values);
                RedisBucketIndex::setMeta([$metaKey => $cursor]);
                return count($values);
            }
            $values[$field] = $value;
            $cursor = $rowCursor;
        }
        RedisBucketIndex::put($kind, $values);
        RedisBucketIndex::setMeta([$metaKey => '']);

        return count($values);
    }

    public function rebuild(string $kind): int
    {
        return RedisBucketIndex::rebuild($kind, match ($kind) {
            self::KIND_WORD_AUDIO => $this->wordEntries(),
            self::KIND_SENTENCE_AUDIO => $this->sentenceEntries(),
            self::KIND_ORCH_SEGMENT => $this->orchSegmentEntries(),
            self::KIND_ARTICLE => $this->articleEntries(),
            self::KIND_STATIC_FILE => $this->staticFileEntries(),
        });
    }

    /** @return array<string,array{value:?string,rejected:?string}> */
    private function verify(string $kind, array $keys): array
    {
        return match ($kind) {
            self::KIND_WORD_AUDIO => $this->verifyWords($keys),
            self::KIND_SENTENCE_AUDIO => $this->verifySentences($keys),
            self::KIND_ORCH_SEGMENT => $this->verifyOrchSegments($keys),
            self::KIND_ARTICLE => $this->verifyArticles($keys),
            self::KIND_STATIC_FILE => $this->verifyStaticFiles($keys),
        };
    }

    private function verifyWords(array $keys): array
    {
        $result = [];
        $byLanguage = [];

        foreach ($keys as $key) {
            $parsed = self::parseMediaKey($key);
            if ($parsed === null) {
                $result[$key] = self::rejected(self::REJECT_INVALID_KEY);
                continue;
            }
            $byLanguage[$parsed['language']][$key] = $parsed;
        }
        foreach ($byLanguage as $language => $items) {
            if (!in_array($language, AppQyV1DictionaryTTSCoordinator::supportedLanguages(), true)
                || !AppQyV1LangDictionaryModel::languageTableExists($language)) {
                foreach (array_keys($items) as $key) {
                    $result[$key] = self::rejected(self::REJECT_UNSUPPORTED_LANGUAGE);
                }
                continue;
            }
            $rows = AppQyV1LangDictionaryModel::rowsByHashes($language, array_column($items, 'hash'))->keyBy('md5');
            foreach ($items as $key => $parsed) {
                $row = $rows->get($parsed['hash']);
                if ($row === null) {
                    $result[$key] = self::rejected(self::REJECT_NO_TARGET);
                    continue;
                }
                $present = $parsed['variant'] === ''
                    ? (!empty($row->has_audio) || AppQyV1WordAudioFiles::hasVariantWithFile($row, ''))
                    : AppQyV1WordAudioFiles::hasVariantWithFile($row, $parsed['variant']);
                $result[$key] = ['value' => $present ? self::PRESENT_VALUE : null, 'rejected' => null];
            }
        }

        return $result;
    }

    private function verifySentences(array $keys): array
    {
        $result = [];
        $sentenceAudio = app(AppQyV1SentenceAudioService::class);

        foreach ($keys as $key) {
            $parsed = self::parseMediaKey($key);
            if ($parsed === null) {
                $result[$key] = self::rejected(self::REJECT_INVALID_KEY);
            } elseif (!self::sentenceLanguageExists($parsed['language'])) {
                $result[$key] = self::rejected(self::REJECT_UNSUPPORTED_LANGUAGE);
            } else {
                $result[$key] = [
                    'value' => $sentenceAudio->variantExistsOnDisk($parsed['language'], $parsed['hash'], $parsed['variant'])
                        ? self::PRESENT_VALUE
                        : null,
                    'rejected' => null,
                ];
            }
        }

        return $result;
    }

    private function verifyOrchSegments(array $keys): array
    {
        $result = [];

        foreach ($keys as $key) {
            $result[$key] = preg_match(self::SHA256_PATTERN, $key) !== 1
                ? self::rejected(self::REJECT_INVALID_KEY)
                : ['value' => self::nonEmptyFile(self::orchSegmentPath($key)) ? self::PRESENT_VALUE : null, 'rejected' => null];
        }

        return $result;
    }

    private function verifyArticles(array $keys): array
    {
        $result = [];

        foreach ($keys as $key) {
            if ($key === '' || strlen($key) > self::RECORD_ID_MAX_LENGTH) {
                $result[$key] = self::rejected(self::REJECT_INVALID_KEY);
                continue;
            }
            $article = AppQyV1Article::findAgentHistoryBySourceRecordId($key);
            $metadata = $article !== null ? AppQyV1Article::resolveCanonicalArticle($article)->metadata : null;
            $metadata = is_array($metadata) ? $metadata : [];
            $sha256 = (string) ($metadata['audio_sha256'] ?? '');
            // An article without a published audio hash exists but its audio
            // state is unknown: report it as present with an empty hash.
            $result[$key] = ['value' => $article === null ? null : $sha256, 'rejected' => null];
        }

        return $result;
    }

    private function verifyStaticFiles(array $keys): array
    {
        $result = [];

        foreach ($keys as $key) {
            $path = self::normalizeStaticPath($key);
            if ($path === '' || $path !== $key) {
                $result[$key] = self::rejected(self::REJECT_INVALID_KEY);
                continue;
            }
            $full = PathMapper::getLaravelStaticDir($path);
            clearstatcache(true, $full);
            $result[$key] = ['value' => is_file($full) ? (string) filesize($full) : null, 'rejected' => null];
        }

        return $result;
    }

    /**
     * Word entries from the dictionary rows, resumable after the cursor
     * "<language>:<row id>"; every entry carries the cursor of its row.
     */
    private function wordEntries(string $after = ''): Generator
    {
        [$afterLanguage, $afterId] = array_pad(explode(':', $after, 2), 2, '0');
        $languages = AppQyV1DictionaryTTSCoordinator::supportedLanguages();
        $start = $after !== '' ? array_search($afterLanguage, $languages, true) : 0;

        foreach (array_slice($languages, $start === false ? 0 : (int) $start) as $language) {
            if (!AppQyV1LangDictionaryModel::languageTableExists($language)) {
                continue;
            }
            $columns = AppQyV1LangDictionaryModel::languageColumnAvailability($language, ['has_audio', 'audio_files']);
            if (!$columns['has_audio']) {
                continue;
            }
            $query = AppQyV1LangDictionaryModel::forLanguage($language)->newQuery()
                ->where(function ($audio) use ($columns): void {
                    $audio->where('has_audio', true);
                    if ($columns['audio_files']) {
                        $audio->orWhereNotNull('audio_files');
                    }
                })
                ->select(array_merge(['id', 'md5', 'has_audio'], $columns['audio_files'] ? ['audio_files'] : []));
            if ($after !== '' && $language === $afterLanguage) {
                $query->where('id', '>', (int) $afterId);
            }
            foreach ($query->lazyById(self::REBUILD_CHUNK) as $row) {
                $cursor = $language . ':' . $row->id;
                if (!empty($row->has_audio)) {
                    yield [self::wordKey($language, (string) $row->md5), self::PRESENT_VALUE, $cursor];
                }
                foreach (is_array($row->audio_files) ? $row->audio_files : [] as $file) {
                    $variant = is_array($file) ? (string) ($file['variant_key'] ?? '') : '';
                    if ($variant !== '' && !empty($file['has_file']) && (string) ($file['path'] ?? '') !== '') {
                        yield [self::wordKey($language, (string) $row->md5, $variant), self::PRESENT_VALUE, $cursor];
                    }
                }
            }
        }
    }

    private function sentenceEntries(): Generator
    {
        foreach (FileSystemManager::iterateFiles(PathMapper::getAppQyV1SentenceSoundsDir()) as $relative => $file) {
            if ($file->getSize() > 0 && preg_match(self::SENTENCE_FILE_PATTERN, $relative, $match) === 1) {
                yield [self::sentenceKey($match[1], $match[2], $match[3] ?? null), self::PRESENT_VALUE];
            }
        }
    }

    private function orchSegmentEntries(): Generator
    {
        foreach (FileSystemManager::iterateFiles(PathMapper::getAppQyV1AudioBaseDir(AppQyV1OrchAudioService::SEGMENT_AUDIO_SUBDIR)) as $relative => $file) {
            if ($file->getSize() > 0 && preg_match(self::ORCH_FILE_PATTERN, $relative, $match) === 1) {
                yield [$match[1], self::PRESENT_VALUE];
            }
        }
    }

    /** Agent-history article entries, resumable after the cursor "<row id>". */
    private function articleEntries(string $after = ''): Generator
    {
        $query = AppQyV1Article::query()
            ->where('source', AppQyV1Article::SOURCE_AGENT_HISTORY)
            ->where('id', '>', (int) $after)
            ->select(['id', 'article_id', 'canonical_article_id', 'source', 'metadata']);

        foreach ($query->lazyById(self::REBUILD_CHUNK) as $article) {
            $canonical = AppQyV1Article::resolveCanonicalArticle($article);
            $metadata = is_array($canonical->metadata) ? $canonical->metadata : [];
            foreach (self::articleRecordIds($article) as $recordId) {
                yield [$recordId, (string) ($metadata['audio_sha256'] ?? ''), (string) $article->id];
            }
        }
    }

    private function staticFileEntries(): Generator
    {
        foreach (FileSystemManager::iterateFiles(PathMapper::getLaravelStaticDir()) as $relative => $file) {
            // Word/sentence/orchestration/article audio is covered by its own kind.
            if (!str_starts_with($relative, self::AUDIO_STATIC_SUBDIR . '/')) {
                yield [$relative, (string) $file->getSize()];
            }
        }
    }

    private static function articleRecordIds(AppQyV1Article $article): array
    {
        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $ids = array_merge(
            [(string) ($metadata['source_record_id'] ?? ''), (string) ($metadata['idempotency_key'] ?? '')],
            array_map('strval', is_array($metadata['source_record_ids'] ?? null) ? $metadata['source_record_ids'] : [])
        );

        return array_values(array_unique(array_filter(
            array_map('trim', $ids),
            static fn (string $id): bool => $id !== '' && strlen($id) <= self::RECORD_ID_MAX_LENGTH
        )));
    }

    private static function mediaKey(string $language, string $hash, ?string $variantKey): string
    {
        $key = AppQyV1TableMaps::normalizeLangCode($language) . ':' . strtolower($hash);

        return $variantKey !== null && $variantKey !== '' ? $key . ':' . $variantKey : $key;
    }

    /** @return array{language:string,hash:string,variant:string}|null */
    public static function parseMediaKey(string $key): ?array
    {
        if (preg_match(self::MEDIA_KEY_PATTERN, $key, $match) !== 1) {
            return null;
        }
        $language = AppQyV1TableMaps::normalizeLangCode($match[1]);
        if ($language === '' || self::mediaKey($language, $match[2], $match[3] ?? null) !== $key) {
            return null;
        }

        return ['language' => $language, 'hash' => $match[2], 'variant' => (string) ($match[3] ?? '')];
    }

    private static function sentenceLanguageExists(string $language): bool
    {
        static $cache = [];

        return $cache[$language] ??= LangSentence::tableExists($language);
    }

    public static function orchSegmentPath(string $sha256): string
    {
        return PathMapper::getAppQyV1AudioBaseDir(AppQyV1OrchAudioService::segmentAudioRelative($sha256));
    }

    public static function normalizeStaticPath(string $path): string
    {
        $path = trim(str_replace('\\', '/', $path), '/');
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return '';
            }
        }

        return $path;
    }

    private static function nonEmptyFile(string $path): bool
    {
        clearstatcache(true, $path);

        return is_file($path) && filesize($path) > 0;
    }

    private static function rejected(string $reason): array
    {
        return ['value' => null, 'rejected' => $reason];
    }
}
