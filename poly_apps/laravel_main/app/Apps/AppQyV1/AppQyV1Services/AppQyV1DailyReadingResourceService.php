<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel;
use App\Models\User;

class AppQyV1DailyReadingResourceService
{
    private const DEFAULT_SETTINGS = [
        'playbackMode' => 'sequential',
        'wordMode' => 'new',
        'wordOrder' => 'sentence',
        'newOnlyMaxReadCount' => 0,
        'underlineCurrentSentence' => true,
        'bilingual' => true,
        'sentenceRate' => 1.0,
        'wordRate' => 1.0,
        'playbackPattern' => [
            ['id' => 'default-words', 'type' => 'words', 'times' => 1],
            ['id' => 'default-sentence-en', 'type' => 'sentence', 'lang' => 'en', 'times' => 1],
        ],
    ];

    public function __construct(
        private readonly AppQyV1ArticleManagementService $articleManagementService,
        private readonly AppQyV1SentenceWordTableService $sentenceWordTableService,
        private readonly AppQyV1DailyReadingVirtualProgressService $virtualProgressService,
    ) {
    }

    public function preview(
        User $user,
        string $articleId,
        array $requestedSettings = [],
        ?string $requestedGroupId = null,
        ?string $batchName = null,
        bool $consumeVirtualReads = false,
        ?string $requestKey = null
    ): ?array {
        $article = null;
        $articlePayload = [];
        $preferences = [];
        $appSettings = [];
        $storedSettings = [];
        $settings = [];
        $groupId = null;
        $targetGroup = null;
        $language = '';
        $targetLanguage = '';
        $wordRows = [];
        $selectedWords = [];
        $sentences = [];
        $audio = [];
        $playbackItems = [];
        $selection = [];
        $virtualReadBatch = [];

        $article = AppQyV1ArticleModel::findByArticleId($articleId);
        if ($article === null) {
            return null;
        }
        $article = AppQyV1ArticleModel::resolveCanonicalArticle($article);
        if (!$article->isManagedDaily()) {
            return null;
        }

        $articlePayload = $this->articleManagementService->mapArticle($article);
        $preferences = is_array($user->preferences) ? $user->preferences : [];
        $appSettings = is_array($preferences['app_settings'] ?? null)
            ? $preferences['app_settings']
            : [];
        $storedSettings = is_array($appSettings['dailyReadingPlayer'] ?? null)
            ? $appSettings['dailyReadingPlayer']
            : [];
        $settings = $this->normalizeSettings(array_replace($storedSettings, $requestedSettings));
        $groupId = $this->resolveRequestedGroupId($requestedGroupId, $appSettings);
        $language = AppQyV1LanguageConfigService::normalizeToCode((string) $article->language) ?: 'en';
        $targetLanguage = AppQyV1LanguageConfigService::normalizeToCode((string) $user->native_language) ?: 'zh';
        $targetGroup = $this->sentenceWordTableService->resolveTargetGroup(
            (int) $user->id,
            $language,
            $groupId
        );
        $groupId = $targetGroup !== null ? (string) $targetGroup->gid : null;
        $wordRows = $this->sentenceWordTableService->resolve(
            (string) $article->content,
            $language,
            $targetLanguage,
            'daily-reading-resource-preview',
            (int) $user->id,
            (int) $settings['newOnlyMaxReadCount'],
            $groupId
        );
        $wordRows = $this->uniqueWords($wordRows);
        $selection = $this->virtualProgressService->select(
            (int) $user->id,
            $this->virtualProgressService->normalizeBatchName($batchName),
            $language,
            $wordRows,
            (int) $settings['newOnlyMaxReadCount'],
            fn (array $projectedRows): array => $this->selectWords(
                $projectedRows,
                $settings,
                (int) $user->id,
                $articleId
            ),
            $consumeVirtualReads,
            $requestKey
        );
        $selectedWords = $selection['selected_words'];
        $virtualReadBatch = $selection['batch'];
        $sentences = $this->sentenceResources($articlePayload, $settings);
        $audio = $this->audioResources($articlePayload, $selectedWords, $settings);
        $playbackItems = $this->playbackItems($articlePayload, $selectedWords, $settings);

        return [
            'user' => [
                'id' => (int) $user->id,
                'username' => (string) $user->username,
            ],
            'article' => [
                'id' => (string) $articlePayload['article_id'],
                'title_en' => $articlePayload['title_en'],
                'title_cn' => $articlePayload['title_cn'],
                'language' => $language,
                'word_count' => (int) $articlePayload['word_count'],
            ],
            'target_word_group' => $targetGroup === null ? null : [
                'id' => (string) $targetGroup->gid,
                'name' => (string) $targetGroup->gname,
                'language' => (string) $targetGroup->language,
                'is_language_default' => (bool) $targetGroup->is_language_default,
            ],
            'virtual_read_batch' => $virtualReadBatch,
            'settings' => $settings,
            'resources' => [
                'new_words' => array_values(array_filter(
                    $selectedWords,
                    static fn (array $word): bool => (int) ($word['play_count'] ?? 0) <= (int) $settings['newOnlyMaxReadCount']
                )),
                'selected_words' => $selectedWords,
                'sentence_table' => $sentences,
                'audio' => $audio,
                'playback_items' => $playbackItems,
            ],
        ];
    }

    private function normalizeSettings(array $settings): array
    {
        $normalized = self::DEFAULT_SETTINGS;
        $playbackMode = (string) ($settings['playbackMode'] ?? '');
        $wordMode = (string) ($settings['wordMode'] ?? '');
        $wordOrder = (string) ($settings['wordOrder'] ?? '');
        $pattern = $this->normalizePattern($settings['playbackPattern'] ?? null);

        if (in_array($playbackMode, ['sequential', 'repeat-all', 'repeat-one', 'shuffle'], true)) {
            $normalized['playbackMode'] = $playbackMode;
        }
        if (in_array($wordMode, ['off', 'new', 'all'], true)) {
            $normalized['wordMode'] = $wordMode;
        }
        if (in_array($wordOrder, ['sentence', 'shuffle', 'alpha'], true)) {
            $normalized['wordOrder'] = $wordOrder;
        }
        $normalized['newOnlyMaxReadCount'] = max(0, min(100, (int) ($settings['newOnlyMaxReadCount'] ?? 0)));
        $normalized['underlineCurrentSentence'] = ($settings['underlineCurrentSentence'] ?? true) !== false;
        $normalized['bilingual'] = ($settings['bilingual'] ?? true) !== false;
        $normalized['sentenceRate'] = $this->normalizeRate($settings['sentenceRate'] ?? 1);
        $normalized['wordRate'] = $this->normalizeRate($settings['wordRate'] ?? 1);
        if ($pattern !== []) {
            $normalized['playbackPattern'] = $pattern;
        }

        return $normalized;
    }

    private function normalizePattern(mixed $value): array
    {
        $pattern = [];
        $usedIds = [];
        $type = '';
        $id = '';
        $lang = '';
        $times = 1;

        if (!is_array($value)) {
            return [];
        }
        foreach (array_slice(array_values($value), 0, 12) as $index => $step) {
            if (!is_array($step)) {
                continue;
            }
            $type = (string) ($step['type'] ?? '');
            if ($type !== 'words' && $type !== 'sentence') {
                continue;
            }
            $id = preg_replace('/[^A-Za-z0-9_-]+/', '-', trim((string) ($step['id'] ?? ''))) ?: '';
            $id = substr($id !== '' ? $id : 'step-' . $index . '-' . $type, 0, 96);
            if (isset($usedIds[$id])) {
                $id = substr($id, 0, 88) . '-' . $index;
            }
            $usedIds[$id] = true;
            $times = max(1, min(10, (int) ($step['times'] ?? 1)));
            if ($type === 'words') {
                $pattern[] = ['id' => $id, 'type' => 'words', 'times' => $times];
                continue;
            }
            $lang = ($step['lang'] ?? 'en') === 'cn' ? 'cn' : 'en';
            $pattern[] = ['id' => $id, 'type' => 'sentence', 'lang' => $lang, 'times' => $times];
        }

        return $pattern;
    }

    private function normalizeRate(mixed $value): float
    {
        $rate = (float) $value;

        return max(0.25, min(4.0, $rate > 0 ? $rate : 1.0));
    }

    private function resolveRequestedGroupId(?string $requestedGroupId, array $appSettings): ?string
    {
        $storedGroup = [];
        $groupId = trim((string) $requestedGroupId);

        if ($groupId !== '') {
            return $groupId;
        }
        $storedGroup = is_array($appSettings['dailyReadingWordGroup'] ?? null)
            ? $appSettings['dailyReadingWordGroup']
            : [];
        $groupId = trim((string) ($storedGroup['id'] ?? ''));

        return $groupId !== '' ? $groupId : null;
    }

    private function uniqueWords(array $rows): array
    {
        $unique = [];
        $seen = [];

        foreach ($rows as $row) {
            $key = mb_strtolower(trim((string) ($row['word'] ?? '')));
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $unique[] = $row;
        }

        return $unique;
    }

    private function selectWords(array $rows, array $settings, int $userId, string $articleId): array
    {
        $selected = [];
        $wordMode = (string) $settings['wordMode'];
        $wordOrder = (string) $settings['wordOrder'];
        $maxReadCount = (int) $settings['newOnlyMaxReadCount'];

        if ($wordMode === 'off') {
            return [];
        }
        $selected = $wordMode === 'new'
            ? array_values(array_filter($rows, static fn (array $row): bool =>
                ($row['eligible_for_new_only'] ?? false) === true
                && (int) ($row['play_count'] ?? 0) <= $maxReadCount
            ))
            : array_values($rows);
        if ($wordOrder === 'alpha') {
            usort($selected, static fn (array $first, array $second): int =>
                strcasecmp((string) $first['word'], (string) $second['word'])
            );
        } elseif ($wordOrder === 'shuffle') {
            usort($selected, static fn (array $first, array $second): int => strcmp(
                hash('sha256', $userId . ':' . $articleId . ':' . mb_strtolower((string) $first['word'])),
                hash('sha256', $userId . ':' . $articleId . ':' . mb_strtolower((string) $second['word']))
            ));
        }

        return $selected;
    }

    private function sentenceResources(array $article, array $settings): array
    {
        $rows = [];
        $pattern = $settings['playbackPattern'];
        $usesEnglish = false;
        $usesChinese = false;

        foreach ($pattern as $step) {
            if (($step['type'] ?? null) !== 'sentence') {
                continue;
            }
            $usesChinese = $usesChinese || ($step['lang'] ?? 'en') === 'cn';
            $usesEnglish = $usesEnglish || ($step['lang'] ?? 'en') === 'en';
        }
        if ($usesEnglish) {
            $rows[] = [
                'language' => 'en',
                'text' => (string) ($article['article_en'] ?? ''),
                'audio_url' => $article['audio_url'] ?? null,
                'audio_ready' => (bool) ($article['audio_ready'] ?? false),
            ];
        }
        if ($usesChinese && ($settings['bilingual'] ?? true) && trim((string) ($article['reference_cn'] ?? '')) !== '') {
            $rows[] = [
                'language' => 'zh',
                'text' => (string) $article['reference_cn'],
                'audio_url' => null,
                'audio_ready' => true,
                'audio_source' => 'speech_synthesis',
            ];
        }

        return $rows;
    }

    private function audioResources(array $article, array $words, array $settings): array
    {
        $wordAudio = [];
        $usesWords = false;

        foreach ($settings['playbackPattern'] as $step) {
            $usesWords = $usesWords || ($step['type'] ?? null) === 'words';
        }
        if ($usesWords) {
            foreach ($words as $word) {
                $wordAudio[] = [
                    'word' => (string) $word['word'],
                    'url' => $word['audio_url'] ?? null,
                    'status' => $word['audio_status'] ?? null,
                    'source' => empty($word['audio_url']) ? 'speech_synthesis' : 'file',
                ];
            }
        }

        return [
            'article' => [
                'url' => $article['audio_url'] ?? null,
                'ready' => (bool) ($article['audio_ready'] ?? false),
                'status' => $article['audio_status'] ?? null,
                'tts_engine' => $article['tts_engine'] ?? null,
                'tts_model' => $article['tts_model'] ?? null,
            ],
            'words' => $wordAudio,
        ];
    }

    private function playbackItems(array $article, array $words, array $settings): array
    {
        $items = [];

        foreach ($settings['playbackPattern'] as $stepIndex => $step) {
            $times = (int) $step['times'];
            if ($step['type'] === 'words') {
                foreach ($words as $wordIndex => $word) {
                    for ($repeatIndex = 0; $repeatIndex < $times; $repeatIndex++) {
                        $items[] = [
                            'step_id' => $step['id'],
                            'step_index' => $stepIndex,
                            'type' => 'word',
                            'word_index' => $wordIndex,
                            'repeat_index' => $repeatIndex,
                            'text' => (string) $word['word'],
                            'audio_url' => $word['audio_url'] ?? null,
                            'audio_source' => empty($word['audio_url']) ? 'speech_synthesis' : 'file',
                            'rate' => $settings['wordRate'],
                        ];
                    }
                }
                continue;
            }
            for ($repeatIndex = 0; $repeatIndex < $times; $repeatIndex++) {
                $isChinese = ($step['lang'] ?? 'en') === 'cn';
                $text = $isChinese ? (string) ($article['reference_cn'] ?? '') : (string) ($article['article_en'] ?? '');
                if ($text === '' || ($isChinese && !($settings['bilingual'] ?? true))) {
                    continue;
                }
                $items[] = [
                    'step_id' => $step['id'],
                    'step_index' => $stepIndex,
                    'type' => 'sentence',
                    'language' => $isChinese ? 'zh' : 'en',
                    'repeat_index' => $repeatIndex,
                    'text' => $text,
                    'audio_url' => $isChinese ? null : ($article['audio_url'] ?? null),
                    'audio_source' => $isChinese ? 'speech_synthesis' : 'file',
                    'rate' => $settings['sentenceRate'],
                ];
            }
        }

        return $items;
    }
}
