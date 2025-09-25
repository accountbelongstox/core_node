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

if ($argc < 2) {
    die("Error: Please provide the path to php.ini file.\nExample: php configure_php_ini.php D:\\path\\to\\php.ini\n");
}
$iniPath = $argv[1];
if (!file_exists($iniPath)) {
    die("Error: Configuration file '$iniPath' not found.\nExample path: D:\\.dev_win10\\php-84\\php.ini\n");
}
$phpDir = dirname($iniPath);
$extDir = $phpDir . '\\ext';
$iniContent = file_get_contents($iniPath);
if ($iniContent === false) {
    die("Error: Failed to read configuration file\n");
}
$configReplacements = [
    'upload_max_filesize' => '10240M',
    'post_max_size' => '10240M',
    'display_errors' => 'On',
    'max_execution_time' => '300',
    'max_input_time' => '300',
    'memory_limit' => '512M',
    'max_input_vars' => '10000',
    'date.timezone' => 'UTC',
    'error_log' => '"error.log"',
    'file_uploads' => 'On'
];
function updateConfigValue($iniContent, $key, $value) {
    $pattern = '/^\s*' . preg_quote($key, '/') . '\s*=\s*(.*?)(\s*(;.*)?)$/m';
    if (preg_match($pattern, $iniContent, $matches)) {
        return preg_replace($pattern, "$key = $value$2", $iniContent);
    } else {
        return $iniContent . "\n$key = $value";
    }
}
function findMatchingDll($name) {
    global $extDir;
    $dllFiles = glob($extDir . '\\*.dll');
    $normalizedName = strtolower($name);
    $patterns = [
        "php_{$name}.dll",
        "php_{$name}3.dll",
        "php_{$name}_nts.dll",
        "php_{$name}_ts.dll",
        "php_{$name}.dll",
        "php_{$name}3.dll",
        "php_{$name}_nts.dll",
        "php_{$name}_ts.dll"
    ];
    foreach ($patterns as $pattern) {
        $dllPath = $extDir . '\\' . $pattern;
        if (file_exists($dllPath)) {
            return $pattern;
        }
    }
    foreach ($dllFiles as $dll) {
        $dllName = strtolower(basename($dll));
        $dllBase = str_replace(['php_', '.dll', '_nts', '_ts'], '', $dllName);
        if ($dllBase === $normalizedName) {
            return basename($dll);
        }
        if (preg_match('/^' . preg_quote($normalizedName, '/') . '\d*$/', $dllBase)) {
            return basename($dll);
        }
        $variations = [
            $normalizedName,
            str_replace('3', '', $normalizedName),
            str_replace('_', '', $normalizedName)
        ];
        foreach ($variations as $variation) {
            if ($dllBase === $variation) {
                return basename($dll);
            }
        }
    }
    return null;
}

function checkExtensionDll($name) {
    global $extDir;
    $matchingDll = findMatchingDll($name);
    if ($matchingDll === null) {
        return false;
    }
    $dllPath = $extDir . '\\' . $matchingDll;
    if (!file_exists($dllPath)) {
        return false;
    }  
    $extensionName = str_replace(['php_', '.dll', '_nts', '_ts'], '', $matchingDll);
    if (!extension_loaded($extensionName)) {
        @dl($dllPath);
    }
    return extension_loaded($extensionName);
}
function isExtensionLoaded($name) {
    return extension_loaded($name);
}
function enableExtension($iniContent, $name) {
    $matchingDll = findMatchingDll($name);
    if ($matchingDll === null) {
        return $iniContent;
    }
    $pattern = '/^\s*(;)?\s*extension\s*=\s*' . preg_quote($matchingDll, '/') . '\s*$/m';
    if (preg_match($pattern, $iniContent, $matches)) {
        if (isset($matches[1]) && $matches[1] === ';') {
            return preg_replace($pattern, "extension=$matchingDll", $iniContent);
        }
        return $iniContent;
    }
    return $iniContent . "\nextension=$matchingDll";
}
function verifyExtension($iniContent, $name) {
    global $extDir;
    static $dllsListed = false; 
    if (!isExtensionLoaded($name)) {
        $matchingDll = findMatchingDll($name);
        if ($matchingDll === null) {
            echo "Warning: Extension $name DLL not found in $extDir\n";
            if (!$dllsListed) {
                echo "\nAvailable extensions in $extDir:\n";
                $dllFiles = glob($extDir . '\\*.dll');
                if (!empty($dllFiles)) {
                    foreach ($dllFiles as $dll) {
                        echo "  - " . basename($dll) . "\n";
                    }
                } else {
                    echo "  No DLL files found in $extDir\n";
                }
                $dllsListed = true;
            }
            return [$iniContent, false];
        }
        $newIniContent = enableExtension($iniContent, $name);
        $pattern = '/^\s*extension\s*=\s*' . preg_quote($matchingDll, '/') . '\s*$/m';
        if (preg_match($pattern, $newIniContent)) {
            echo "Success: Extension $name is configured in php.ini\n";
            return [$newIniContent, true];
        } else {
            echo "Error: Failed to configure extension $name in php.ini\n";
            return [$iniContent, false];
        }
    }
    echo "Success: Extension $name is already loaded\n";
    return [$iniContent, true];
}

// Add ANSI color codes for better output
define('COLOR_RESET', "\033[0m");
define('COLOR_GREEN', "\033[32m");
define('COLOR_YELLOW', "\033[33m");
define('COLOR_RED', "\033[31m");
define('COLOR_CYAN', "\033[36m");
define('COLOR_BLUE', "\033[34m");
define('COLOR_MAGENTA', "\033[35m");

// Function to print section headers
function printSection($title) {
    echo "\n" . COLOR_CYAN . str_repeat("=", 80) . COLOR_RESET . "\n";
    echo COLOR_BLUE . str_pad("  " . $title . "  ", 80, " ", STR_PAD_BOTH) . COLOR_RESET . "\n";
    echo COLOR_CYAN . str_repeat("=", 80) . COLOR_RESET . "\n\n";
}

// Function to print status messages
function printStatus($message, $type = 'info') {
    $prefix = '';
    switch ($type) {
        case 'success':
            $prefix = COLOR_GREEN . "✓ " . COLOR_RESET;
            break;
        case 'warning':
            $prefix = COLOR_YELLOW . "⚠ " . COLOR_RESET;
            break;
        case 'error':
            $prefix = COLOR_RED . "✗ " . COLOR_RESET;
            break;
        default:
            $prefix = COLOR_CYAN . "• " . COLOR_RESET;
    }
    echo $prefix . $message . "\n";
}

// Function to print configuration updates
function printConfigUpdate($key, $value) {
    echo COLOR_MAGENTA . "  " . str_pad($key, 20) . COLOR_RESET . " = " . COLOR_GREEN . $value . COLOR_RESET . "\n";
}

// Function to print extension status
function printExtensionStatus($name, $status, $details = '') {
    $statusText = $status ? COLOR_GREEN . "Loaded" : COLOR_YELLOW . "Not Found";
    echo COLOR_CYAN . "  " . str_pad($name, 15) . COLOR_RESET . " : " . $statusText . COLOR_RESET;
    if ($details) {
        echo " - " . $details;
    }
    echo "\n";
}

// Update the main output sections
printSection("PHP Configuration Update");
foreach ($configReplacements as $key => $value) {
    $iniContent = updateConfigValue($iniContent, $key, $value);
    printConfigUpdate($key, $value);
}

printSection("PHP Extensions Status");
$opensslEnabled = false;

$extensions = [
    'openssl', 
    'fileinfo',     
    'redis',    
    'sqlite3',  
    'exif',   
    'swoole',
    'bz2',   
    'yaml',  
];

foreach ($extensions as $ext) {
    list($iniContent, $success) = verifyExtension($iniContent, $ext);
    if ($ext === 'openssl' && $success) {
        $opensslEnabled = true;
    }
}

// Save updated configuration
if (file_put_contents($iniPath, $iniContent) === false) {
    printStatus("Failed to save configuration file", 'error');
    exit(1);
}

// Verify OpenSSL specifically for Composer
if ($opensslEnabled) {
    printSection("OpenSSL Configuration");
    printConfigUpdate("Version", OPENSSL_VERSION_TEXT);
    printConfigUpdate("Version Number", OPENSSL_VERSION_NUMBER);
    
    if (extension_loaded('curl')) {
        printStatus("Attempting SSL connection test using cURL...", 'info');
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://www.bing.com");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        $curl_exec_result = curl_exec($ch);
        $curl_error = curl_error($ch);
        curl_close($ch);

        if ($curl_exec_result !== false) {
            printStatus("SSL connection test successful", 'success');
            } else {
            printStatus("SSL connection test failed: " . $curl_error, 'warning');
            printStatus("This might indicate issues with CA certificates or network connectivity.", 'warning');
        }
    } else {
        printStatus("cURL extension is not loaded in the current PHP process.", 'warning');
        printStatus("Skipping SSL connection test. Please ensure 'extension=curl' is enabled in php.ini and PHP is restarted if needed.", 'warning');
    }
} else {
    printStatus("OpenSSL extension is required for Composer but could not be enabled", 'error');
    exit(1);
}

printSection("Configuration Complete");
printStatus("PHP configuration has been successfully updated", 'success');
?>