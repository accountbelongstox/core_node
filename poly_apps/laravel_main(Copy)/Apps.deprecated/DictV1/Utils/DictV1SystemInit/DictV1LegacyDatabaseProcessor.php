<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DictV1\Utils\DictV1SystemInit;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use App\Apps\DictV1\DictV1Models\DictV1DictionaryModel;

/**
 * Legacy Database Processor for Dictionary System
 * Reference: DevOps server_controller/server_init_olddb.js, server_migrate.js
 */
class DictV1LegacyDatabaseProcessor
{
    protected $storageManager;

    public function __construct()
    {
        $this->storageManager = new DictV1ExternalStorageManager();
    }

    /**
     * Convert legacy database to new format
     * Reference: DevOps server_controller/server_migrate.js migration logic
     * 
     * @param string $legacyDbPath
     * @return array
     */
    public function convertLegacyDatabase(string $legacyDbPath): array
    {
        try {
            // Check if legacy database exists
            if (!File::exists($legacyDbPath)) {
                return ['success' => false, 'progress' => 0, 'error' => 'Legacy database not found'];
            }

            // Connect to legacy SQLite database
            $legacyConnection = new \PDO('sqlite:' . $legacyDbPath);
            $legacyConnection->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            // Get total records count for progress tracking
            $totalRecords = $legacyConnection->query("SELECT COUNT(*) FROM translation_data")->fetchColumn();
            
            if ($totalRecords == 0) {
                return ['success' => false, 'progress' => 0, 'error' => 'Legacy database is empty'];
            }

            // Process legacy data in batches
            $batchSize = 1000;
            $processedRecords = 0;
            $offset = 0;

            DB::beginTransaction();

            try {
                while ($offset < $totalRecords) {
                    // Fetch batch from legacy database
                    // Reference: DevOps provider/schemas/old_tradata_schema.js
                    $stmt = $legacyConnection->prepare("
                        SELECT 
                            content,
                            translation,
                            isTranslation,
                            translation_provider,
                            usPhonetic,
                            ukPhonetic,
                            voice_files,
                            image_files,
                            isExistLocal,
                            voice_files_provider,
                            image_files_provider,
                            hasOperations,
                            queryCount,
                            lastModified,
                            lastInsertTime,
                            lastUpdateTime,
                            lastQueryTime,
                            createdAt
                        FROM translation_data 
                        LIMIT :limit OFFSET :offset
                    ");
                    
                    $stmt->bindValue(':limit', $batchSize, \PDO::PARAM_INT);
                    $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
                    $stmt->execute();
                    
                    $legacyRecords = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                    
                    if (empty($legacyRecords)) {
                        break;
                    }

                    // Convert and insert records
                    foreach ($legacyRecords as $legacyRecord) {
                        $this->convertAndInsertRecord($legacyRecord);
                        $processedRecords++;
                    }

                    $offset += $batchSize;
                    
                    // Update progress
                    $progress = round(($processedRecords / $totalRecords) * 100);
                    
                    // For very large databases, return progress status
                    if ($progress < 100 && $processedRecords % 5000 === 0) {
                        return ['success' => false, 'progress' => $progress];
                    }
                }

                DB::commit();

                return [
                    'success' => true,
                    'progress' => 100,
                    'total_records' => $totalRecords,
                    'processed_records' => $processedRecords
                ];

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            return [
                'success' => false,
                'progress' => 0,
                'error' => 'Database conversion failed: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Convert and insert a single record
     * Reference: DevOps middware/middb/wordInsert.js insertion logic
     * 
     * @param array $legacyRecord
     * @return bool
     */
    protected function convertAndInsertRecord(array $legacyRecord): bool
    {
        try {
            // Check if record already exists
            $existingRecord = DictV1DictionaryModel::findByContent($legacyRecord['content']);
            
            if ($existingRecord) {
                // Update existing record with legacy data if needed
                $this->updateExistingRecord($existingRecord, $legacyRecord);
                return true;
            }

            // Create new record from legacy data
            $dictionary = new DictV1DictionaryModel();
            $dictionary->content = $legacyRecord['content'];
            $dictionary->md5 = md5($legacyRecord['content']);
            
            // Handle JSON fields - ensure proper decoding/encoding
            $dictionary->translation = $this->convertJsonField($legacyRecord['translation']);
            $dictionary->voice_files = $this->convertJsonField($legacyRecord['voice_files']);
            $dictionary->image_files = $this->convertJsonField($legacyRecord['image_files']);
            
            // Convert boolean fields
            $dictionary->isTranslation = $this->convertBooleanField($legacyRecord['isTranslation']);
            $dictionary->isExistLocal = $this->convertBooleanField($legacyRecord['isExistLocal']);
            $dictionary->hasOperations = $this->convertBooleanField($legacyRecord['hasOperations']);
            
            // Convert integer fields
            $dictionary->translation_provider = (int)($legacyRecord['translation_provider'] ?? 0);
            $dictionary->voice_files_provider = (int)($legacyRecord['voice_files_provider'] ?? 0);
            $dictionary->image_files_provider = (int)($legacyRecord['image_files_provider'] ?? 0);
            $dictionary->queryCount = (int)($legacyRecord['queryCount'] ?? 1);
            
            // Convert string fields
            $dictionary->usPhonetic = $legacyRecord['usPhonetic'] ?? null;
            $dictionary->ukPhonetic = $legacyRecord['ukPhonetic'] ?? null;
            
            // Convert timestamp fields
            $dictionary->lastModified = $this->convertTimestampField($legacyRecord['lastModified']);
            $dictionary->lastInsertTime = $this->convertTimestampField($legacyRecord['lastInsertTime']);
            $dictionary->lastUpdateTime = $this->convertTimestampField($legacyRecord['lastUpdateTime']);
            $dictionary->lastQueryTime = $this->convertTimestampField($legacyRecord['lastQueryTime']);
            $dictionary->createdAt = $this->convertTimestampField($legacyRecord['createdAt']);
            
            $dictionary->save();
            
            return true;

        } catch (\Exception $e) {
            // Log error but continue processing
            \Log::error('Failed to convert legacy record: ' . $e->getMessage(), ['record' => $legacyRecord]);
            return false;
        }
    }

    /**
     * Update existing record with legacy data
     * 
     * @param DictV1DictionaryModel $existingRecord
     * @param array $legacyRecord
     * @return bool
     */
    protected function updateExistingRecord(DictV1DictionaryModel $existingRecord, array $legacyRecord): bool
    {
        try {
            $updated = false;
            
            // Update translation if legacy has more data
            if (empty($existingRecord->translation) && !empty($legacyRecord['translation'])) {
                $existingRecord->translation = $this->convertJsonField($legacyRecord['translation']);
                $updated = true;
            }
            
            // Update phonetic data if missing
            if (empty($existingRecord->usPhonetic) && !empty($legacyRecord['usPhonetic'])) {
                $existingRecord->usPhonetic = $legacyRecord['usPhonetic'];
                $updated = true;
            }
            
            if (empty($existingRecord->ukPhonetic) && !empty($legacyRecord['ukPhonetic'])) {
                $existingRecord->ukPhonetic = $legacyRecord['ukPhonetic'];
                $updated = true;
            }
            
            // Update file references if missing
            if (empty($existingRecord->voice_files) && !empty($legacyRecord['voice_files'])) {
                $existingRecord->voice_files = $this->convertJsonField($legacyRecord['voice_files']);
                $updated = true;
            }
            
            if (empty($existingRecord->image_files) && !empty($legacyRecord['image_files'])) {
                $existingRecord->image_files = $this->convertJsonField($legacyRecord['image_files']);
                $updated = true;
            }
            
            // Always update query count (accumulate)
            $existingRecord->queryCount += (int)($legacyRecord['queryCount'] ?? 0);
            $updated = true;
            
            if ($updated) {
                $existingRecord->lastUpdateTime = now();
                $existingRecord->save();
            }
            
            return true;
            
        } catch (\Exception $e) {
            \Log::error('Failed to update existing record: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Convert JSON field from legacy format
     * 
     * @param mixed $value
     * @return array|null
     */
    protected function convertJsonField($value): ?array
    {
        if (empty($value)) {
            return null;
        }
        
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return $decoded !== null ? $decoded : null;
        }
        
        if (is_array($value)) {
            return $value;
        }
        
        return null;
    }

    /**
     * Convert boolean field from legacy format
     * 
     * @param mixed $value
     * @return bool
     */
    protected function convertBooleanField($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        
        if (is_numeric($value)) {
            return (bool)$value;
        }
        
        if (is_string($value)) {
            return strtolower($value) === 'true' || $value === '1';
        }
        
        return false;
    }

    /**
     * Convert timestamp field from legacy format
     * 
     * @param mixed $value
     * @return \Carbon\Carbon|null
     */
    protected function convertTimestampField($value): ?\Carbon\Carbon
    {
        if (empty($value)) {
            return now();
        }
        
        try {
            return \Carbon\Carbon::parse($value);
        } catch (\Exception $e) {
            return now();
        }
    }

    /**
     * Validate legacy database structure
     * 
     * @param string $legacyDbPath
     * @return array
     */
    public function validateLegacyDatabase(string $legacyDbPath): array
    {
        try {
            $connection = new \PDO('sqlite:' . $legacyDbPath);
            $connection->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            // Check if required table exists
            $tables = $connection->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(\PDO::FETCH_COLUMN);
            
            if (!in_array('translation_data', $tables)) {
                return ['valid' => false, 'error' => 'Required table translation_data not found'];
            }

            // Check table structure
            $columns = $connection->query("PRAGMA table_info(translation_data)")->fetchAll(\PDO::FETCH_ASSOC);
            $requiredColumns = ['content', 'translation'];
            $existingColumns = array_column($columns, 'name');
            
            foreach ($requiredColumns as $requiredCol) {
                if (!in_array($requiredCol, $existingColumns)) {
                    return ['valid' => false, 'error' => "Required column $requiredCol not found"];
                }
            }

            // Get record count
            $recordCount = $connection->query("SELECT COUNT(*) FROM translation_data")->fetchColumn();

            return [
                'valid' => true,
                'record_count' => $recordCount,
                'tables' => $tables,
                'columns' => $existingColumns
            ];

        } catch (\Exception $e) {
            return ['valid' => false, 'error' => 'Database validation failed: ' . $e->getMessage()];
        }
    }
}