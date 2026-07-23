<?php

// AI editing rules for this file:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, migrate, or start
//    the server. Delivering the written code is the entire task.

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;

/**
 * AppQyV1DailyReadingLibraryDefaults
 * -------------------------------------------------------------------------
 * Code-owned 'Daily Reading' vocabulary library, ensured idempotently at every
 * sys:init (AppQyV1Initializer's `seed_daily_reading_library` step). Mirrors the
 * AppQyV1AiPromptDefaults pattern: code is the single source of truth for this
 * row (looked up by the unique `source` key; never duplicated on re-run).
 *
 * The library is the category container for agent-history daily-reading
 * documents: AppQyV1ArticleController::workerSubmit() stores each submitted
 * article body as an uploaded_documents row whose collection_id points here
 * (uploaded_documents.collection_id stores a vocabulary_libraries id after the
 * Wave A consolidation).
 */
class AppQyV1DailyReadingLibraryDefaults
{
    /** Unique source key for the code-owned daily-reading library row. */
    public const LIBRARY_SOURCE = 'daily_reading';

    public const LIBRARY_NAME = 'Daily Reading';

    public const LIBRARY_CATEGORY = 'daily_reading';

    /**
     * Initializer step entry point. Returns the step-result array directly
     * (same contract as AppQyV1BookSeedImporter::import()); never throws — a
     * seeding failure is reported as 'warning' so init still completes and the
     * step is retried on the next run.
     */
    public static function seed(): array
    {
        try {
            $library = self::ensureLibrary();
            return [
                'status' => 'success',
                'message' => "Daily reading library ensured (id {$library->id})",
                'library_id' => (int) $library->id,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'warning',
                'message' => 'Daily reading library seeding failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Skip-if-exists ensure keyed by the unique `source` column (same lookup
     * convention as AppQyV1VocabularyImporter::createVocabularyCollection).
     */
    public static function ensureLibrary(): AppQyV1VocabularyLibraryModel
    {
        $library = AppQyV1VocabularyLibraryModel::where('source', self::LIBRARY_SOURCE)->first();
        if ($library) {
            return $library;
        }

        $library = new AppQyV1VocabularyLibraryModel([
            'name' => self::LIBRARY_NAME,
            'description' => 'Agent-history daily reading articles (English article + Chinese reference).',
            'language' => 'english',
            'total_words' => 0,
            'is_public' => false,
            'owner_user_id' => 0,
            'source' => self::LIBRARY_SOURCE,
            'category' => self::LIBRARY_CATEGORY,
            'word_ids' => [],
        ]);
        $library->save();

        return $library;
    }

    /** True when the code-owned daily-reading library already exists. */
    public static function isSeeded(): bool
    {
        return AppQyV1VocabularyLibraryModel::where('source', self::LIBRARY_SOURCE)->exists();
    }
}
