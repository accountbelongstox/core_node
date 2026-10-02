<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use App\Services\PycoreTasks\PycoreTaskQueue;
use Illuminate\Support\Facades\Log;
use App\Services\PycoreTasks\OcrRecognizeTask;
use App\Services\AiGateway\GoogleTranslateClient;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Utils\FileSystemManager;
use App\Services\AiGateway\AiGateway;
use App\Services\TTSCacheManager;
use App\Services\TranslationService;

class VoiceSubtitleProcessor
{
    private $ttsCache;
    private $progressReporter;
    /** Resumable state: extracted source text, speech text and paragraphs, pycore waits by key. */
    private array $checkpoint = [];

    public function __construct()
    {
        $this->ttsCache = new TTSCacheManager();
        $this->progressReporter = null;
    }

    public function resume(array $checkpoint): void
    {
        $this->checkpoint = $checkpoint;
    }

    public function checkpoint(): array
    {
        return $this->checkpoint;
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

        } catch (VoiceSubtitleV1PipelineSuspended $e) {
            throw $e;
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
        $speech = $this->checkpoint['speech'] ?? null;
        $cleanedText = '';
        $rewrittenText = '';
        $translatedText = '';
        $speechReadyText = '';
        $paragraphs = [];

        if (is_array($speech)) {
            return $this->speechItem($text, (string) $speech['text'], (array) $speech['paragraphs'], $language, $voice, $targetLanguage);
        }
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
        $this->checkpoint['speech'] = ['text' => $speechReadyText, 'paragraphs' => $paragraphs];

        $this->reportProgress('tts_generation', 'running', 'Generating speech segments', [
            'paragraphs' => count($paragraphs),
        ]);

        return $this->speechItem($text, $speechReadyText, $paragraphs, $language, $voice, $targetLanguage);
    }

    private function speechItem(
        string $text,
        string $speechReadyText,
        array $paragraphs,
        string $language,
        string $voice,
        string $targetLanguage
    ): array {
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
        $source = $this->checkpoint['source'] ?? null;
        $prompt = '';
        $imageAnalysis = [];
        $extractedText = '';
        $ocrResult = [];

        if (is_array($source)) {
            return $this->processText((string) $source['text'], $language, $voice, $targetLanguage, (bool) $source['skip_rewrite'], (bool) $source['skip_translation']);
        }
        if (empty($this->checkpoint['ocr'])) {
            $prompt = $this->buildGeminiImagePrompt($targetLanguage);
            $this->reportProgress('image_recognition', 'running', 'Analyzing visual content');
            $imageAnalysis = AiGateway::describeImage($imagePath, $prompt, 'gemini', 'voice_subtitle', AiGateway::DIRECT_CLIENT_TIMEOUT_SECONDS);

            if ($imageAnalysis['success']) {
                $extractedText = trim((string) ($imageAnalysis['text'] ?? ''));
                $this->reportProgress('image_recognition', 'completed', 'Gemini vision analysis finished');
                if (empty($extractedText)) {
                    Log::warning('[VoiceSubtitleProcessor] Gemini returned empty text, falling back to OCR');
                } else {
                    $this->checkpoint['source'] = ['text' => $extractedText, 'skip_rewrite' => true, 'skip_translation' => true];
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
            $this->checkpoint['ocr'] = true;
        }

        // Background job: a queued pycore OCR task suspends the pipeline until it settles.
        $ocrResult = $this->pycoreView('ocr', static fn (): array => OcrRecognizeTask::recognizeImage($imagePath));
        if (PycoreTaskQueue::stillPending($ocrResult)) {
            $this->reportProgress('image_recognition', 'running', __('pycore.task_queued', ['task_id' => $ocrResult['pycore_task']['task_id']]), [
                'pycore_task' => $ocrResult['pycore_task'],
            ]);
            throw new VoiceSubtitleV1PipelineSuspended((string) $ocrResult['pycore_task']['task_id']);
        }
        $ocrResult = ($ocrResult['status'] ?? null) === PycoreTaskQueue::STATE_COMPLETED
            ? $ocrResult['result'] + ['task_id' => $ocrResult['task_id']]
            : $ocrResult;

        if (($ocrResult['success'] ?? false) !== true || trim((string) ($ocrResult['text'] ?? '')) === '') {
            Log::error('[VoiceSubtitleProcessor] OCR also failed', [
                'image_path' => $imagePath,
                'error' => $ocrResult['error'] ?? null,
            ]);
            $this->reportProgress('image_recognition', 'failed', (string) ($ocrResult['error'] ?? 'OCR failed to extract text'), PycoreTaskQueue::embed($ocrResult));
            throw new \RuntimeException((string) ($ocrResult['error'] ?? 'OCR failed to extract text'));
        }

        $ocrText = $ocrResult['text'];
        $this->checkpoint['source'] = ['text' => $ocrText, 'skip_rewrite' => false, 'skip_translation' => true];
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
        $textContent = $this->checkpoint['source']['text'] ?? $this->extractTextFromUrl($url);

        if (!$textContent) {
            Log::error('[VoiceSubtitleProcessor] Failed to extract text from URL', [
                'url' => $url,
            ]);
            return null;
        }
        $this->checkpoint['source'] = ['text' => $textContent];

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
        $textContent = $this->checkpoint['source']['text'] ?? $this->convertFileToText($filePath);

        if (!$textContent) {
            Log::error('[VoiceSubtitleProcessor] Failed to convert file to text', [
                'file_path' => $filePath,
            ]);
            return null;
        }
        $this->checkpoint['source'] = ['text' => $textContent];

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

        $result = AiGateway::generateText(null, [
            ['role' => 'system', 'content' => 'You are a professional translator and writer. Rewrite the given text in the target language naturally and accurately.'],
            ['role' => 'user', 'content' => $prompt],
        ], null, null, 'voice_subtitle', AiGateway::DIRECT_CLIENT_TIMEOUT_SECONDS);

        if (!empty($result['success'])) {
            return $this->cleanText((string) $result['text']);
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

    /**
     * Every paragraph's clip; misses are requested together, and while any of
     * them is a live pycore task the pipeline is suspended.
     */
    private function generateTTS(array $paragraphs, string $language, string $voice): array
    {
        $ttsFiles = [];
        $pending = [];
        $audioData = null;

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
            if (is_array($audioData)) {
                $pending[] = $audioData;
                continue;
            }

            if ($audioData !== '') {
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
        if ($pending !== []) {
            $this->reportProgress('tts_generation', 'running', __('pycore.task_queued', ['task_id' => implode(', ', array_column($pending, 'task_id'))]), [
                'pycore_task' => $pending[0],
                'pycore_tasks' => $pending,
            ]);
            throw new VoiceSubtitleV1PipelineSuspended((string) $pending[0]['task_id']);
        }

        return $ttsFiles;
    }

    /**
     * Clip bytes for one paragraph, or the pycore_task of a live
     * tts_synthesize task while it is pending. No suitable pycore, a failed or
     * a stalled task fails the step with that reason instead of skipping it.
     */
    private function callEdgeTTS(string $text, string $language, string $voice): string|array
    {
        $tts = app(EdgeTTSService::class);
        $result = $this->pycoreView(
            'tts:'.sha1($language.'|'.$voice.'|'.$text),
            static fn (): array => $tts->generateAudio($text, $language, 'sentence', ['voice' => $voice])
        );
        $path = null;
        $audio = false;

        if (PycoreTaskQueue::stillPending($result)) {
            return $result['pycore_task'];
        }
        $path = ($result['success'] ?? false) ? $tts->getAudioPath((string) $result['audio_path']) : null;
        $audio = $path !== null ? FileSystemManager::readFile($path, false) : false;
        if (!is_string($audio) || $audio === '') {
            $this->reportProgress('tts_generation', 'failed', (string) ($result['error'] ?? 'TTS failed'), PycoreTaskQueue::embed($result));
            throw new \RuntimeException((string) ($result['error'] ?? 'TTS failed'));
        }

        return $audio;
    }

    /**
     * The pycore view for one waited-on input. A stored wait is polled first
     * (a failed, stalled or unavailable task ends the wait with that view
     * instead of being queued again); once it completed, or with no wait,
     * $request gives the current domain result. A live task is stored as the
     * wait for the next tick.
     */
    private function pycoreView(string $key, callable $request): array
    {
        $waiting = $this->checkpoint['awaiting'][$key] ?? null;
        $view = [];

        unset($this->checkpoint['awaiting'][$key]);
        if (is_array($waiting)) {
            $view = PycoreTaskQueue::poll((array) $waiting['view'], is_array($waiting['watch'] ?? null) ? $waiting['watch'] : null);
            if (PycoreTaskQueue::stillPending($view)) {
                $this->checkpoint['awaiting'][$key] = ['view' => array_diff_key($view, ['watch' => true]), 'watch' => $view['watch'] ?? null];
                return $view;
            }
            if (($view['status'] ?? null) !== PycoreTaskQueue::STATE_COMPLETED) {
                return $view;
            }
        }
        $view = $request();
        if (PycoreTaskQueue::stillPending($view)) {
            $this->checkpoint['awaiting'][$key] = ['view' => $view, 'watch' => null];
        }

        return $view;
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
