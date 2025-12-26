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

use Illuminate\Support\Facades\Route;

# -----------------------------Dict-------------------------------
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupCreationController as DGAController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupQueryController as DGQController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupDeletionController as DGDController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupLibraryController as DGLibController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupWordController as DGWordController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupProgressController as DGProgressController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries\AppQyV1DictionaryManagementController as AddDController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries\AppQyV1DictionaryQueryController as QueryDController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries\AppQyV1DictionaryTaskController as TaskDController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1CoverImageController as CoverImageController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupLanguageController as DGLangController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/create_group', [DGAController::class, 'createDictGroup']);
        Route::any('/query_all_groups', [DGQController::class, 'getAllGroup']);

        // Language-based study groups
        Route::post('/study_groups/create_for_language', [DGLangController::class, 'createForLanguage']);
        Route::get('/study_groups/by_language/{language}', [DGLangController::class, 'getByLanguage']);
        Route::post('/study_groups/ensure_language_groups', [DGLangController::class, 'ensureLanguageGroups']);
        Route::any('/query_group_by_name', [DGQController::class, 'getGroupByName']);
        Route::any('/query_group_by_gid', [DGQController::class, 'getGroupByGid']);
        Route::any('/query_gwords', [DGQController::class, 'getGwords']);
        Route::any('/query_gcontent', [DGQController::class, 'getGcontent']);
        Route::any('/query_gfrequency', [DGQController::class, 'getGFrequency']);
        Route::any('/delete_group_by_name', [DGDController::class, 'deleteDictGroupByGname']);
        Route::any('/delete_group_by_gid', [DGDController::class, 'deleteDictGroupByGid']);

        // Group Library Management Routes
        Route::any('/group/add_library', [DGLibController::class, 'addLibraryToGroup']);
        Route::any('/group/remove_library', [DGLibController::class, 'removeLibraryFromGroup']);
        Route::any('/group/get_libraries', [DGLibController::class, 'getGroupLibraries']);

        // Group Word Management Routes
        Route::any('/group/add_word', [DGWordController::class, 'addWordToGroup']);
        Route::any('/group/remove_word', [DGWordController::class, 'removeWordFromGroup']);
        Route::any('/group/get_words', [DGWordController::class, 'getGroupWords']);

        // Group Progress Routes
        Route::any('/group/update_progress', [DGProgressController::class, 'updateProgress']);
        Route::any('/group/get_review_words', [DGProgressController::class, 'getReviewWords']);
        Route::any('/group/get_progress_stats', [DGProgressController::class, 'getProgressStats']);

        // Dictionary Routes
        // Route::any('/add_dictionary', [AddDController::class, 'addDictionary']);
        // Route::any('/add_dictionary_list', [AddDController::class, 'addDictionaryList']);

        // Dictionary Task Routes
        Route::any('/dictionary/tasks/create-explanation', [TaskDController::class, 'createExplanationTask']);
        Route::any('/dictionary/tasks/untranslated-words', [TaskDController::class, 'getUntranslatedWordsCount']);

        // Cover Image Routes (Authenticated)
        Route::any('/covers/categories', [CoverImageController::class, 'getCategories']);
    });

    // Public Routes - No authentication required
    Route::get('/covers/{filename}', [CoverImageController::class, 'serveCoverImage']);

    // Client Token Auth Routes - Protected by client.token middleware
    Route::middleware(['client.token'])->group(function () {
        Route::any('/add_dictionary', [AddDController::class, 'filterAndAddDictionaryList']);
        Route::any('/find_non_existing_dictionary', [QueryDController::class, 'findNonExistingEntries']);
    });
});

