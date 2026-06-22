<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Application Registry
    |--------------------------------------------------------------------------
    |
    | Unified configuration center for all applications.
    | Defines app keys, table prefixes, database connections, and versions.
    |
    | Structure:
    |   'app_key' => [
    |       'name' => 'App Display Name',
    |       'table_prefix' => 'app_qy_v1',
    |       'connection' => 'appqyv1',
    |       'current_version' => 'v1',
    |       'versions' => ['v1' => 'app_qy_v1', 'v2' => 'app_qy_v2'], // Optional: for versioning
    |   ]
    |
    */

    'appqyv1' => [
        'name' => 'AppQyV1',
        'table_prefix' => 'app_qy_v1',
        'connection' => 'appqyv1',
        'current_version' => 'v1',
    ],

    'mcpv1' => [
        'name' => 'McpV1',
        'table_prefix' => 'mcp_v1',
        'connection' => 'mcpv1',
        'current_version' => 'v1',
    ],

    'servermanagerv1' => [
        'name' => 'ServerManagerV1',
        'table_prefix' => 'server_manager_v1',
        'connection' => 'servermanagerv1',
        'current_version' => 'v1',
    ],

    'achatv1' => [
        'name' => 'AChatV1',
        'table_prefix' => 'achat_v1',
        'connection' => 'achatv1',
        'current_version' => 'v1',
    ],

    'codemartv1' => [
        'name' => 'CodeMartV1',
        'table_prefix' => 'codemart_v1',
        'connection' => 'codemartv1',
        'current_version' => 'v1',
    ],

    'ittoolsv1' => [
        'name' => 'ItToolsV1',
        'table_prefix' => 'ittools_v1',
        'connection' => 'ittoolsv1',
        'current_version' => 'v1',
    ],

    'pddtoolv1' => [
        'name' => 'PddToolV1',
        'table_prefix' => 'pdd_tool_v1',
        'connection' => 'pddtoolv1',
        'current_version' => 'v1',
    ],
];

