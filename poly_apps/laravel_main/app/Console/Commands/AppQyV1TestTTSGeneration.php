<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use Illuminate\Support\Facades\Log;

class AppQyV1TestTTSGeneration extends Command
{
    protected $signature = 'appqyv1:test-tts {text} {--lang=en} {--type=word}';
    
    protected $description = 'Test TTS generation for word or sentence, save to dictionary audio directory with MD5 naming';

    public function handle()
    {
        $text = $this->argument('text');
        $langCode = $this->option('lang');
        $textType = $this->option('type');
        
        if (!in_array($textType, ['word', 'sentence'])) {
            $this->error("Type must be 'word' or 'sentence'");
            return 1;
        }
        
        $this->info("=== TTS Generation Test ===");
        $this->info("Text: {$text}");
        $this->info("Language: {$langCode}");
        $this->info("Type: {$textType}");
        $this->newLine();
        
        // Step 1: Calculate MD5
        $md5 = md5($text);
        $this->info("Step 1: Calculate MD5");
        $this->line("  MD5: {$md5}");
        $this->newLine();
        
        // Step 2: Get dictionary audio directory
        $storageManager = new AppQyV1ExternalStorageManager();
        $audioDir = $storageManager->getWordSoundsPath();
        $this->info("Step 2: Get audio directory");
        $this->line("  Directory: {$audioDir}");
        
        if (!is_dir($audioDir)) {
            $this->warn("  Directory does not exist, creating...");
            if (!mkdir($audioDir, 0755, true)) {
                $this->error("  Failed to create directory!");
                return 1;
            }
            $this->info("  Directory created successfully");
        }
        $this->newLine();
        
        // Step 3: Check if file already exists
        $targetFile = $audioDir . '/' . $md5 . '.mp3';
        $this->info("Step 3: Check existing file");
        $this->line("  Target file: {$targetFile}");
        
        if (file_exists($targetFile)) {
            $existingSize = filesize($targetFile);
            $this->warn("  File already exists!");
            $this->line("  Size: " . $this->formatBytes($existingSize));
            
            if ($existingSize === 0) {
                $this->warn("  WARNING: Existing file is 0 bytes, will regenerate");
                @unlink($targetFile);
            } else {
                $this->info("  File is valid, skipping generation");
                $this->newLine();
                $this->displayFileInfo($targetFile, $md5);
                return 0;
            }
        }
        $this->newLine();
        
        // Step 4: Initialize TTS Service
        $this->info("Step 4: Initialize EdgeTTS Service");
        $ttsService = new EdgeTTSService();
        
        if (!$ttsService->isAvailable()) {
            $this->error("  Edge-TTS is not available!");
            $status = $ttsService->getStatus();
            if (isset($status['error'])) {
                $this->error("  Error: " . $status['error']);
            }
            return 1;
        }
        $this->info("  Edge-TTS is available");
        $this->newLine();
        
        // Step 5: Generate audio using TTS service
        $this->info("Step 5: Generate audio using Edge-TTS");
        $this->line("  Calling generateAudio()...");
        
        $startTime = microtime(true);
        $result = $ttsService->generateAudio($text, $langCode, $textType);
        $endTime = microtime(true);
        $duration = round(($endTime - $startTime) * 1000, 2);
        
        if (!$result['success']) {
            $this->error("  Generation failed!");
            $this->error("  Error: " . ($result['error'] ?? 'Unknown error'));
            return 1;
        }
        
        $this->info("  Generation completed in {$duration}ms");
        $this->line("  Audio path: " . ($result['audio_path'] ?? 'N/A'));
        $this->line("  Cached: " . ($result['cached'] ? 'Yes' : 'No'));
        $this->newLine();
        
        // Step 6: Copy to dictionary directory with MD5 naming
        $this->info("Step 6: Copy to dictionary directory with MD5 naming");
        
        $generatedPath = $ttsService->getAudioPath($result['audio_path']);
        if (!$generatedPath || !file_exists($generatedPath)) {
            $this->error("  Generated file not found at: " . ($result['audio_path'] ?? 'N/A'));
            return 1;
        }
        
        $generatedSize = filesize($generatedPath);
        $this->line("  Generated file size: " . $this->formatBytes($generatedSize));
        
        if ($generatedSize === 0) {
            $this->error("  ERROR: Generated file is 0 bytes!");
            $this->error("  This indicates a problem with edge-tts execution");
            @unlink($generatedPath);
            return 1;
        }
        
        if ($generatedSize < 100) {
            $this->warn("  WARNING: File size is suspiciously small ({$generatedSize} bytes)");
        }
        
        // Copy to dictionary directory
        if (copy($generatedPath, $targetFile)) {
            $this->info("  File copied successfully");
            $this->line("  Target: {$targetFile}");
        } else {
            $this->error("  Failed to copy file!");
            return 1;
        }
        $this->newLine();
        
        // Step 7: Verify copied file
        $this->info("Step 7: Verify copied file");
        if (file_exists($targetFile)) {
            $copiedSize = filesize($targetFile);
            $this->info("  File exists");
            $this->line("  Size: " . $this->formatBytes($copiedSize));
            
            if ($copiedSize === 0) {
                $this->error("  ERROR: Copied file is 0 bytes!");
                @unlink($targetFile);
                return 1;
            }
            
            if ($copiedSize !== $generatedSize) {
                $this->warn("  WARNING: Size mismatch! Generated: {$generatedSize}, Copied: {$copiedSize}");
            } else {
                $this->info("  Size matches original");
            }
        } else {
            $this->error("  File not found after copy!");
            return 1;
        }
        $this->newLine();
        
        // Step 8: Update dictionary entry
        $this->info("Step 8: Update dictionary entry");
        try {
            $dictEntry = AppQyV1LangDictionaryModel::createOrFind($langCode, $text);
            $relativePath = $md5 . '.mp3';
            $dictEntry->addTTSFile($relativePath, 'p0pct', $textType);
            $dictEntry->has_audio = true;
            $dictEntry->save();
            $this->info("  Dictionary entry updated");
            $this->line("  Entry ID: {$dictEntry->id}");
        } catch (\Exception $e) {
            $this->warn("  Failed to update dictionary: " . $e->getMessage());
        }
        $this->newLine();
        
        // Final summary
        $this->displayFileInfo($targetFile, $md5);
        
        return 0;
    }
    
    private function displayFileInfo(string $filePath, string $md5): void
    {
        $this->info("=== Final Result ===");
        $this->line("MD5: {$md5}");
        $this->line("File: {$filePath}");
        
        if (file_exists($filePath)) {
            $size = filesize($filePath);
            $this->line("Size: " . $this->formatBytes($size));
            $this->line("Permissions: " . substr(sprintf('%o', fileperms($filePath)), -4));
            $this->line("Modified: " . date('Y-m-d H:i:s', filemtime($filePath)));
        } else {
            $this->error("File not found!");
        }
    }
    
    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1024 * 1024) {
            return round($bytes / (1024 * 1024), 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return round($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }
}

