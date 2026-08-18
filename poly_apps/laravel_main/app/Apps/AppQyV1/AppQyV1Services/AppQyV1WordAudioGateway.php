<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Providers\PathMapper;

class AppQyV1WordAudioGateway
{
    private const MAX_AUDIO_VARIANTS = 20;

    private AppQyV1UnifiedTTSQueueService $ttsQueue;

    public function __construct(?AppQyV1UnifiedTTSQueueService $ttsQueue = null)
    {
        $this->ttsQueue = $ttsQueue ?? new AppQyV1UnifiedTTSQueueService();
    }

    /**
     * File-first word-audio gateway. A miss extracts the existing queue task to
     * the head or inserts a new task at the head through QueueCenterService.
     */
    public function request(
        string $word,
        string $language,
        ?string $accent = null,
        bool $enqueueMissing = true,
        bool $moveToHead = true
    ): array {
        $word = trim($word);
        $language = AppQyV1DictionaryService::getLanguageCode($language);
        $md5 = md5($word);
        $row = AppQyV1LangDictionaryModel::findByMd5($language, $md5);
        $pick = $row !== null
            ? $this->resolveAudioPick($row, $accent)
            : ['url' => null, 'accent' => null, 'fallback' => false];
        $queue = null;

        if ($pick['url'] === null && $enqueueMissing) {
            $queue = $this->ttsQueue->addTask(
                $word,
                $language,
                AppQyV1UnifiedTTSQueueService::TYPE_WORD,
                $moveToHead ? 'beginning' : 'end'
            );
            $row = AppQyV1LangDictionaryModel::findByMd5($language, $md5);
            $pick = $row !== null
                ? $this->resolveAudioPick($row, $accent)
                : $pick;
        }

        return [
            'success' => $queue === null || (bool) ($queue['success'] ?? false),
            'word' => $word,
            'md5' => $md5,
            'language' => $language,
            'audio_url' => $pick['url'],
            'audio_status' => $pick['url'] !== null ? 'ready' : 'pending',
            'audio_accent' => $pick['accent'],
            'accent_fallback' => $pick['fallback'],
            'audio_files' => $row !== null ? $this->audioVariantsForApi($row, $language) : [],
            'queue_task_id' => $queue['queue_task_id'] ?? null,
            'queue_position' => isset($queue['queue_position']) ? (int) $queue['queue_position'] : null,
            'queue_status' => $queue['status'] ?? null,
            'error' => $queue['error'] ?? null,
        ];
    }

    /** @return array<int,array<string,mixed>> */
    public function requestBatch(array $words, string $language): array
    {
        $language = AppQyV1DictionaryService::getLanguageCode($language);
        $normalized = [];
        foreach ($words as $word) {
            $word = trim((string) $word);
            if ($word !== '') {
                $normalized[$word] = $word;
            }
        }

        $results = [];
        foreach (array_reverse(array_values($normalized)) as $word) {
            $results[] = $this->request($word, $language, null, true, true);
        }

        return array_reverse($results);
    }

    public function resolveAudioUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        return $this->resolveAudioPick($row, null)['url'];
    }

    /** @return array{url:?string,accent:?string,fallback:bool} */
    public function resolveAudioPick(AppQyV1LangDictionaryModel $row, ?string $accent = null): array
    {
        $preferred = null;
        if (is_string($accent)) {
            $normalizedAccent = strtolower(trim($accent));
            if (in_array($normalizedAccent, ['us', 'uk'], true)) {
                $preferred = $normalizedAccent;
            }
        }

        $variants = AppQyV1WordAudioFiles::list($row);
        if ($preferred !== null) {
            foreach ($variants as $variant) {
                if (($variant['accent'] ?? null) === $preferred
                    && !empty($variant['has_file'])
                    && !empty($variant['path'])
                ) {
                    return [
                        'url' => AppQyV1TtsUrl::forPath((string) $variant['path']),
                        'accent' => $preferred,
                        'fallback' => false,
                    ];
                }
            }
        }

        foreach ($variants as $variant) {
            if (!empty($variant['has_file']) && !empty($variant['path'])) {
                $accentTag = $variant['accent'] ?? null;
                return [
                    'url' => AppQyV1TtsUrl::forPath((string) $variant['path']),
                    'accent' => is_string($accentTag) ? $accentTag : 'unknown',
                    'fallback' => $preferred !== null && $accentTag !== $preferred,
                ];
            }
        }

        $ttsFiles = $row->tts_files;
        if (!is_array($ttsFiles) || $ttsFiles === []) {
            return ['url' => null, 'accent' => null, 'fallback' => false];
        }

        $base = rtrim(PathMapper::getAppQyV1AudioBaseDir(), '/\\') . '/';
        foreach ($ttsFiles as $ttsFile) {
            if (!isset($ttsFile['path']) || !is_string($ttsFile['path'])) {
                continue;
            }
            if (is_file($base . $ttsFile['path'])) {
                return [
                    'url' => AppQyV1TtsUrl::forPath($ttsFile['path']),
                    'accent' => 'unknown',
                    'fallback' => $preferred !== null,
                ];
            }
        }

        return ['url' => null, 'accent' => null, 'fallback' => false];
    }

    /** @return array<int,array<string,mixed>> */
    public function audioVariantsForApi(AppQyV1LangDictionaryModel $row, string $language): array
    {
        $variants = [];
        foreach (AppQyV1WordAudioFiles::list($row) as $variant) {
            if (empty($variant['has_file']) || empty($variant['path'])) {
                continue;
            }
            $accent = $variant['accent'] ?? null;
            $variants[] = [
                'url' => AppQyV1TtsUrl::forPath((string) $variant['path']),
                'voice' => self::voiceLabel($variant),
                'lang' => $language,
                'variant_key' => $variant['variant_key'] ?? '',
                'accent' => in_array($accent, ['us', 'uk'], true) ? $accent : 'unknown',
                'gender' => $variant['gender'] ?? null,
                'source' => $variant['source'] ?? null,
                'voice_type' => $variant['voice_type'] ?? null,
                'provider' => $variant['provider'] ?? null,
                'status' => 'ready',
            ];
            if (count($variants) >= self::MAX_AUDIO_VARIANTS) {
                break;
            }
        }

        return $variants;
    }

    private static function voiceLabel(array $variant): string
    {
        $labels = [];
        $accent = $variant['accent'] ?? null;
        $gender = $variant['gender'] ?? null;
        if ($accent === 'us') {
            $labels[] = 'US';
        } elseif ($accent === 'uk') {
            $labels[] = 'UK';
        }
        if ($gender === 'f' || $gender === 'female') {
            $labels[] = 'Female';
        } elseif ($gender === 'm' || $gender === 'male') {
            $labels[] = 'Male';
        }
        if ($labels !== []) {
            return implode(' ', $labels);
        }

        $variantKey = (string) ($variant['variant_key'] ?? '');
        $provider = (string) ($variant['provider'] ?? '');
        if ($variantKey !== '') {
            return $variantKey;
        }
        if ($provider !== '') {
            return $provider;
        }
        return 'default';
    }
}
