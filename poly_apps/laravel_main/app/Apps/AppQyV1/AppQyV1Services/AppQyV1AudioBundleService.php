<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Support\AudioOrchestrationContract;
use App\Utils\FileSystemManager;

/**
 * Many word / sentence / phrase clips in one response, in the clip bundle frame shared
 * with pycore (config/audio_orchestration_contract.json transfer): per
 * request item, in order, a 4-byte big-endian header length, a UTF-8 JSON
 * header {index, key, hit, bytes, sent, meaning, version} and the clip bytes when
 * sent. The first hit is always sent; a hit past the byte budget is
 * `sent:false` (the client asks it again). Paths are resolved here from the
 * passive batch lookups (one query per language, no queue writes), never
 * taken from the client.
 */
final class AppQyV1AudioBundleService
{
    public const KIND_WORD = 'word';
    public const KIND_SENTENCE = 'sentence';
    public const KIND_PHRASE = 'phrase';
    public const KINDS = [self::KIND_WORD, self::KIND_SENTENCE, self::KIND_PHRASE];
    private const FRAME_LENGTH_FORMAT = 'N';

    public function __construct(private readonly AppQyV1AudioGateway $gateway = new AppQyV1AudioGateway())
    {
    }

    public static function maxItems(): int
    {
        return (int) AudioOrchestrationContract::transfer('laravel_bundle_max_items');
    }

    public static function mediaType(): string
    {
        return (string) AudioOrchestrationContract::transfer('pycore_bundle_media_type');
    }

    /**
     * @param array<int,array{kind:string,language:string,text:string}> $items
     */
    public function build(array $items): string
    {
        $items = array_values($items);
        $paths = $this->paths($items);
        $budget = (int) AudioOrchestrationContract::transfer('laravel_bundle_max_bytes');
        $sentAny = false;
        $body = '';

        foreach ($items as $index => $item) {
            $path = $paths[$index] ?? null;
            $data = $path !== null ? FileSystemManager::readFile($path, false) : false;
            $hit = is_string($data) && $data !== '';
            $send = $hit && (!$sentAny || strlen($data) <= $budget);
            $header = json_encode([
                'index' => $index,
                'key' => $this->resourceId($item),
                'hit' => $hit,
                'bytes' => $hit ? strlen($data) : 0,
                'sent' => $send,
                'meaning' => '',
                'version' => $hit ? self::fileVersion($path) : null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $body .= pack(self::FRAME_LENGTH_FORMAT, strlen($header)) . $header . ($send ? $data : '');
            if ($send) {
                $budget -= strlen($data);
                $sentAny = true;
            }
        }

        return $body;
    }

    /**
     * What a bundle frame would carry per item index (missing when Laravel holds no file): the content
     * version of the file (its modification time in seconds) and the public URL of that very file - for a
     * sentence with a quality variant that is the variant, not the default file a plain lookup names - so a
     * client can tell a replaced file from the one it holds and fetch exactly the new one.
     *
     * @param array<int,array{kind:string,language:string,text:string}> $items
     * @return array<int,array{version:?int,url:string}>
     */
    public function served(array $items): array
    {
        $served = [];
        foreach ($this->located(array_values($items)) as $index => $file) {
            clearstatcache(true, $file['path']);
            $time = is_file($file['path']) ? filemtime($file['path']) : false;
            if ($time !== false) {
                $served[$index] = ['version' => (int) $time, 'url' => $file['url']];
            }
        }

        return $served;
    }

    /** Content version of a served clip file: its modification time in seconds (null when the file is gone). */
    private static function fileVersion(string $path): ?int
    {
        clearstatcache(true, $path);
        $time = is_file($path) ? filemtime($path) : false;

        return $time === false ? null : (int) $time;
    }

    /**
     * Disk path per item index (missing when Laravel holds no file).
     *
     * @param array<int,array{kind:string,language:string,text:string}> $items
     * @return array<int,string>
     */
    private function paths(array $items): array
    {
        return array_map(static fn (array $file): string => $file['path'], $this->located($items));
    }

    /**
     * Disk path and public URL per item index (missing when Laravel holds no file).
     *
     * @param array<int,array{kind:string,language:string,text:string}> $items
     * @return array<int,array{path:string,url:string}>
     */
    private function located(array $items): array
    {
        $words = [];
        $sentences = [];
        $phrases = [];
        foreach ($items as $index => $item) {
            if ($item['kind'] === self::KIND_WORD) {
                $words[$index] = ['word' => $item['text'], 'language' => $item['language']];
            } elseif ($item['kind'] === self::KIND_SENTENCE) {
                $sentences[$index] = ['text' => $item['text'], 'language' => $item['language']];
            } elseif ($item['kind'] === self::KIND_PHRASE) {
                $phrases[$index] = ['text' => $item['text'], 'language' => $item['language']];
            }
        }

        $files = [];
        if ($words !== []) {
            $indexes = array_keys($words);
            foreach ($this->gateway->resolveWordsPassive(array_values($words)) as $position => $resolved) {
                $url = is_string($resolved['audio_url'] ?? null) ? $resolved['audio_url'] : null;
                $relative = $url !== null ? AppQyV1TtsUrl::relativeOf($url) : null;
                if ($relative !== null) {
                    $files[$indexes[$position]] = ['path' => PathMapper::getAppQyV1AudioBaseDir($relative), 'url' => $url];
                }
            }
        }
        if ($sentences !== []) {
            foreach ($this->gateway->resolveSentencesPassive($sentences) as $index => $resolved) {
                $url = is_string($resolved['url'] ?? null) ? $resolved['url'] : null;
                $relative = $url !== null ? AppQyV1SentenceAudioUrl::relativeOf($url) : null;
                if ($relative !== null) {
                    $quality = $this->qualityRelative($relative);
                    $files[$index] = $quality !== null
                        ? ['path' => PathMapper::getAppQyV1SentenceSoundsDir($quality), 'url' => AppQyV1SentenceAudioUrl::forRelative($quality)]
                        : ['path' => PathMapper::getAppQyV1SentenceSoundsDir($relative), 'url' => $url];
                }
            }
        }
        if ($phrases !== []) {
            foreach ($this->gateway->resolvePhrasesPassive($phrases) as $index => $resolved) {
                if ($resolved['exists']) {
                    $files[$index] = ['path' => (string) $resolved['path'], 'url' => (string) $resolved['url']];
                }
            }
        }

        return $files;
    }

    /** The quality variant of a sentence clip (book plan fast pass upgrade) as a relative path when the server holds it, else null. */
    private function qualityRelative(string $relative): ?string
    {
        $variant = '_' . (string) AudioOrchestrationContract::bookPlan('fast_pass.quality_variant') . '.mp3';
        $candidate = preg_replace('/\.mp3$/i', $variant, $relative) ?? $relative;
        $path = PathMapper::getAppQyV1SentenceSoundsDir($candidate);

        return $path !== null && is_file($path) ? $candidate : null;
    }

    /** The resource id every end uses: sha256("kind:language:content"). */
    private function resourceId(array $item): string
    {
        $content = $item['kind'] === self::KIND_SENTENCE || $item['kind'] === self::KIND_PHRASE
            ? MediaIngestService::computeContentId($item['text'])
            : mb_strtolower(trim($item['text']));

        return self::resourceKey($item['kind'], $item['language'], $content);
    }

    /** Resource id from already normalized content (sentence / phrase content id, trimmed lower-case word). */
    public static function resourceKey(string $kind, string $language, string $content): string
    {
        return hash('sha256', $kind . ':' . $language . ':' . $content);
    }
}
