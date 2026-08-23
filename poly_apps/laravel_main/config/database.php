<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


use App\Constants\LaravelConfig;
use App\Support\ServiceContract;

// ---------------------------------------------------------------------------
// Database topology: PostgreSQL ONLY, identical on Linux and Windows.
// ---------------------------------------------------------------------------
// This application runs on PostgreSQL on EVERY platform: one dedicated database
// per app on a single localhost server (on Windows the SAME WSL PostgreSQL is
// reached through WSL2 NAT localhost forwarding, so there is no second server
// and no per-OS difference). The driver, host, port, username and per-app
// database name are fixed in code. RuntimeConfigurationServiceProvider injects
// the Shell-owned password after configuration loading.
//
// NOTHING about the active database connections is read from .env -- not the
// driver, host, port, username, database, nor the password. This is deliberate:
// a copied or committed .env must not be able to repoint the app at another
// server or leak the password, and the behaviour must be byte-for-byte identical
// on Linux and Windows. Any DB_* / POLY_DB_DRIVER line in .env is ignored here by
// design. start.sh / start.ps1 are responsible for ensuring the localhost-only
// PostgreSQL server is up and the password is in the store before the app serves.
$connections = [];

// Build one PostgreSQL per-app connection. Topology mirrors the former
// one-SQLite-file-per-app isolation: each app gets its own database (and thus
// its own migrations table). Credentials are the fixed-in-code values above.
$polyConnection = static function (string $pgDatabase): array {
    return [
        'driver' => 'pgsql',
        'host' => ServiceContract::host('loopback'),
        'port' => ServiceContract::port('postgresql'),
        'database' => $pgDatabase,
        'username' => LaravelConfig::DATABASE_USERNAME,
        'password' => null,
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => LaravelConfig::DATABASE_SEARCH_PATH,
        'sslmode' => LaravelConfig::DATABASE_SSL_MODE,
    ];
};

foreach (LaravelConfig::DATABASES as $connectionName => $databaseName) {
    $connections[$connectionName] = $polyConnection($databaseName);
}

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

    // Fixed in code. 'main' is the PostgreSQL main application database.
    'default' => LaravelConfig::DATABASE_CONNECTION,

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

    'connections' => $connections,

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

        'client' => LaravelConfig::REDIS_CLIENT,

        'options' => [
            'cluster' => 'redis',
            'prefix' => LaravelConfig::REDIS_PREFIX,
            'persistent' => false,
        ],

        'default' => [
            'url' => null,
            'host' => ServiceContract::host('loopback'),
            'username' => null,
            'password' => null,
            'port' => ServiceContract::port('redis'),
            'database' => LaravelConfig::REDIS_DATABASE,
            'max_retries' => LaravelConfig::REDIS_MAX_RETRIES,
            'backoff_algorithm' => LaravelConfig::REDIS_BACKOFF_ALGORITHM,
            'backoff_base' => LaravelConfig::REDIS_BACKOFF_BASE,
            'backoff_cap' => LaravelConfig::REDIS_BACKOFF_CAP,
        ],

        'cache' => [
            'url' => null,
            'host' => ServiceContract::host('loopback'),
            'username' => null,
            'password' => null,
            'port' => ServiceContract::port('redis'),
            'database' => LaravelConfig::REDIS_CACHE_DATABASE,
            'max_retries' => LaravelConfig::REDIS_MAX_RETRIES,
            'backoff_algorithm' => LaravelConfig::REDIS_BACKOFF_ALGORITHM,
            'backoff_base' => LaravelConfig::REDIS_BACKOFF_BASE,
            'backoff_cap' => LaravelConfig::REDIS_BACKOFF_CAP,
        ],

    ],

];
