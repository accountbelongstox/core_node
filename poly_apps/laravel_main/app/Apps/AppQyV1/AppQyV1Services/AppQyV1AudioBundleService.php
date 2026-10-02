<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Support\AudioOrchestrationContract;
use App\Utils\FileSystemManager;

/**
 * Many word / sentence clips in one response, in the clip bundle frame shared
 * with pycore (config/audio_orchestration_contract.json transfer): per
 * request item, in order, a 4-byte big-endian header length, a UTF-8 JSON
 * header {index, key, hit, bytes, sent, meaning} and the clip bytes when
 * sent. The first hit is always sent; a hit past the byte budget is
 * `sent:false` (the client asks it again). Paths are resolved here from the
 * passive batch lookups (one query per language, no queue writes), never
 * taken from the client.
 */
final class AppQyV1AudioBundleService
{
    public const KIND_WORD = 'word';
    public const KIND_SENTENCE = 'sentence';
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
     * Disk path per item index (missing when Laravel holds no file).
     *
     * @param array<int,array{kind:string,language:string,text:string}> $items
     * @return array<int,string>
     */
    private function paths(array $items): array
    {
        $words = [];
        $sentences = [];
        foreach ($items as $index => $item) {
            if ($item['kind'] === self::KIND_WORD) {
                $words[$index] = ['word' => $item['text'], 'language' => $item['language']];
            } elseif ($item['kind'] === self::KIND_SENTENCE) {
                $sentences[$index] = ['text' => $item['text'], 'language' => $item['language']];
            }
        }

        $paths = [];
        if ($words !== []) {
            $indexes = array_keys($words);
            foreach ($this->gateway->resolveWordsPassive(array_values($words)) as $position => $resolved) {
                $relative = is_string($resolved['audio_url'] ?? null) ? AppQyV1TtsUrl::relativeOf($resolved['audio_url']) : null;
                if ($relative !== null) {
                    $paths[$indexes[$position]] = PathMapper::getAppQyV1AudioBaseDir($relative);
                }
            }
        }
        if ($sentences !== []) {
            foreach ($this->gateway->resolveSentencesPassive($sentences) as $index => $resolved) {
                $relative = is_string($resolved['url'] ?? null) ? AppQyV1SentenceAudioUrl::relativeOf($resolved['url']) : null;
                if ($relative !== null) {
                    $paths[$index] = $this->qualityPath($relative) ?? PathMapper::getAppQyV1SentenceSoundsDir($relative);
                }
            }
        }

        return $paths;
    }

    /** The quality variant of a sentence clip (book plan fast pass upgrade) when the server holds it, else null. */
    private function qualityPath(string $relative): ?string
    {
        $variant = '_' . (string) AudioOrchestrationContract::bookPlan('fast_pass.quality_variant') . '.mp3';
        $path = PathMapper::getAppQyV1SentenceSoundsDir(preg_replace('/\.mp3$/i', $variant, $relative) ?? $relative);

        return $path !== null && is_file($path) ? $path : null;
    }

    /** The resource id every end uses: sha256("kind:language:content"). */
    private function resourceId(array $item): string
    {
        $content = $item['kind'] === self::KIND_SENTENCE
            ? MediaIngestService::computeContentId($item['text'])
            : mb_strtolower(trim($item['text']));

        return self::resourceKey($item['kind'], $item['language'], $content);
    }

    /** Resource id from already normalized content (sentence content id, trimmed lower-case word). */
    public static function resourceKey(string $kind, string $language, string $content): string
    {
        return hash('sha256', $kind . ':' . $language . ':' . $content);
    }
}
