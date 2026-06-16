<?php
namespace App\Apps\AppQyV1;

/**
 * AppQyV1ApiInfo Class
 * API information for app_qy vocabulary learning application
 */
class AppQyV1ApiInfo
{
    /**
     * Get API information for AppQyV1 app
     */
    public static function getApiInfo(): array
    {
        return [
            "app_name" => "AppQyV1",
            "api_version" => "v1",
            "app_description" => "app_qy vocabulary learning system",
            "base_url" => url("/api"),
            "api_prefix" => url("/api"),
            "endpoints" => self::getEndpoints(),
            "supported_headers" => self::getSupportedHeaders(),
            "authentication" => [
                "type" => "JWT Bearer Token",
                "methods" => ["Phone SMS", "WeChat OAuth"],
                "token_expiry" => 86400
            ]
        ];
    }

    private static function getEndpoints(): array
    {
        return [
            // Authentication endpoints (dict/v1)
            [
                "path" => "/api/dict/v1/register",
                "method" => "POST/ANY",
                "feature" => "User Registration",
                "description" => "User registration",
                "auth_required" => false,
                "parameters" => ["name", "email", "password"]
            ],
            [
                "path" => "/api/dict/v1/login",
                "method" => "POST/ANY",
                "feature" => "User Login",
                "description" => "User login",
                "auth_required" => false,
                "parameters" => ["email", "password"]
            ],
            [
                "path" => "/api/dict/v1/logout",
                "method" => "POST/ANY",
                "feature" => "User Logout",
                "description" => "User logout",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/user",
                "method" => "ANY",
                "feature" => "Get Current User",
                "description" => "Get current user information",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/forgot-password",
                "method" => "POST/ANY",
                "feature" => "Password Reset Request",
                "description" => "Request password reset",
                "auth_required" => false,
                "parameters" => ["email"]
            ],
            [
                "path" => "/api/dict/v1/reset-password",
                "method" => "POST/ANY",
                "feature" => "Password Reset",
                "description" => "Reset password",
                "auth_required" => false,
                "parameters" => ["token", "email", "password"]
            ],

            // System & Initialization endpoints (dict/v1/system)
            [
                "path" => "/api/dict/v1/system/initialize",
                "method" => "POST",
                "feature" => "System Initialization",
                "description" => "Initialize system and vocabulary",
                "auth_required" => false
            ],
            [
                "path" => "/api/dict/v1/system/initialization-status",
                "method" => "GET",
                "feature" => "Initialization Status",
                "description" => "Check initialization status",
                "auth_required" => false
            ],
            [
                "path" => "/api/dict/v1/system/process-vocabulary",
                "method" => "POST",
                "feature" => "Process Vocabulary",
                "description" => "Process vocabulary only",
                "auth_required" => false
            ],
            [
                "path" => "/api/dict/v1/system/vocabulary-status",
                "method" => "GET",
                "feature" => "Vocabulary Status",
                "description" => "Get vocabulary processing status",
                "auth_required" => false
            ],
            [
                "path" => "/api/dict/v1/system/dictionary-statistics",
                "method" => "GET",
                "feature" => "Dictionary Statistics",
                "description" => "Get dictionary statistics",
                "auth_required" => false
            ],
            [
                "path" => "/api/dict/v1/system/supported-languages",
                "method" => "GET",
                "feature" => "Supported Languages List",
                "description" => "Get supported languages list for learning",
                "auth_required" => false
            ],
            [
                "path" => "/api/dict/v1/system/supported-languages/{code}",
                "method" => "GET",
                "feature" => "Language by Code",
                "description" => "Get language details by code",
                "auth_required" => false,
                "parameters" => ["code"]
            ],

            // Public vocabulary libraries
            [
                "path" => "/api/dict/v1/vocabulary/libraries/recommended",
                "method" => "GET",
                "feature" => "Recommended Vocabulary Libraries",
                "description" => "Get default recommended vocabulary libraries",
                "auth_required" => false,
                "parameters" => ["language", "limit"]
            ],
            [
                "path" => "/api/dict/v1/vocabulary/libraries",
                "method" => "GET",
                "feature" => "Vocabulary Libraries List",
                "description" => "Get paginated vocabulary libraries with filters",
                "auth_required" => false,
                "parameters" => ["page", "per_page", "language", "category", "difficulty", "search"]
            ],

            // Learning Management endpoints (dict/v1/learning)
            [
                "path" => "/api/dict/v1/learning/languages",
                "method" => "GET",
                "feature" => "Get User Learning Languages",
                "description" => "Get user's learning languages",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/learning/languages",
                "method" => "POST",
                "feature" => "Set User Learning Languages",
                "description" => "Set/update user learning languages",
                "auth_required" => true,
                "parameters" => ["languages"]
            ],
            [
                "path" => "/api/dict/v1/learning/libraries",
                "method" => "GET",
                "feature" => "Get Vocabulary Libraries",
                "description" => "Get vocabulary libraries",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/learning/libraries/select",
                "method" => "POST",
                "feature" => "Select Vocabulary Library",
                "description" => "Select a vocabulary library",
                "auth_required" => true,
                "parameters" => ["library_id"]
            ],
            [
                "path" => "/api/dict/v1/learning/recommendations",
                "method" => "GET",
                "feature" => "Vocabulary Recommendations",
                "description" => "Get recommended vocabulary collections based on learning language",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/learning/collections/select",
                "method" => "POST",
                "feature" => "Select Vocabulary Collection",
                "description" => "Select a vocabulary collection",
                "auth_required" => true,
                "parameters" => ["collection_id"]
            ],
            [
                "path" => "/api/dict/v1/learning/collections/selected",
                "method" => "GET",
                "feature" => "Get Selected Collections",
                "description" => "Get user's selected collections",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/learning/words",
                "method" => "GET",
                "feature" => "Get Word Cards",
                "description" => "Get word cards for learning",
                "auth_required" => true,
                "parameters" => ["limit", "offset"]
            ],
            [
                "path" => "/api/dict/v1/learning/progress",
                "method" => "POST",
                "feature" => "Update Learning Progress",
                "description" => "Update learning progress",
                "auth_required" => true,
                "parameters" => ["word_id", "status"]
            ],
            [
                "path" => "/api/dict/v1/learning/stats",
                "method" => "GET",
                "feature" => "Learning Statistics",
                "description" => "Get learning statistics",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/learning/upload",
                "method" => "POST",
                "feature" => "Upload Document",
                "description" => "Upload document for vocabulary extraction",
                "auth_required" => true,
                "parameters" => ["file"]
            ],
            [
                "path" => "/api/dict/v1/learning/libraries/{library_id}",
                "method" => "DELETE",
                "feature" => "Delete Library",
                "description" => "Delete a vocabulary library",
                "auth_required" => true,
                "parameters" => ["library_id"]
            ],

            // Vocabulary export + document extraction (2026-06-12)
            [
                "path" => "/api/app_qy_v1/vocabulary/export/{format}",
                "method" => "POST",
                "feature" => "Vocabulary Export",
                "description" => "Export vocabulary as a file download; format = csv|json|anki|text|pdf (pdf falls back to printable HTML when dompdf is absent)",
                "auth_required" => false,
                "parameters" => ["format", "language", "library_id", "limit", "include_phonetics", "include_translations"]
            ],
            [
                "path" => "/api/app_qy_v1/vocabulary/document/{id}/extract-words",
                "method" => "POST",
                "feature" => "Extract Words from Document",
                "description" => "Tokenize an uploaded document and append unique words to its collection (idempotent)",
                "auth_required" => true,
                "parameters" => ["id"]
            ],
            [
                "path" => "/api/app_qy_v1/vocabulary/document/{id}/extract-sentences",
                "method" => "POST",
                "feature" => "Extract Sentences from Document",
                "description" => "Split an uploaded document into sentences and store them in the shared sentence library (deduplicated)",
                "auth_required" => true,
                "parameters" => ["id"]
            ],

            // Word Operations endpoints (words)
            [
                "path" => "/api/app_qy_v1/words/daily",
                "method" => "GET",
                "feature" => "Daily Words",
                "description" => "Get daily words (flat array of {id, word, translation, phonetic})",
                "auth_required" => true,
                "parameters" => ["count", "language"]
            ],
            [
                "path" => "/api/app_qy_v1/system/init-compliance",
                "method" => "GET",
                "feature" => "Init Compliance Report",
                "description" => "Read-only health of all sys:init items: marker flags, external-data migration, per-language tts_cache promotion, legacy deprecation, octane timer, app initializers",
                "auth_required" => false,
                "parameters" => []
            ],
            [
                "path" => "/api/words/{id}",
                "method" => "GET",
                "feature" => "Word Details",
                "description" => "Get word details",
                "auth_required" => true,
                "parameters" => ["id"]
            ],
            [
                "path" => "/api/words/{id}/learn",
                "method" => "POST",
                "feature" => "Mark as Learned",
                "description" => "Mark word as learned",
                "auth_required" => true,
                "parameters" => ["id"]
            ],
            [
                "path" => "/api/words/{id}/review",
                "method" => "POST",
                "feature" => "Mark as Reviewed",
                "description" => "Mark word as reviewed",
                "auth_required" => true,
                "parameters" => ["id"]
            ],
            [
                "path" => "/api/words/{id}/favorite",
                "method" => "POST",
                "feature" => "Toggle Favorite",
                "description" => "Toggle favorite status",
                "auth_required" => true,
                "parameters" => ["id"]
            ],
            [
                "path" => "/api/words/search/{query}",
                "method" => "GET",
                "feature" => "Search Words",
                "description" => "Search words",
                "auth_required" => true,
                "parameters" => ["query"]
            ],
            [
                "path" => "/api/words/public/{word}",
                "method" => "GET",
                "feature" => "Public Word Lookup",
                "description" => "Public word lookup (no auth)",
                "auth_required" => false,
                "parameters" => ["word"]
            ],

            // Enhanced Word Query endpoints (dict/v1)
            [
                "path" => "/api/dict/v1/word/{word}/enhanced",
                "method" => "GET/POST",
                "feature" => "Enhanced Word Query",
                "description" => "Enhanced word query with full data",
                "auth_required" => true,
                "parameters" => ["word"]
            ],
            [
                "path" => "/api/dict/v1/untranslated",
                "method" => "GET",
                "feature" => "Untranslated Words",
                "description" => "Get untranslated words",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/untranslated/priority",
                "method" => "GET",
                "feature" => "Words by Priority",
                "description" => "Get words by priority",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/word/{word}/translation",
                "method" => "POST",
                "feature" => "Submit Translation",
                "description" => "Submit translation for word",
                "auth_required" => true,
                "parameters" => ["word", "translation"]
            ],
            [
                "path" => "/api/dict/v1/word/{word}/audio",
                "method" => "POST",
                "feature" => "Submit Audio",
                "description" => "Submit audio for word",
                "auth_required" => true,
                "parameters" => ["word", "audio"]
            ],
            [
                "path" => "/api/dict/v1/word/{word}/images",
                "method" => "POST",
                "feature" => "Submit Images",
                "description" => "Submit images for word",
                "auth_required" => true,
                "parameters" => ["word", "images"]
            ],
            [
                "path" => "/api/dict/v1/word/{word}/complete",
                "method" => "POST",
                "feature" => "Submit Complete Word Data",
                "description" => "Submit complete word data",
                "auth_required" => true,
                "parameters" => ["word", "data"]
            ],

            // User Profile & Stats endpoints (user)
            [
                "path" => "/api/dict/v1/user/initialization-status",
                "method" => "GET",
                "feature" => "User Initialization Status",
                "description" => "Check if user has completed initial onboarding",
                "auth_required" => true
            ],
            [
                "path" => "/api/dict/v1/user/initialize",
                "method" => "POST",
                "feature" => "Complete User Initialization",
                "description" => "Submit learning preferences and onboarding data",
                "auth_required" => true,
                "parameters" => ["learning_languages", "occupation", "daily_words_target", "daily_study_time", "preferences"]
            ],
            [
                "path" => "/api/user/progress",
                "method" => "GET",
                "feature" => "User Progress",
                "description" => "Get user learning progress",
                "auth_required" => true
            ],
            [
                "path" => "/api/user/stats",
                "method" => "GET",
                "feature" => "User Statistics",
                "description" => "Get user statistics",
                "auth_required" => true
            ],
            [
                "path" => "/api/user/profile",
                "method" => "GET",
                "feature" => "User Profile",
                "description" => "Get user profile",
                "auth_required" => true
            ],
            [
                "path" => "/api/user/profile",
                "method" => "PUT",
                "feature" => "Update Profile",
                "description" => "Update user profile",
                "auth_required" => true,
                "parameters" => ["displayName", "avatar"]
            ],

            // AI Tools - Translation endpoints (app_qy_v1/ai_tools/translation)
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/languages",
                "method" => "GET",
                "feature" => "Translation Languages",
                "description" => "Get supported translation languages",
                "auth_required" => false
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/types",
                "method" => "GET",
                "feature" => "Translation Types",
                "description" => "Get translation types",
                "auth_required" => false
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/models",
                "method" => "GET",
                "feature" => "Translation Models",
                "description" => "Get available translation models",
                "auth_required" => false
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/templates",
                "method" => "GET",
                "feature" => "Translation Templates",
                "description" => "Get translation templates",
                "auth_required" => false
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/translate",
                "method" => "POST",
                "feature" => "Translate Text",
                "description" => "Translate text",
                "auth_required" => true,
                "parameters" => ["text", "source_lang", "target_lang"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/batch",
                "method" => "POST",
                "feature" => "Batch Translate",
                "description" => "Batch translate texts",
                "auth_required" => true,
                "parameters" => ["texts", "source_lang", "target_lang"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/simple/google",
                "method" => "POST",
                "feature" => "Google Translate",
                "description" => "Simple Google translate",
                "auth_required" => true,
                "parameters" => ["text", "target_lang"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/learning",
                "method" => "POST",
                "feature" => "Learning Mode Translation",
                "description" => "Learning mode translation",
                "auth_required" => true,
                "parameters" => ["text", "options"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/task/{taskId}",
                "method" => "GET",
                "feature" => "Translation Task Status",
                "description" => "Get translation task status",
                "auth_required" => true,
                "parameters" => ["taskId"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/translation/process-next",
                "method" => "POST",
                "feature" => "Process Next Task",
                "description" => "Process next translation task",
                "auth_required" => true
            ],

            // AI Tools - TTS endpoints (app_qy_v1/ai_tools/tts)
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/voices",
                "method" => "GET",
                "feature" => "TTS Voices",
                "description" => "Get available TTS voices for pronunciation",
                "auth_required" => false
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{speed}/{filename}",
                "method" => "GET",
                "feature" => "Serve Audio with Speed",
                "description" => "Serve audio file with speed control",
                "auth_required" => false,
                "parameters" => ["language", "type", "speed", "filename"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{filename}",
                "method" => "GET",
                "feature" => "Serve Audio",
                "description" => "Serve audio file",
                "auth_required" => false,
                "parameters" => ["language", "type", "filename"]
            ],
            // Sentence-library audio pipeline (pycore worker + FE resolve).
            // File on disk is the source of truth; see
            // development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md.
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/sentence/claim",
                "method" => "POST",
                "feature" => "Claim Sentence Audio",
                "description" => "Worker claim of sentences needing audio, priority ordered (limit=0 -> counts only)",
                "auth_required" => false,
                "parameters" => ["worker_id", "language", "limit"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/sentence/report",
                "method" => "POST",
                "feature" => "Report Sentence Audio",
                "description" => "Worker report of a generated sentence MP3 (multipart on success); idempotent",
                "auth_required" => false,
                "parameters" => ["sentence_id", "worker_id", "success", "provider", "audio", "audio_base64", "error"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/sentence/audio",
                "method" => "GET",
                "feature" => "Resolve Sentence Audio",
                "description" => "File-first resolution of one sentence's audio by hash (sentence_id|content_id) or text+language",
                "auth_required" => false,
                "parameters" => ["hash", "text", "language"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/generate",
                "method" => "POST",
                "feature" => "Generate TTS",
                "description" => "Generate TTS audio",
                "auth_required" => true,
                "parameters" => ["text", "language", "voice"]
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/tts/batch-generate",
                "method" => "POST",
                "feature" => "Batch Generate TTS",
                "description" => "Batch generate TTS audio",
                "auth_required" => true,
                "parameters" => ["texts", "language", "voice"]
            ],

            // Third-party assist protocol (pycore worker surface, 60-minute lease)
            [
                "path" => "/api/app_qy_v1/assist/claim",
                "method" => "POST",
                "feature" => "Assist Claim",
                "description" => "Claim cover/TTS work units under a 60-minute lease (pycore worker)",
                "auth_required" => false,
                "parameters" => ["types", "limit", "claimer"]
            ],
            [
                "path" => "/api/app_qy_v1/assist/submit",
                "method" => "POST",
                "feature" => "Assist Submit",
                "description" => "Submit a generated artifact (cover image_base64 / tts audio_base64) for a claimed unit",
                "auth_required" => false,
                "parameters" => ["type", "id", "image_base64", "audio_base64", "mime", "voice", "claimer"]
            ],
            [
                "path" => "/api/app_qy_v1/assist/release",
                "method" => "POST",
                "feature" => "Assist Release",
                "description" => "Release claimed units back to the queue (retry semantics with optional error)",
                "auth_required" => false,
                "parameters" => ["type", "ids", "error", "claimer"]
            ],
            [
                "path" => "/api/app_qy_v1/assist/status",
                "method" => "GET",
                "feature" => "Assist Status",
                "description" => "Cover and TTS queue counters including live assist leases",
                "auth_required" => false
            ],

            // Cover pipeline dashboard endpoints
            [
                "path" => "/api/app_qy_v1/ai_tools/cover-status",
                "method" => "GET",
                "feature" => "Cover Pipeline Status",
                "description" => "Cover generation task/queue status, Gemini and pycore provider health, recent failures",
                "auth_required" => false
            ],
            [
                "path" => "/api/app_qy_v1/ai_tools/cover-retry",
                "method" => "POST",
                "feature" => "Cover Pipeline Retry",
                "description" => "Reset failed and stale-processing covers to pending and clear expired assist leases",
                "auth_required" => false
            ],

            // Static file fallback (bare Octane; nginx serves /static in production)
            [
                "path" => "/static/{path}",
                "method" => "GET",
                "feature" => "Static File Fallback",
                "description" => "Serve external static files (vocabulary covers, media clips) when no nginx front intercepts /static",
                "auth_required" => false,
                "parameters" => ["path"]
            ],

            // Other endpoints
            [
                "path" => "/api/app_qy_v1/invitation-code",
                "method" => "GET",
                "feature" => "Invitation Code",
                "description" => "Get masked invitation code",
                "auth_required" => false
            ],
        ];
    }

    private static function getSupportedHeaders(): array
    {
        return [
            "Authorization" => "Bearer {access_token}",
            "Content-Type" => "application/json",
            "Accept" => "application/json"
        ];
    }

    public function getDetails(): array
    {
        return self::getApiInfo();
    }
}
