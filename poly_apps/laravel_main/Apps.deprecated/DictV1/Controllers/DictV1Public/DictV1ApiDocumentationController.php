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


namespace App\Apps\DictV1\Controllers\DictV1Public;
use Illuminate\Routing\Controller as BaseController;
use App\Apps\DictV1\DictV1Gvar\Gvar;
class DictV1ApiDocumentationController extends BaseController
{
    public static function apiDocs()
    {
        $apiVersion = 'v1';
        $apiName = 'dict';
        $base_url = url('/api');
        $apiPrefix = $base_url . '/' . $apiName . '/' . $apiVersion;
        $normalPrefix = $base_url;
        $supportedHeaders = [
            Gvar::ClientToken,
            Gvar::AuthUsername,
            Gvar::AuthPassword,
            Gvar::AuthUserToken,
            Gvar::AuthDebugToken,
        ];
        $apiDocumentation = [
            [
                'path' => $apiPrefix . '/register',
                'feature' => 'auth_required/POST',
            ],
            [
                'path' => $apiPrefix . '/login',
                'feature' => 'auth_required/POST',
                
            ],
            [
                'path' => $apiPrefix . '/logout',
                'feature' => 'auth_required/POST',

            ],
            [
                'path' => $apiPrefix . '/user',
                'feature' => 'auth_required/GET',

            ],
            [
                'path' => $apiPrefix . '/forgot-password',
                'feature' => 'auth_required/POST',
                
            ],
            [
                'path' => $apiPrefix . '/reset-password',
                'feature' => 'auth_required/POST',
                
            ],
            [
                'path' => $apiPrefix . '/verify-email/{id}/{hash}',
                'feature' => 'auth_required/GET',

            ],
            [
                'path' => $apiPrefix . '/email/verification-notification',
                'feature' => 'auth_required/POST',

            ],
            [
                'path' => $apiPrefix . '/get_system_status',
                'feature' => 'auth_required/ANY',
                
            ],
            [
                'path' => $apiPrefix . '/store_session',
                'feature' => 'auth_required/POST',
                
            ],
            [
                'path' => $apiPrefix . '/retrieve_session',
                'feature' => 'auth_required/GET',
                
            ],
            [
                'path' => $apiPrefix . '/broadcast_session',
                'feature' => 'auth_required/POST',
                
            ],
            [
                'path' => $apiPrefix . '/word_exists',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/qurey_word',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/word/{word}',
                'feature' => 'auth_required/GET',
                
            ],
            [
                'path' => $apiPrefix . '/qurey_words',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/add_dictionary',
                'feature' => 'auth_required:client.token/ANY',
            ],
            [
                'path' => $apiPrefix . '/find_non_existing_dictionary',
                'feature' => 'auth_required:client.token/ANY',
            ],
            [
                'path' => $apiPrefix . '/create_group',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_all_groups',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_group_by_name',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_group_by_gid',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_gwords',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_gcontent',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_gfrequency',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/delete_group_by_name',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/delete_group_by_gid',
                'feature' => 'auth_required/POST',

            ],
            [
                'path' => $apiPrefix . '/create_personal_dictionary',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_personal_dictionary',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/query_personal_dictionary_by_words',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/delete_personal_dictionary_by_id',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/delete_personal_all_dictionary',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/up_learned',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/up_read',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/up_weight',
                'feature' => 'auth_required/ANY',

            ],
            [
                'path' => $apiPrefix . '/up_reviewed',
                'feature' => 'auth_required/ANY',

            ],
            // Manager
            [
                'path' => $apiPrefix . '/manager/get_all_groups_by_manager',
                'feature' => 'auth_required/ANY',

            ],
            // Ploymerization
            [
                'path' => $apiPrefix . '/create_group_and_fetch_list',
                'feature' => 'auth_required/ANY',

            ],
            // Test
            [
                'path' => $normalPrefix . '/get_gvars',
                'feature' => 'auth_required/ANY',

            ]
        ];


        return [
            'apiVersion' => $apiVersion,
            'supportedHeaders' => $supportedHeaders,
            'apis' => $apiDocumentation,
        ];
    }
}