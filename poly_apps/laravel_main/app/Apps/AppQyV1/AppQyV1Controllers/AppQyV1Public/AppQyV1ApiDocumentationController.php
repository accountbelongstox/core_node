<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;
use App\Http\Controllers\Controller;
use App\Http\Common\CommonGvar as Gvar;
use App\Traits\ApiResponse;
class AppQyV1ApiDocumentationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

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
