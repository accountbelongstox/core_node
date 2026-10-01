<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use Illuminate\Support\Facades\Log;
use App\Services\PycoreTasks\OcrRecognizeTask;
use App\Services\AiGateway\GoogleTranslateClient;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Utils\FileSystemManager;
use App\Services\AIServiceDispatcher;
use App\Services\TTSCacheManager;
use App\Services\TranslationService;

class VoiceSubtitleProcessor
{
    private $aiDispatcher;
    private $ttsCache;
    private $progressReporter;

    public function __construct()
    {
        $this->aiDispatcher = new AIServiceDispatcher();
        $this->ttsCache = new TTSCacheManager();
        $this->progressReporter = null;
    }

    public function setProgressReporter(?callable $reporter): void
    {
        $this->progressReporter = $reporter;
    }

    private function reportProgress(string $step, string $status, ?string $message = null, array $meta = []): void
    {
        if (!$this->progressReporter) {
            return;
        }

        try {
            call_user_func($this->progressReporter, $step, $status, $message, $meta);
        } catch (\Throwable $e) {
            Log::debug('[VoiceSubtitleProcessor] Progress reporter error', [
                'step' => $step,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function processInput(
        string $type,
        string $content,
        string $language,
        string $voice,
        $targetLanguage = null
    ): ?array {
        try {
            if (is_array($targetLanguage)) {
                $targetLanguage = !empty($targetLanguage) ? $targetLanguage[0] : 'en';
            } elseif (is_string($targetLanguage)) {
                $targetLanguage = $targetLanguage ?: 'en';
            } else {
                $targetLanguage = 'en';
            }

            switch ($type) {
                case 'text':
                    return $this->processText($content, $language, $voice, $targetLanguage);

                case 'image':
                    return $this->processImage($content, $language, $voice, $targetLanguage);

                case 'url':
                    return $this->processUrl($content, $language, $voice, $targetLanguage);

                case 'voice':
                    return $this->processVoice($content, $language, $voice);

                case 'file':
                    return $this->processFile($content, $language, $voice, $targetLanguage);

                default:
                    throw new \InvalidArgumentException('Unknown type: ' . $type);
            }

        } catch (\Exception $e) {
            Log::error('[VoiceSubtitleProcessor] Error processing input', [
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function processText(
        string $text,
        string $language,
        string $voice,
        string $targetLanguage,
        bool $skipRewrite = false,
        bool $skipTranslation = false
    ): array
    {
        $cleanedText = $this->cleanText($text);

        $rewrittenText = $cleanedText;

        if ($skipRewrite) {
            $this->reportProgress('ai_rewrite', 'completed', 'Rewrite skipped (already in target language)');
        } else {
            $this->reportProgress('ai_rewrite', 'running', 'Rewriting input for target language');
            $rewrittenText = $this->rewriteToTargetLanguage($cleanedText, $targetLanguage);
            $this->reportProgress('ai_rewrite', 'completed');
        }

        if ($skipTranslation) {
            $this->reportProgress('translation', 'completed', 'Translation skipped (already localized text)');
            $translatedText = $rewrittenText;
        } else {
            $this->reportProgress('translation', 'running', 'Translating rewritten text');
            $translatedText = $this->translateText($rewrittenText, $targetLanguage);
            $this->reportProgress('translation', 'completed');
        }

        $speechReadyText = $this->removeAsterisks($translatedText);
        $paragraphs = $this->ttsCache->splitTextToParagraphs($speechReadyText);

        $this->reportProgress('tts_generation', 'running', 'Generating speech segments', [
            'paragraphs' => count($paragraphs),
        ]);
        $ttsFiles = $this->generateTTS($paragraphs, $language, $voice);
        $this->reportProgress('tts_generation', 'completed', 'TTS generation finished', [
            'files' => count($ttsFiles),
        ]);

        return [
            'type' => 'text',
            'original_text' => $text,
            'translated_text' => $speechReadyText,
            'language' => $language,
            'voice' => $voice,
            'target_language' => $targetLanguage,
            'paragraphs' => $paragraphs,
            'tts_files' => $ttsFiles,
            'created_at' => date('Y-m-d H:i:s'),
        ];
    }

    private function processImage(string $imagePath, string $language, string $voice, string $targetLanguage): ?array
    {
        $prompt = $this->buildGeminiImagePrompt($targetLanguage);
        $this->reportProgress('image_recognition', 'running', 'Analyzing visual content');
        $imageAnalysis = $this->aiDispatcher->analyzeImage($imagePath, $prompt);

        if ($imageAnalysis['success']) {
            $extractedText = trim($imageAnalysis['content'] ?? '');
            $this->reportProgress('image_recognition', 'completed', 'Gemini vision analysis finished');
            if (empty($extractedText)) {
                Log::warning('[VoiceSubtitleProcessor] Gemini returned empty text, falling back to OCR');
            } else {
                return $this->processText(
                    $extractedText,
                    $language,
                    $voice,
                    $targetLanguage,
                    true,
                    true
                );
            }
        }

        Log::warning('[VoiceSubtitleProcessor] Gemini vision failed, trying OCR', [
            'error' => $imageAnalysis['error'] ?? 'Unknown error',
        ]);

        $ocrResult = OcrRecognizeTask::recognizeImage($imagePath);

        if (($ocrResult['success'] ?? false) !== true || trim((string) ($ocrResult['text'] ?? '')) === '') {
            Log::error('[VoiceSubtitleProcessor] OCR also failed', [
                'image_path' => $imagePath,
                'error' => $ocrResult['error'] ?? null,
            ]);
            $this->reportProgress('image_recognition', 'failed', (string) ($ocrResult['error'] ?? 'OCR failed to extract text'));
            throw new \RuntimeException((string) ($ocrResult['error'] ?? 'OCR failed to extract text'));
        }

        $ocrText = $ocrResult['text'];
        $this->reportProgress('image_recognition', 'completed', 'OCR extraction finished');
        return $this->processText(
            $ocrText,
            $language,
            $voice,
            $targetLanguage,
            false,
            true
        );
    }

    private function processUrl(string $url, string $language, string $voice, string $targetLanguage): ?array
    {
        $textContent = $this->extractTextFromUrl($url);

        if (!$textContent) {
            Log::error('[VoiceSubtitleProcessor] Failed to extract text from URL', [
                'url' => $url,
            ]);
            return null;
        }

        return $this->processText($textContent, $language, $voice, $targetLanguage);
    }

    private function processVoice(string $voiceFilePath, string $language, string $voice): ?array
    {
        return [
            'type' => 'voice',
            'voice_file' => $voiceFilePath,
            'language' => $language,
            'created_at' => date('Y-m-d H:i:s'),
        ];
    }

    private function processFile(string $filePath, string $language, string $voice, string $targetLanguage): ?array
    {
        $textContent = $this->convertFileToText($filePath);

        if (!$textContent) {
            Log::error('[VoiceSubtitleProcessor] Failed to convert file to text', [
                'file_path' => $filePath,
            ]);
            return null;
        }

        return $this->processText($textContent, $language, $voice, $targetLanguage);
    }

    private function cleanText(string $text): string
    {
        $cleaned = str_replace(['*', '＊'], '', $text);

        $cleaned = preg_replace('/\s+/', ' ', $cleaned);

        return trim($cleaned);
    }

    private function rewriteToTargetLanguage(string $text, string $targetLanguage): string
    {
        $languageName = $this->resolveLanguageName($targetLanguage);
        $prompt = "Rewrite in {$languageName}:\n{$text}";

        $result = $this->aiDispatcher->chat($prompt, 'auto', null, "You are a professional translator and writer. Rewrite the given text in the target language naturally and accurately.");

        if ($result['success']) {
            return $this->cleanText($result['content']);
        }

        Log::warning('[VoiceSubtitleProcessor] AI rewrite failed, using original text', [
            'error' => $result['error'] ?? 'Unknown error',
        ]);

        return $text;
    }

    private function translateText(string $text, string $targetLanguage): string
    {
        try {
            $result = GoogleTranslateClient::translate($text, 'auto', $targetLanguage);

            if ($result && isset($result['translated_text'])) {
                return $result['translated_text'];
            }

            return $text;

        } catch (\Exception $e) {
            Log::warning('[VoiceSubtitleProcessor] Translation failed, using original text', [
                'error' => $e->getMessage(),
            ]);
            return $text;
        }
    }

    private function generateTTS(array $paragraphs, string $language, string $voice): array
    {
        $ttsFiles = [];

        foreach ($paragraphs as $index => $paragraph) {
            if (empty($paragraph)) {
                continue;
            }

            $cached = $this->ttsCache->getCached($paragraph, $language, $voice);

            if ($cached) {
                $ttsFiles[] = $cached;
                continue;
            }

            $audioData = $this->callEdgeTTS($paragraph, $language, $voice);

            if ($audioData) {
                $saved = $this->ttsCache->saveCache($paragraph, $language, $voice, $audioData);

                if ($saved) {
                    $ttsFiles[] = array_merge($saved, [
                        'text' => $paragraph,
                        'language' => $language,
                        'voice' => $voice,
                    ]);
                }
            }
        }

        return $ttsFiles;
    }

    /** Cached clip bytes, or null while pycore's tts_synthesize task is pending or failed. */
    private function callEdgeTTS(string $text, string $language, string $voice): ?string
    {
        $tts = app(EdgeTTSService::class);
        $result = $tts->generateAudio($text, $language, 'sentence', ['voice' => $voice]);
        $path = ($result['success'] ?? false) ? $tts->getAudioPath((string) $result['audio_path']) : null;
        $audio = $path !== null ? FileSystemManager::readFile($path, false) : false;

        if (!is_string($audio) || $audio === '') {
            Log::warning('[VoiceSubtitleProcessor] Edge TTS clip not ready', [
                'error' => $result['error'] ?? null,
                'task_id' => $result['task_id'] ?? null,
            ]);

            return null;
        }

        return $audio;
    }

    private function extractTextFromUrl(string $url): ?string
    {
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(30)->get($url);

            if (!$response->successful()) {
                return null;
            }

            $html = $response->body();

            $html = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $html);
            $html = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', $html);

            $text = strip_tags($html);

            $text = preg_replace('/\s+/', ' ', $text);
            $text = trim($text);

            return $text;

        } catch (\Exception $e) {
            Log::error('[VoiceSubtitleProcessor] Error extracting text from URL', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function convertFileToText(string $filePath): ?string
    {
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        switch ($extension) {
            case 'txt':
                return file_get_contents($filePath);

            case 'pdf':
                return $this->extractTextFromPdf($filePath);

            case 'doc':
            case 'docx':
                return $this->extractTextFromWord($filePath);

            default:
                Log::warning('[VoiceSubtitleProcessor] Unsupported file type', [
                    'extension' => $extension,
                ]);
                return null;
        }
    }

    private function extractTextFromPdf(string $filePath): ?string
    {
        return null;
    }

    private function extractTextFromWord(string $filePath): ?string
    {
        return null;
    }

    private function buildGeminiImagePrompt(string $targetLanguage): string
    {
        $languageName = $this->resolveLanguageName($targetLanguage);
        return "Summarize in {$languageName}.";
    }

    public function getStats(): array
    {
        return array_merge(
            ['processor_version' => '1.0.0'],
            $this->ttsCache->getCacheStats()
        );
    }

    private function removeAsterisks(string $text): string
    {
        return str_replace(['*', '＊'], '', $text);
    }

    private function resolveLanguageName(string $language): string
    {
        $code = strtolower(trim($language));
        return TranslationService::LANGUAGES[$code] ?? $language;
    }
}
