<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\Utils\AppQyV1VocabularyProcessor;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class AppQyV1VocabularyProcessor
{
    private $markerManager;
    private $sourceMetadataPath;
    private $processedWords = [];
    private $stats = [
        'total_files' => 0,
        'processed_files' => 0,
        'total_words' => 0,
        'unique_words' => 0,
        'duplicates_skipped' => 0
    ];

    public function __construct()
    {
        $this->markerManager = new AppQyV1InitializationMarkerManager();
        $this->sourceMetadataPath = base_path() . '/public/VoiceStaticServer/metadata';
    }

    public function processVocabularyFiles(): array
    {
        Log::info('Starting vocabulary processing from metadata directory');
        
        if (!File::exists($this->sourceMetadataPath)) {
            throw new \Exception("Source metadata directory not found: {$this->sourceMetadataPath}");
        }

        $vocabularyPath = $this->sourceMetadataPath . '/vocabulary';
        
        if (!File::exists($vocabularyPath)) {
            throw new \Exception("Vocabulary directory not found: {$vocabularyPath}");
        }

        // Check if vocabulary processing already completed
        if ($this->markerManager->isVocabularyProcessingComplete()) {
            Log::info('Vocabulary processing already completed');
            return $this->getProcessingStats();
        }

        $this->markerManager->markVocabularyProcessingStart();

        try {
            $this->processVocabularyDirectory($vocabularyPath);
            $this->insertWordsToDatabase();
            $this->markerManager->markVocabularyProcessingComplete();
            
            Log::info('Vocabulary processing completed successfully', $this->stats);
            return $this->stats;
            
        } catch (\Exception $e) {
            $this->markerManager->markVocabularyProcessingFailed($e->getMessage());
            Log::error('Vocabulary processing failed: ' . $e->getMessage());
            throw $e;
        }
    }

    private function processVocabularyDirectory(string $vocabularyPath): void
    {
        $files = File::glob($vocabularyPath . '/*.txt');
        $this->stats['total_files'] = count($files);

        foreach ($files as $filePath) {
            $this->processVocabularyFile($filePath);
            $this->stats['processed_files']++;
        }

        $this->stats['unique_words'] = count($this->processedWords);
        Log::info("Processed {$this->stats['processed_files']} vocabulary files, extracted {$this->stats['unique_words']} unique words");
    }

    private function processVocabularyFile(string $filePath): void
    {
        $fileName = basename($filePath);
        Log::info("Processing vocabulary file: {$fileName}");

        $lines = File::lines($filePath);
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            if (empty($line)) {
                continue;
            }

            // Handle different formats
            $word = $this->extractWordFromLine($line);
            
            if ($word && $this->isValidWord($word)) {
                if (!isset($this->processedWords[$word])) {
                    $this->processedWords[$word] = [
                        'word' => $word,
                        'source_files' => [$fileName],
                        'first_seen_in' => $fileName
                    ];
                } else {
                    // Track which files contain this word
                    if (!in_array($fileName, $this->processedWords[$word]['source_files'])) {
                        $this->processedWords[$word]['source_files'][] = $fileName;
                    }
                    $this->stats['duplicates_skipped']++;
                }
                
                $this->stats['total_words']++;
            }
        }
    }

    private function extractWordFromLine(string $line): ?string
    {
        // Handle numbered format (line_number→word)
        if (strpos($line, '→') !== false) {
            $parts = explode('→', $line, 2);
            if (count($parts) >= 2) {
                return trim($parts[1]);
            }
        }
        
        // Handle simple one-word-per-line format
        return trim($line);
    }

    private function isValidWord(string $word): bool
    {
        // Basic validation
        if (strlen($word) < 1 || strlen($word) > 100) {
            return false;
        }

        // Skip if contains only numbers or special characters
        if (preg_match('/^[0-9\s\-_\.]+$/', $word)) {
            return false;
        }

        // Allow words with letters, numbers, apostrophes, hyphens
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9\'\-]*[a-zA-Z0-9]?$/', $word)) {
            return false;
        }

        return true;
    }

    private function insertWordsToDatabase(): void
    {
        Log::info("Inserting {$this->stats['unique_words']} unique words to database");

        DB::beginTransaction();
        
        try {
            $batchSize = 1000;
            $batches = array_chunk($this->processedWords, $batchSize, true);
            
            foreach ($batches as $batch) {
                $insertData = [];
                
                foreach ($batch as $wordData) {
                    // Check if word already exists
                    $existingWord = AppQyV1DictionaryModel::where('word', $wordData['word'])->first();
                    
                    if (!$existingWord) {
                        $insertData[] = [
                            'word' => $wordData['word'],
                            'phonetic' => null,
                            'definition' => null,
                            'translation' => null,
                            'example_sentence' => null,
                            'audio_file_path' => null,
                            'image_file_path' => null,
                            'word_frequency' => 0,
                            'query_count' => 0,
                            'difficulty_level' => 1,
                            'word_category' => 'vocabulary',
                            'source_info' => json_encode([
                                'source_files' => $wordData['source_files'],
                                'first_seen_in' => $wordData['first_seen_in'],
                                'processing_date' => now()->toISOString()
                            ]),
                            'is_active' => true,
                            'created_at' => now(),
                            'updated_at' => now()
                        ];
                    }
                }
                
                if (!empty($insertData)) {
                    AppQyV1DictionaryModel::insert($insertData);
                    Log::info("Inserted batch of " . count($insertData) . " words");
                }
            }
            
            DB::commit();
            Log::info("Successfully inserted all vocabulary words to database");
            
        } catch (\Exception $e) {
            DB::rollback();
            throw new \Exception("Failed to insert words to database: " . $e->getMessage());
        }
    }

    public function getProcessingStats(): array
    {
        if ($this->markerManager->isVocabularyProcessingComplete()) {
            // Get stats from database
            $totalWords = AppQyV1DictionaryModel::where('word_category', 'vocabulary')->count();
            return [
                'status' => 'completed',
                'total_words_in_db' => $totalWords,
                'processing_completed_at' => $this->markerManager->getVocabularyProcessingCompletedTime()
            ];
        }
        
        return array_merge($this->stats, ['status' => 'in_progress']);
    }

    public function resetProcessing(): void
    {
        Log::info('Resetting vocabulary processing markers and data');
        
        // Remove processing markers
        $this->markerManager->clearVocabularyProcessingMarkers();
        
        // Optionally remove vocabulary words from database
        // AppQyV1DictionaryModel::where('word_category', 'vocabulary')->delete();
        
        $this->processedWords = [];
        $this->stats = [
            'total_files' => 0,
            'processed_files' => 0,
            'total_words' => 0,
            'unique_words' => 0,
            'duplicates_skipped' => 0
        ];
    }
}
