<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use App\Utils\ImageProcessUtil;
use Illuminate\Support\Facades\Cache;

class AppQyV1SystemStatisticsService
{
    private const DICTIONARY_STATS_TTL_SECONDS = 300;
    private const AUDIO_STATS_CACHE_KEY = 'appqyv1_audio_file_size_stats';
    private const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];

    public function dictionaryStats(string $languageCode): array
    {
        return AppQyV1LangDictionaryModel::cachedSystemInitStats(
            $languageCode,
            self::DICTIONARY_STATS_TTL_SECONDS
        );
    }

    public function audioFileSizeStatistics(bool $forceRefresh = false): array
    {
        $cached = null;
        $wordSoundsDirectory = '';
        $sentenceSoundsDirectory = '';
        $audioDirectories = [];
        $stats = [];
        $languageStats = [];
        $result = [];

        if (!$forceRefresh) {
            $cached = Cache::get(self::AUDIO_STATS_CACHE_KEY);
            if ($cached !== null) {
                return $cached;
            }
        }

        $wordSoundsDirectory = PathMapper::getAppQyV1AudioDir();
        $sentenceSoundsDirectory = PathMapper::getAppQyV1SentenceSoundsDir();
        $audioDirectories = [$wordSoundsDirectory, $sentenceSoundsDirectory];
        $stats = FileSystemManager::scanDirectoriesForFiles($audioDirectories, self::AUDIO_EXTENSIONS);

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $languageCode) {
            $languageDirectories = [];
            $languageWordDirectory = $wordSoundsDirectory . '/' . $languageCode;
            $languageSentenceDirectory = $sentenceSoundsDirectory . '/' . $languageCode;

            if (is_dir($languageWordDirectory)) {
                $languageDirectories[] = $languageWordDirectory;
            }
            if (is_dir($languageSentenceDirectory)) {
                $languageDirectories[] = $languageSentenceDirectory;
            }

            $languageStats[$languageCode] = $this->languageAudioStatistics($languageDirectories);
        }

        $result = [
            'total_size_bytes' => $stats['total_size'],
            'total_size_mb' => round($stats['total_size'] / (1024 * 1024), 2),
            'total_size_gb' => round($stats['total_size'] / (1024 * 1024 * 1024), 2),
            'total_files' => $stats['total_files'],
            'zero_byte_files' => $stats['zero_byte_files'],
            'formatted_size' => ImageProcessUtil::formatBytes($stats['total_size']),
            'scanned_directories' => $stats['scanned_directories'],
            'errors' => $stats['errors'],
            'by_language' => $languageStats,
        ];

        if ($stats['zero_byte_files'] > 0) {
            $result['warning'] = __('runtime.audio_zero_byte_warning', [
                'count' => $stats['zero_byte_files'],
            ]);
        }

        Cache::put(self::AUDIO_STATS_CACHE_KEY, $result, now()->addMinutes(30));

        return $result;
    }

    public function untranslatedStatistics(): array
    {
        $totalWords = 0;
        $totalSentences = 0;
        $completeWords = 0;
        $completeSentences = 0;
        $missingTranslation = 0;
        $missingPhonetic = 0;
        $missingAudio = 0;
        $missingImages = 0;
        $missingSentenceTranslation = 0;
        $missingSentenceAudio = 0;

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $languageCode) {
            $dictionaryStats = $this->dictionaryStats($languageCode);

            if (!$dictionaryStats['table_exists']) {
                continue;
            }

            $totalWords += $dictionaryStats['words'];
            $totalSentences += $dictionaryStats['sentences'];
            $completeWords += $dictionaryStats['complete_words'];
            $missingTranslation += $dictionaryStats['missing_translation'];
            $missingPhonetic += $dictionaryStats['missing_phonetic'];
            $missingAudio += $dictionaryStats['missing_audio'];
            $missingImages += $dictionaryStats['missing_images'];
            $completeSentences += $dictionaryStats['complete_sentences'];
            $missingSentenceTranslation += $dictionaryStats['missing_sentence_translation'];
            $missingSentenceAudio += $dictionaryStats['missing_sentence_audio'];
        }

        return [
            'total_words' => $totalWords,
            'complete_words' => $completeWords,
            'completion_rate' => $this->percentage($completeWords, $totalWords),
            'total_sentences' => $totalSentences,
            'complete_sentences' => $completeSentences,
            'sentence_completion_rate' => $this->percentage($completeSentences, $totalSentences),
            'missing_breakdown' => [
                'translation' => $missingTranslation,
                'phonetic' => $missingPhonetic,
                'audio' => $missingAudio,
                'images' => $missingImages,
                'sentence_translation' => $missingSentenceTranslation,
                'sentence_audio' => $missingSentenceAudio,
            ],
            'missing_percentages' => [
                'translation' => $this->percentage($missingTranslation, $totalWords),
                'phonetic' => $this->percentage($missingPhonetic, $totalWords),
                'audio' => $this->percentage($missingAudio, $totalWords),
                'images' => $this->percentage($missingImages, $totalWords),
                'sentence_translation' => $this->percentage($missingSentenceTranslation, $totalSentences),
                'sentence_audio' => $this->percentage($missingSentenceAudio, $totalSentences),
            ],
        ];
    }

    private function languageAudioStatistics(array $directories): array
    {
        $statistics = [
            'total_size' => 0,
            'total_files' => 0,
            'zero_byte_files' => 0,
        ];

        if ($directories !== []) {
            $statistics = FileSystemManager::scanDirectoriesForFiles($directories, self::AUDIO_EXTENSIONS);
        }

        return [
            'size_bytes' => $statistics['total_size'],
            'size_mb' => round($statistics['total_size'] / (1024 * 1024), 2),
            'size_gb' => round($statistics['total_size'] / (1024 * 1024 * 1024), 2),
            'files' => $statistics['total_files'],
            'zero_byte_files' => $statistics['zero_byte_files'],
            'formatted_size' => ImageProcessUtil::formatBytes($statistics['total_size']),
        ];
    }

    private function percentage(int $part, int $total): float|int
    {
        return $total > 0 ? round(($part / $total) * 100, 2) : 0;
    }
}
