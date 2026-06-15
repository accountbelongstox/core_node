<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


use Illuminate\Support\Str;
use App\Support\CoreNodeSecrets;

// ---------------------------------------------------------------------------
// Database topology: PostgreSQL ONLY, identical on Linux and Windows.
// ---------------------------------------------------------------------------
// This application runs on PostgreSQL on EVERY platform: one dedicated database
// per app on a single localhost server (on Windows the SAME WSL PostgreSQL is
// reached through WSL2 NAT localhost forwarding, so there is no second server
// and no per-OS difference). The driver, host, port, username and per-app
// database name are FIXED IN CODE here; the password is read from the
// shell-generated global-var secret store via App\Support\CoreNodeSecrets
// (written / rotated by start.sh / start.ps1 -> 46_install_postgresql.sh).
//
// NOTHING about the active database connections is read from .env -- not the
// driver, host, port, username, database, nor the password. This is deliberate:
// a copied or committed .env must not be able to repoint the app at another
// server or leak the password, and the behaviour must be byte-for-byte identical
// on Linux and Windows. Any DB_* / POLY_DB_DRIVER line in .env is ignored here by
// design. start.sh / start.ps1 are responsible for ensuring the localhost-only
// PostgreSQL server is up and the password is in the store before the app serves.
$pgHost = '127.0.0.1';
$pgPort = '5432';
$pgUser = 'postgres';
$pgPassword = CoreNodeSecrets::get('POSTGRES_PASSWORD', '');

// Build one PostgreSQL per-app connection. Topology mirrors the former
// one-SQLite-file-per-app isolation: each app gets its own database (and thus
// its own migrations table). Credentials are the fixed-in-code values above.
$polyConnection = function (string $pgDatabase) use ($pgHost, $pgPort, $pgUser, $pgPassword) {
    return [
        'driver' => 'pgsql',
        'host' => $pgHost,
        'port' => $pgPort,
        'database' => $pgDatabase,
        'username' => $pgUser,
        'password' => $pgPassword,
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => 'public',
        'sslmode' => 'prefer',
    ];
};

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    |
    | Here you may specify which of the database connections below you wish
    | to use as your default connection for database operations. This is
    | the connection which will be utilized unless another connection
    | is explicitly specified when you execute a query / statement.
    |
    */

    // Fixed in code (not from .env). 'main' is the main application database
    // (PostgreSQL 'core_node_main'). The legacy alias 'sqlite' below points at
    // the same database so old references keep working, but nothing should be
    // named after a driver anymore -- this app is PostgreSQL-only.
    'default' => 'main',

    /*
    |--------------------------------------------------------------------------
    | Database Connections
    |--------------------------------------------------------------------------
    |
    | Below are all of the database connections defined for your application.
    | An example configuration is provided for each database system which
    | is supported by Laravel. You're free to add / remove connections.
    |
    */

    'connections' => [

        // Per-app PostgreSQL connections. Driver and credentials are fixed in
        // code (above); the per-app database name is the only argument.
        'main' => $polyConnection('core_node_main'),

        // DEPRECATED alias: 'sqlite' was the historical default-connection NAME
        // (never a driver statement since the PG migration). Kept so old
        // migrations (`protected $connection = 'sqlite'`) and stragglers still
        // resolve to the SAME PostgreSQL database; do not use in new code.
        'sqlite' => $polyConnection('core_node_main'),

        'appqyv1' => $polyConnection('app_qy_v1_database'),

        'servermanagerv1' => $polyConnection('server_manager_v1_database'),

        'achatv1' => $polyConnection('achat_v1_database'),

        'codemartv1' => $polyConnection('code_mart_v1_database'),

        'mcpv1' => $polyConnection('mcp_v1_database'),

        'ittoolsv1' => $polyConnection('it_tools_v1_database'),

        // NOTE: the mysql / mariadb / sqlsrv entries below are unused Laravel
        // framework stubs kept only for structural completeness. This application
        // never instantiates them (it runs exclusively on the PostgreSQL
        // connections above). They are intentionally left as the framework
        // defaults; the active database does not read .env.
        'mysql' => [
            'driver' => 'mysql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                \Pdo\Mysql::ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'mariadb' => [
            'driver' => 'mariadb',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                \Pdo\Mysql::ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        // Generic single PostgreSQL connection. Same env-free policy as the
        // per-app connections: host/port/user fixed in code, password from the
        // secret store, pointing at the main 'core_node_main' database.
        'pgsql' => [
            'driver' => 'pgsql',
            'host' => $pgHost,
            'port' => $pgPort,
            'database' => 'core_node_main',
            'username' => $pgUser,
            'password' => $pgPassword,
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ],

        'sqlsrv' => [
            'driver' => 'sqlsrv',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', 'localhost'),
            'port' => env('DB_PORT', '1433'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            // 'encrypt' => env('DB_ENCRYPT', 'yes'),
            // 'trust_server_certificate' => env('DB_TRUST_SERVER_CERTIFICATE', 'false'),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Migration Repository Table
    |--------------------------------------------------------------------------
    |
    | This table keeps track of all the migrations that have already run for
    | your application. Using this information, we can determine which of
    | the migrations on disk haven't actually been run on the database.
    |
    */

    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Redis Databases
    |--------------------------------------------------------------------------
    |
    | Redis is an open source, fast, and advanced key-value store that also
    | provides a richer body of commands than a typical key-value system
    | such as Memcached. You may define your connection settings here.
    |
    */

    'redis' => [

        'client' => env('REDIS_CLIENT', 'phpredis'),

        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_database_'),
            'persistent' => env('REDIS_PERSISTENT', false),
        ],

        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],

        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],

    ],

];
