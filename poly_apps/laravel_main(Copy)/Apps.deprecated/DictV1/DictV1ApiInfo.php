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

namespace App\Apps\DictV1;

use App\Apps\DictV1\Controllers\DictV1Public\DictV1ApiDocumentationController;
use App\Apps\DictV1\DictV1Gvar\Gvar;
use App\Http\Common\CommonGvar;

/**
 * DictV1ApiInfo Class
 * 
 * STANDARD FEATURE FORMAT SPECIFICATION - MUST FOLLOW CommonApiInfo.php
 * 
 * Format: auth_type/method|description|controller|params:param_list|headers:header_list|response:response_list|tags:tag_list
 * 
 * This class MUST use the same feature format as defined in CommonApiInfo.php
 * All feature strings must include examples in parameter definitions for automatic test generation
 * 
 * Parameter format: param_name(type,requirement,example)
 * Response format: field_name(type,description)
 * Tags: dict, user, admin, system, word, group, personal
 */
class DictV1ApiInfo
{
    /**
     * Get API information for DictV1 app
     *
     * @return array
     */
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'DictV1',
            'api_version' => 'v1',
            'app_description' => 'Dictionary management and word learning system',
            'base_url' => url('/api'),
            'api_prefix' => url('/api') . '/dict/v1',
            'endpoints' => self::getEnhancedEndpoints(),
            'supported_headers' => self::getSupportedHeaders(),
            'authentication' => [
                'type' => 'dual_authentication',
                'methods' => [
                    'user_auth' => [
                        'description' => 'Traditional user authentication for user-specific features',
                        'headers' => ['Auth-User-Token'],
                        'features' => ['personal dictionary', 'word groups', 'user management']
                    ],
                    'resource_access' => [
                        'description' => 'Resource access authentication for static content',
                        'production' => 'Resource-Access-Key header',
                        'debug' => 'Auth-Debug-Token header',
                        'features' => ['word audio', 'word images', 'basic word queries']
                    ]
                ],
                'mode_selection' => 'Resource auth mode selected by APP_DEBUG environment variable'
            ]
        ];
    }

    /**
     * Get enhanced endpoint information based on actual routes
     *
     * @return array
     */
    private static function getEnhancedEndpoints(): array
    {
        $basePrefix = url('/api') . '/dict/v1';
        
        return [
            // User Authentication routes (from DictV1Auth.php)
            [
                'path' => $basePrefix . '/register',
                'feature' => 'no_auth_required/ANY|User registration|DictV1AuthenticationRegistrationController|params:username(string,required),password(string,required),email(string,optional)|response:user,token'
            ],
            [
                'path' => $basePrefix . '/login',
                'feature' => 'no_auth_required/ANY|User login|DictV1AuthenticationLoginController|params:username(string,optional,user123),password(string,optional,password123)|headers:{{' . CommonGvar::AuthUserToken . '}}(string,optional,user-token-123)|response:token(string,Access token),user(object,User data),login_by(string,Login method),token_type(string,Token type),expiration(string,Token expiration)|tags:dict,auth'
            ],
            [
                'path' => $basePrefix . '/logout',
                'feature' => 'auth_required:user/ANY|User logout|DictV1AuthenticationLoginController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:message'
            ],
            [
                'path' => $basePrefix . '/user',
                'feature' => 'auth_required:user/ANY|Get authenticated user info|inline_function|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:user'
            ],
            [
                'path' => $basePrefix . '/forgot-password',
                'feature' => 'no_auth_required/ANY|Send password reset link|DictV1AuthenticationPasswordResetLinkController|params:email(string,required)|response:message'
            ],
            [
                'path' => $basePrefix . '/reset-password',
                'feature' => 'no_auth_required/ANY|Reset password|DictV1AuthenticationPasswordResetController|params:email(string,required),token(string,required),password(string,required)|response:message'
            ],
            [
                'path' => $basePrefix . '/verify-email/{id}/{hash}',
                'feature' => 'auth_required:user/ANY|Verify email address|DictV1AuthenticationEmailVerificationController|route_params:id(int,required),hash(string,required)|response:message'
            ],
            [
                'path' => $basePrefix . '/email/verification-notification',
                'feature' => 'auth_required:user/ANY|Resend email verification|DictV1AuthenticationEmailVerificationNotificationController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:message'
            ],

            // Word Query routes (from DictV1Wordqurey.php) - Resource Access Auth
            [
                'path' => $basePrefix . '/word_exists',
                'feature' => 'auth_required:resource/ANY|Check if word exists|DictV1WordQueryController|headers:Resource-Access-Key(string,required)|params:word(string,required)|response:exists(boolean)'
            ],
            [
                'path' => $basePrefix . '/qurey_word',
                'feature' => 'auth_required:resource/ANY|Query single word with static resources|DictV1WordQueryController|headers:Resource-Access-Key(string,required)|params:word(string,required)|response:word,translation,definition,pronunciation,audio_url,image_urls'
            ],
            [
                'path' => $basePrefix . '/word/{word}',
                'feature' => 'auth_required:resource/GET|Get word details with static resources|DictV1WordQueryController|headers:Resource-Access-Key(string,required)|route_params:word(string,required)|response:word,translation,definition,pronunciation,examples,audio_url,image_urls'
            ],
            [
                'path' => $basePrefix . '/qurey_words',
                'feature' => 'auth_required:resource/ANY|Query multiple words with static resources|DictV1WordQueryController|headers:Resource-Access-Key(string,required)|params:words(array,required)|response:words(array)'
            ],

            // Dictionary Management (from DictV1Dict.php)
            [
                'path' => $basePrefix . '/create_group', 
                'feature' => 'auth_required/ANY|Create new word group|DictV1WordGroupCreationController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_name(string,required),description(string,optional)|response:group_id,group_name'
            ],
            [
                'path' => $basePrefix . '/query_all_groups', 
                'feature' => 'auth_required/ANY|Get all word groups|DictV1WordGroupQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:groups(array)'
            ],
            [
                'path' => $basePrefix . '/query_group_by_name', 
                'feature' => 'auth_required/ANY|Query group by name|DictV1WordGroupQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_name(string,required)|response:group'
            ],
            [
                'path' => $basePrefix . '/query_group_by_gid', 
                'feature' => 'auth_required/ANY|Query group by ID|DictV1WordGroupQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_id(int,required)|response:group'
            ],
            [
                'path' => $basePrefix . '/query_gwords', 
                'feature' => 'auth_required/ANY|Get group words|DictV1WordGroupQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_id(int,required)|response:words(array)'
            ],
            [
                'path' => $basePrefix . '/query_gcontent', 
                'feature' => 'auth_required/ANY|Get group content|DictV1WordGroupQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_id(int,required)|response:content'
            ],
            [
                'path' => $basePrefix . '/query_gfrequency', 
                'feature' => 'auth_required/ANY|Get group frequency|DictV1WordGroupQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_id(int,required)|response:frequency_data'
            ],
            [
                'path' => $basePrefix . '/delete_group_by_name', 
                'feature' => 'auth_required/ANY|Delete group by name|DictV1WordGroupDeletionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_name(string,required)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/delete_group_by_gid', 
                'feature' => 'auth_required/ANY|Delete group by ID|DictV1WordGroupDeletionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_id(int,required)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/add_dictionary', 
                'feature' => 'auth_required:client.token/ANY|Add dictionary entries|DictV1DictionaryManagementController|headers:{{' . CommonGvar::ClientToken . '}}(string,required)|params:words(array,required)|response:added_count,failed_count'
            ],
            [
                'path' => $basePrefix . '/find_non_existing_dictionary', 
                'feature' => 'auth_required:client.token/ANY|Find non-existing dictionary entries|DictV1DictionaryQueryController|headers:{{' . CommonGvar::ClientToken . '}}(string,required)|params:words(array,required)|response:non_existing_words(array)'
            ],

            // Personal Dictionary (from DictV1PersonDict.php)
            [
                'path' => $basePrefix . '/create_personal_dictionary', 
                'feature' => 'auth_required/ANY|Create personal dictionary entry|DictV1PersonalDictionaryCreationController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:word(string,required),translation(string,required),definition(string,optional),notes(string,optional)|response:entry_id'
            ],
            [
                'path' => $basePrefix . '/query_personal_dictionary', 
                'feature' => 'auth_required/ANY|Query personal dictionary|DictV1PersonalDictionaryQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:page(int,optional),limit(int,optional),search(string,optional)|response:entries(array),pagination'
            ],
            [
                'path' => $basePrefix . '/query_personal_dictionary_by_words', 
                'feature' => 'auth_required/ANY|Query personal dictionary by words|DictV1PersonalDictionaryQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:words(array,required)|response:entries(array)'
            ],
            [
                'path' => $basePrefix . '/delete_personal_dictionary_by_id', 
                'feature' => 'auth_required/ANY|Delete personal dictionary by ID|DictV1PersonalDictionaryDeletionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:entry_id(int,required)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/delete_personal_all_dictionary', 
                'feature' => 'auth_required/ANY|Delete all personal dictionary|DictV1PersonalDictionaryDeletionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:success(boolean)'
            ],

            // Word Operations (from DictV1WordOperate.php)
            [
                'path' => $basePrefix . '/up_learned', 
                'feature' => 'auth_required/ANY|Mark word as learned|DictV1WordLearningStatusController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:word(string,required),learned(boolean,required)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/up_read', 
                'feature' => 'auth_required/ANY|Mark word as read|DictV1WordReadingStatusController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:word(string,required),read(boolean,required)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/up_weight', 
                'feature' => 'auth_required/ANY|Update word weight|DictV1WordWeightController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:word(string,required),weight(int,required)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/up_reviewed', 
                'feature' => 'auth_required/ANY|Mark word as reviewed|DictV1WordReviewStatusController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:word(string,required),reviewed(boolean,required)|response:success(boolean)'
            ],

            // Manager routes (from DictV1Manager.php)
            [
                'path' => $basePrefix . '/manager/get_all_groups_by_manager', 
                'feature' => 'auth_required/ANY|Get all groups (manager access)|DictV1WordGroupManagementController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:groups(array)'
            ],

            // Polymerization routes (from DictV1Ploymerization.php)
            [
                'path' => $basePrefix . '/create_group_and_fetch_list', 
                'feature' => 'auth_required/ANY|Create group and fetch list|DictV1GroupPolymerizationController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:group_name(string,required),description(string,optional)|response:new_group,all_groups(array)'
            ],

            // System routes (from DictV1System.php)
            [
                'path' => $basePrefix . '/system/initialize',
                'feature' => 'no_auth_required/POST|Initialize dictionary system|DictV1SystemInitializationController|params:force_reinit(boolean,optional)|response:status,message,progress'
            ],
            [
                'path' => $basePrefix . '/system/initialization-status',
                'feature' => 'no_auth_required/GET|Get initialization status|DictV1SystemInitializationController|response:status,progress,database_status,audio_status,images_status'
            ],
            [
                'path' => $basePrefix . '/system/process-vocabulary',
                'feature' => 'no_auth_required/POST|Process vocabulary only|DictV1SystemInitializationController|params:force_reprocess(boolean,optional)|response:status,message'
            ],
            [
                'path' => $basePrefix . '/system/vocabulary-status',
                'feature' => 'no_auth_required/GET|Get vocabulary processing status|DictV1SystemInitializationController|response:status,vocabulary_count'
            ],
            [
                'path' => $basePrefix . '/system/reinitialize',
                'feature' => 'auth_required:resource/POST|Reinitialize system|DictV1SystemInitializationController|headers:Resource-Access-Key(string,required)|response:status'
            ],

            // Pre-validation routes (from DictV1PreValidation.php)
            [
                'path' => $basePrefix . '/system/pre-validation',
                'feature' => 'no_auth_required/GET|Get comprehensive pre-validation status|DictV1PreValidationController|response:overall_status,can_serve_resources,checks,message'
            ],
            [
                'path' => $basePrefix . '/system/pre-validation/{component}',
                'feature' => 'no_auth_required/GET|Check specific component status|DictV1PreValidationController|route_params:component(string,required,audio)|response:component,result,checked_at'
            ],
            [
                'path' => $basePrefix . '/word/{word}/enhanced', 
                'feature' => 'auth_required/GET|POST|Enhanced word query with audio and images|DictV1WordQueryController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|route_params:word(string,required)|response:word,translation,definition,audio_url,images(array),pronunciation'
            ],
            [
                'path' => $basePrefix . '/untranslated', 
                'feature' => 'auth_required/GET|Get words missing translations, audio, or images|DictV1UntranslatedWordsController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:type(string,optional),limit(int,optional)|response:words(array)'
            ],
            [
                'path' => $basePrefix . '/untranslated/priority', 
                'feature' => 'auth_required/GET|Get priority words for completion|DictV1UntranslatedWordsController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|params:limit(int,optional)|response:words(array),priorities'
            ],
            [
                'path' => $basePrefix . '/word/{word}/translation', 
                'feature' => 'auth_required/POST|Submit translation for a word|DictV1WordDataSubmissionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|route_params:word(string,required)|params:translation(string,required),definition(string,optional)|response:success(boolean)'
            ],
            [
                'path' => $basePrefix . '/word/{word}/audio', 
                'feature' => 'auth_required/POST|Submit audio file for a word|DictV1WordDataSubmissionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|route_params:word(string,required)|params:audio_file(file,required)|response:success(boolean),audio_url'
            ],
            [
                'path' => $basePrefix . '/word/{word}/images', 
                'feature' => 'auth_required/POST|Submit image files for a word|DictV1WordDataSubmissionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|route_params:word(string,required)|params:image_files(array,required)|response:success(boolean),image_urls(array)'
            ],
            [
                'path' => $basePrefix . '/word/{word}/complete', 
                'feature' => 'auth_required/POST|Submit complete word data|DictV1WordDataSubmissionController|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|route_params:word(string,required)|params:translation(string,required),definition(string,optional),audio_file(file,optional),image_files(array,optional)|response:success(boolean),word_data'
            ],

            // Test/Global Variables route (from DictV1Test.php)
            [
                'path' => $basePrefix . '/get_gvars', 
                'feature' => 'auth_required/ANY|Get global variables|GlobalVar|headers:{{' . CommonGvar::AuthUserToken . '}}(string,required)|response:variables(object)'
            ]
        ];
    }

    /**
     * Get supported headers using global constants
     *
     * @return array
     */
    private static function getSupportedHeaders(): array
    {
        return [
            'Resource-Access-Key' => 'Resource access key for static content authentication (production)',
            CommonGvar::AuthDebugToken => 'Debug token for development mode resource access',
            CommonGvar::AuthUserToken => 'User authentication token for user-specific features',
            CommonGvar::AuthUsername => 'Username for user authentication',
            CommonGvar::AuthPassword => 'Password for user authentication',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ];
    }


    /**
     * Get details method for compatibility with Index.php scanner
     *
     * @return array
     */
    public function getDetails(): array
    {
        return self::getApiInfo();
    }
}