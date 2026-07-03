<?php
// ### AI SPECIAL ATTENTION RULES START ###
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Declare all variables at the beginning of the file.
// 7. Do not modify these rules.
// ### AI SPECIAL ATTENTION RULES END ###

// Lightweight php.ini dependency fixer — called from start.ps1 every startup.
// Comments out extensions that PHP auto-loads as runtime dependencies of another extension,
// preventing "Module X already loaded" warnings on every PHP subprocess spawn.
// Idempotent: already-commented lines are not touched.

// All variables at top
$phpIniPath = null;
$iniContent = null;
$changed = false;

// Map: extension => parent_extension_that_auto_loads_it
// Add more entries here when a new auto-dependency is discovered.
$depMap = [
    'pgsql' => 'pdo_pgsql', // pdo_pgsql internally loads pgsql; both explicit = warning
];

$phpIniPath = php_ini_loaded_file();
if (!$phpIniPath || !file_exists($phpIniPath)) {
    echo "fix_php_ini_deps: no php.ini loaded, nothing to do.\n";
    exit(0);
}

$iniContent = file_get_contents($phpIniPath);
if ($iniContent === false) {
    echo "fix_php_ini_deps: cannot read $phpIniPath\n";
    exit(1);
}

foreach ($depMap as $dep => $parent) {
    if (!extension_loaded($parent)) {
        continue;
    }
    // Match active (non-commented) extension lines for $dep in any Windows php.ini form:
    //   extension=php_pgsql.dll  extension=pgsql.dll  extension=pgsql
    $pattern = '/^\s*extension\s*=\s*(?:php_)?' . preg_quote($dep, '/') . '(?:\.dll)?\s*$/im';
    $new = preg_replace_callback($pattern, function ($m) use ($dep, $parent) {
        return '; [auto-dep of ' . $parent . ', disabled by fix_php_ini_deps.php] ' . ltrim($m[0]);
    }, $iniContent);
    if ($new !== $iniContent) {
        $iniContent = $new;
        $changed = true;
        echo "fix_php_ini_deps: disabled $dep (auto-loaded by $parent)\n";
    }
}

if ($changed) {
    if (file_put_contents($phpIniPath, $iniContent) === false) {
        echo "fix_php_ini_deps: ERROR: failed to write $phpIniPath\n";
        exit(1);
    }
    echo "fix_php_ini_deps: saved $phpIniPath\n";
} else {
    echo "fix_php_ini_deps: $phpIniPath already clean\n";
}
exit(0);
