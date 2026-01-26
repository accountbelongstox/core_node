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

// All variable definitions at the beginning of the file
$phpExePath = null;
$iniPath = null;
$phpDir = null;
$extDir = null;
$inputPath = null;
$iniContent = '';
$phpIniDev = '';
$phpIniProd = '';
$duplicatesRemoved = 0;
$opensslEnabled = false;
$saveSuccess = false;

// Configuration replacements for Laravel
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
    'file_uploads' => 'On',
    'disable_functions' => '',
    'opcache.enable' => '1',
    'opcache.memory_consumption' => '256',
    'openssl.cafile' => '',
    'curl.cainfo' => ''
];

// All known extensions for duplicate cleaning
$allKnownExtensions = [
    'intl', 'gd', 'zip', 'fileinfo', 'pdo_mysql', 'pdo_sqlite', 
    'mbstring', 'curl', 'openssl', 'redis', 'sqlite3', 'exif', 
    'swoole', 'bz2', 'yaml', 'mysqli', 'pdo', 'xml', 'json',
    'bcmath', 'readline', 'soap', 'sockets', 'tokenizer'
];

// Extensions to verify and enable for Laravel
$extensions = [
    'openssl',
    'fileinfo',
    'curl',
    'mbstring',
    'xml',
    'zip',
    'gd',
    'intl',
    'bcmath',
    'pdo_mysql',
    'mysqli',
    'redis',
    'sqlite3',
    'pdo_sqlite',
    'exif',
    'swoole',
    'bz2',
    'yaml',
    'tokenizer'
];

// ANSI color codes for better output
define('COLOR_RESET', "\033[0m");
define('COLOR_GREEN', "\033[32m");
define('COLOR_YELLOW', "\033[33m");
define('COLOR_RED', "\033[31m");
define('COLOR_CYAN', "\033[36m");
define('COLOR_BLUE', "\033[34m");
define('COLOR_MAGENTA', "\033[35m");

if ($argc < 2) {
    die("Error: Please provide PHP executable path.\nExample: php configure_php_ini.php D:\\path\\to\\php.exe\n");
}

$inputPath = $argv[1];
if (!file_exists($inputPath)) {
    die("Error: Path not found: $inputPath\n");
}

if (strtolower(basename($inputPath)) === 'php.exe') {
    $phpExePath = $inputPath;
    $phpDir = dirname($phpExePath);
} elseif (strtolower(basename($inputPath)) === 'php.ini' || strpos($inputPath, 'php.ini') !== false) {
    $iniPath = $inputPath;
    $phpDir = dirname($iniPath);
} elseif (is_dir($inputPath)) {
    $phpDir = $inputPath;
} else {
    die("Error: Invalid input. Please provide PHP executable path, php.ini path, or PHP directory.\n");
}

if ($phpDir === null || !is_dir($phpDir)) {
    die("Error: PHP directory not found: " . ($phpDir ?? 'unknown') . "\n");
}

$extDir = $phpDir . '\\ext';

if ($iniPath === null) {
    $iniPath = $phpDir . '\\php.ini';
    if (!file_exists($iniPath)) {
        $phpIniDev = $phpDir . '\\php.ini-development';
        $phpIniProd = $phpDir . '\\php.ini-production';
        if (file_exists($phpIniDev)) {
            copy($phpIniDev, $iniPath);
            echo "Created php.ini from php.ini-development template\n";
        } elseif (file_exists($phpIniProd)) {
            copy($phpIniProd, $iniPath);
            echo "Created php.ini from php.ini-production template\n";
        } else {
            die("Error: php.ini not found and no template files available in $phpDir\n");
        }
    }
}

if (!file_exists($iniPath)) {
    die("Error: Configuration file '$iniPath' not found.\n");
}

$iniContent = file_get_contents($iniPath);
if ($iniContent === false) {
    die("Error: Failed to read configuration file\n");
}
function updateConfigValue($iniContent, $key, $value) {
    $lines = explode("\n", $iniContent);
    $resultLines = [];
    $found = false;
    $keyPattern = '/^\s*' . preg_quote($key, '/') . '\s*=/i';
    
    foreach ($lines as $line) {
        if (preg_match($keyPattern, $line)) {
            if (!$found) {
                $resultLines[] = "$key = $value";
                $found = true;
            }
        } else {
            $resultLines[] = $line;
        }
    }
    
    if (!$found) {
        $resultLines[] = "$key = $value";
    }
    
    return implode("\n", $resultLines);
}

function removeConfigValue($iniContent, $key) {
    $lines = explode("\n", $iniContent);
    $resultLines = [];
    $keyPattern = '/^\s*' . preg_quote($key, '/') . '\s*=/i';
    
    foreach ($lines as $line) {
        if (!preg_match($keyPattern, $line)) {
            $resultLines[] = $line;
        }
    }
    
    return implode("\n", $resultLines);
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
    return extension_loaded($extensionName);
}
function isExtensionLoaded($name) {
    return extension_loaded($name);
}
function removeDuplicateExtensions($iniContent, $name) {
    global $extDir;
    if (!is_dir($extDir)) {
        return $iniContent;
    }
    $dllFiles = glob($extDir . '\\*.dll');
    $normalizedName = strtolower($name);
    $matchingDlls = [];
    foreach ($dllFiles as $dll) {
        $dllName = strtolower(basename($dll));
        $dllBase = str_replace(['php_', '.dll', '_nts', '_ts'], '', $dllName);
        if ($dllBase === $normalizedName || 
            preg_match('/^' . preg_quote($normalizedName, '/') . '\d*$/', $dllBase) ||
            strpos($dllBase, $normalizedName) !== false) {
            $matchingDlls[] = basename($dll);
        }
    }
    $extensionPattern = '/^\s*(;)?\s*extension\s*=\s*(.*?' . preg_quote($normalizedName, '/') . '.*?\.dll)\s*$/mi';
    $lines = explode("\n", $iniContent);
    $resultLines = [];
    $foundActive = false;
    $foundDlls = [];
    foreach ($lines as $lineNum => $line) {
        $lineTrimmed = trim($line);
        $isExtensionLine = false;
        $isCommented = false;
        $matchedDll = null;
        if (preg_match($extensionPattern, $line, $matches)) {
            $isExtensionLine = true;
            $isCommented = !empty($matches[1]);
            $matchedDll = isset($matches[2]) ? trim($matches[2]) : null;
        } else {
            foreach ($matchingDlls as $dll) {
                $dllPattern = '/^\s*(;)?\s*extension\s*=\s*' . preg_quote($dll, '/') . '\s*$/mi';
                if (preg_match($dllPattern, $line, $matches)) {
                    $isExtensionLine = true;
                    $isCommented = !empty($matches[1]);
                    $matchedDll = $dll;
                    break;
                }
            }
        }
        if ($isExtensionLine) {
            if ($isCommented) {
                if ($foundActive) {
                    continue;
                }
            } else {
                if ($foundActive) {
                    continue;
                }
                if ($matchedDll && in_array($matchedDll, $foundDlls)) {
                    continue;
                }
                $foundActive = true;
                if ($matchedDll) {
                    $foundDlls[] = $matchedDll;
                }
            }
        }
        $resultLines[] = $line;
    }
    return implode("\n", $resultLines);
}

function enableExtension($iniContent, $name) {
    $matchingDll = findMatchingDll($name);
    if ($matchingDll === null) {
        return $iniContent;
    }
    
    $iniContent = removeDuplicateExtensions($iniContent, $name);
    
    $pattern = '/^\s*(;)?\s*extension\s*=\s*' . preg_quote($matchingDll, '/') . '\s*$/mi';
    $extensionPattern = '/^\s*(;)?\s*extension\s*=\s*.*?' . preg_quote($name, '/') . '.*?\.dll\s*$/mi';
    
    $lines = explode("\n", $iniContent);
    $resultLines = [];
    $found = false;
    
    foreach ($lines as $line) {
        if (preg_match($pattern, $line) || preg_match($extensionPattern, $line)) {
            if (!$found) {
                $resultLines[] = "extension=$matchingDll";
                $found = true;
            }
        } else {
            $resultLines[] = $line;
        }
    }
    
    if (!$found) {
        $resultLines[] = "extension=$matchingDll";
    }
    
    return implode("\n", $resultLines);
}
function downloadSwooleDll($extDir) {
    global $phpDir;
    
    if (!is_dir($extDir)) {
        return false;
    }
    
    $phpVersion = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
    $phpThreadSafety = (ZEND_THREAD_SAFE ? 'ts' : 'nts');
    $phpArchitecture = (PHP_INT_SIZE === 8 ? 'x64' : 'x86');
    $phpVersionShort = str_replace('.', '', $phpVersion);
    
    $swooleDllName = "php_swoole.dll";
    $swooleDllPath = $extDir . '\\' . $swooleDllName;
    
    if (file_exists($swooleDllPath)) {
        return true;
    }
    
    echo "Attempting to download Swoole DLL for PHP $phpVersion ($phpThreadSafety, $phpArchitecture)...\n";
    
    $swooleVersions = ['5.1.3', '5.1.2', '5.1.1', '5.1.0', '5.0.3', '5.0.2', '5.0.1', '5.0.0', '4.8.13', '4.8.12'];
    $baseUrl = "https://windows.php.net/downloads/pecl/releases/swoole/";
    
    foreach ($swooleVersions as $swooleVersion) {
        $dllUrl = $baseUrl . $swooleVersion . "/php_swoole-" . $swooleVersion . "-" . $phpVersionShort . "-" . $phpThreadSafety . "-" . $phpArchitecture . ".zip";
        
        try {
            $context = stream_context_create([
                'http' => [
                    'timeout' => 15,
                    'user_agent' => 'PHP Swoole Installer',
                    'follow_location' => 1
                ]
            ]);
            
            $zipContent = @file_get_contents($dllUrl, false, $context);
            if ($zipContent !== false && strlen($zipContent) > 1000) {
                $zipPath = $extDir . '\\swoole_temp.zip';
                if (file_put_contents($zipPath, $zipContent) !== false) {
                    $zip = new ZipArchive();
                    if ($zip->open($zipPath) === TRUE) {
                        for ($i = 0; $i < $zip->numFiles; $i++) {
                            $filename = $zip->getNameIndex($i);
                            if (preg_match('/php_swoole.*\.dll$/i', $filename)) {
                                $dllContent = $zip->getFromIndex($i);
                                if ($dllContent !== false && strlen($dllContent) > 10000) {
                                    if (file_put_contents($swooleDllPath, $dllContent) !== false) {
                                        $zip->close();
                                        @unlink($zipPath);
                                        echo "Success: Downloaded Swoole $swooleVersion DLL to $swooleDllPath\n";
                                        return true;
                                    }
                                }
                            }
                        }
                        $zip->close();
                    }
                    @unlink($zipPath);
                }
            }
        } catch (Exception $e) {
            continue;
        }
    }
    
    echo "Warning: Could not download Swoole DLL automatically\n";
    echo "Please download manually from: https://windows.php.net/downloads/pecl/releases/swoole/\n";
    echo "Note: Swoole on Windows has limited support. Consider using WSL or Docker for production.\n";
    return false;
}

function verifyExtension($iniContent, $name) {
    global $extDir;
    static $dllsListed = false;
    
    $matchingDll = findMatchingDll($name);
    if ($matchingDll === null) {
        if ($name === 'swoole') {
            echo "Swoole DLL not found, attempting to download...\n";
            if (downloadSwooleDll($extDir)) {
                $matchingDll = findMatchingDll($name);
            }
        }
        
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
    }
    
    $newIniContent = enableExtension($iniContent, $name);
    $pattern = '/^\s*extension\s*=\s*' . preg_quote($matchingDll, '/') . '\s*$/mi';
    
    if (preg_match($pattern, $newIniContent)) {
        $isLoaded = isExtensionLoaded($name);
        if ($isLoaded) {
            echo "Success: Extension $name is configured and loaded\n";
        } else {
            echo "Success: Extension $name is configured in php.ini (requires PHP restart to load)\n";
        }
        return [$newIniContent, true];
    } else {
        echo "Error: Failed to configure extension $name in php.ini\n";
        return [$iniContent, false];
    }
}

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

// Clean duplicate extensions before processing
printSection("Cleaning Duplicate Extensions");
$duplicatesRemoved = 0;
foreach ($allKnownExtensions as $ext) {
    $beforeLength = strlen($iniContent);
    $iniContent = removeDuplicateExtensions($iniContent, $ext);
    $afterLength = strlen($iniContent);
    if ($beforeLength !== $afterLength) {
        $duplicatesRemoved++;
        printStatus("Removed duplicate entries for extension: $ext", 'warning');
    }
}
if ($duplicatesRemoved > 0) {
    printStatus("Cleaned $duplicatesRemoved extension(s) with duplicate entries", 'success');
} else {
    printStatus("No duplicate extensions found", 'success');
}

// Remove open_basedir for Laravel compatibility (must be done before other config updates)
printSection("Laravel Compatibility Configuration");
$iniContent = removeConfigValue($iniContent, 'open_basedir');
$iniContent = updateConfigValue($iniContent, 'open_basedir', 'none');
printConfigUpdate('open_basedir', 'none');

// Check for existing CA certificate bundle
$cacertPath = $phpDir . '\\cacert.pem';
$cacertPathNormalized = str_replace('\\', '/', $cacertPath);
if (file_exists($cacertPath)) {
    $configReplacements['curl.cainfo'] = '"' . $cacertPathNormalized . '"';
    $configReplacements['openssl.cafile'] = '"' . $cacertPathNormalized . '"';
    printStatus("Found existing CA certificate bundle: $cacertPath", 'info');
}

// Update the main output sections
printSection("PHP Configuration Update");
foreach ($configReplacements as $key => $value) {
    try {
        if ($value === '') {
            $iniContent = updateConfigValue($iniContent, $key, '');
            printConfigUpdate($key, '(cleared)');
        } else {
            $iniContent = updateConfigValue($iniContent, $key, $value);
            printConfigUpdate($key, $value);
        }
    } catch (Exception $e) {
        printStatus("Failed to update $key: " . $e->getMessage(), 'warning');
    }
}

// Configure OPcache for Laravel performance
printSection("OPcache Configuration");
$opcacheConfigs = [
    'opcache.enable' => '1',
    'opcache.memory_consumption' => '256',
    'opcache.interned_strings_buffer' => '8',
    'opcache.max_accelerated_files' => '10000',
    'opcache.revalidate_freq' => '2',
    'opcache.fast_shutdown' => '1'
];
foreach ($opcacheConfigs as $key => $value) {
    try {
        $iniContent = updateConfigValue($iniContent, $key, $value);
        printConfigUpdate($key, $value);
    } catch (Exception $e) {
        printStatus("Failed to update $key: " . $e->getMessage(), 'warning');
    }
}

printSection("PHP Extensions Status");

foreach ($extensions as $ext) {
    try {
        list($iniContent, $success) = verifyExtension($iniContent, $ext);
        if ($ext === 'openssl' && $success) {
            $opensslEnabled = true;
        }
    } catch (Exception $e) {
        printStatus("Failed to verify extension $ext: " . $e->getMessage(), 'warning');
    }
}

// Save updated configuration (always save, continue even if some steps failed)
try {
    if (file_put_contents($iniPath, $iniContent) === false) {
        printStatus("Failed to save configuration file", 'error');
    } else {
        $saveSuccess = true;
        printStatus("Configuration file saved successfully", 'success');
    }
} catch (Exception $e) {
    printStatus("Error saving configuration file: " . $e->getMessage(), 'error');
}

// Verify OpenSSL specifically for Composer (continue even if OpenSSL is not enabled)
try {
    if ($opensslEnabled) {
        printSection("OpenSSL Configuration");
        printConfigUpdate("Version", OPENSSL_VERSION_TEXT);
        printConfigUpdate("Version Number", OPENSSL_VERSION_NUMBER);
        
        if (extension_loaded('curl')) {
            printStatus("Attempting SSL connection test using cURL...", 'info');
            try {
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, "https://www.bing.com");
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                
                $curlVersion = curl_version();
                if (defined('CURLSSLOPT_NATIVE_CA') && version_compare($curlVersion['version'], '7.71', '>=')) {
                    curl_setopt($ch, CURLOPT_SSL_OPTIONS, CURLSSLOPT_NATIVE_CA);
                    printStatus("Using Windows native certificate store (Curl " . $curlVersion['version'] . ")", 'info');
                }
                
                $curl_exec_result = curl_exec($ch);
                $curl_error = curl_error($ch);
                $curl_errno = curl_errno($ch);
                unset($ch);

                if ($curl_exec_result !== false) {
                    printStatus("SSL connection test successful", 'success');
                } else {
                    printStatus("SSL connection test failed: " . $curl_error, 'warning');
                    if ($curl_errno === CURLE_SSL_CACERT || $curl_errno === CURLE_SSL_CERTPROBLEM || strpos($curl_error, 'unable to get local issuer certificate') !== false) {
                        printStatus("CA certificate bundle may be missing. Attempting to download cacert.pem...", 'info');
                        $cacertUrl = "https://curl.se/ca/cacert.pem";
                        $cacertPath = $phpDir . '\\cacert.pem';
                        try {
                            $cacertContent = @file_get_contents($cacertUrl);
                            if ($cacertContent !== false && strlen($cacertContent) > 1000) {
                                file_put_contents($cacertPath, $cacertContent);
                                $cacertPathNormalized = str_replace('\\', '/', $cacertPath);
                                $iniContent = updateConfigValue($iniContent, 'curl.cainfo', '"' . $cacertPathNormalized . '"');
                                $iniContent = updateConfigValue($iniContent, 'openssl.cafile', '"' . $cacertPathNormalized . '"');
                                file_put_contents($iniPath, $iniContent);
                                printStatus("CA certificate bundle downloaded and configured: $cacertPath", 'success');
                                printStatus("Please restart PHP for the changes to take effect", 'info');
                            } else {
                                printStatus("Failed to download CA certificate bundle", 'warning');
                            }
                        } catch (Exception $e) {
                            printStatus("Error downloading CA certificate bundle: " . $e->getMessage(), 'warning');
                        }
                    } else {
                        printStatus("This might indicate issues with CA certificates or network connectivity.", 'warning');
                    }
                }
            } catch (Exception $e) {
                printStatus("Error during SSL connection test: " . $e->getMessage(), 'warning');
            }
        } else {
            printStatus("cURL extension is not loaded in the current PHP process.", 'warning');
            printStatus("Skipping SSL connection test. Please ensure 'extension=curl' is enabled in php.ini and PHP is restarted if needed.", 'warning');
        }
    } else {
        printStatus("OpenSSL extension is required for Composer but could not be enabled", 'warning');
        printStatus("Continuing with configuration...", 'info');
    }
} catch (Exception $e) {
    printStatus("Error during OpenSSL verification: " . $e->getMessage(), 'warning');
}

// Print configuration summary
printSection("Configuration Summary");
printStatus("PHP Configuration File: $iniPath", 'info');
printStatus("PHP Directory: $phpDir", 'info');
printStatus("Extensions Directory: $extDir", 'info');

echo "\n";
printStatus("Configuration Values Updated:", 'info');
foreach ($configReplacements as $key => $value) {
    if ($value !== '') {
        printConfigUpdate($key, $value);
    }
}

echo "\n";
printStatus("Extensions Status:", 'info');
$extensionsStatus = [];
foreach ($extensions as $ext) {
    $isLoaded = isExtensionLoaded($ext);
    $extensionsStatus[$ext] = $isLoaded;
    $statusText = $isLoaded ? COLOR_GREEN . "Loaded" : COLOR_YELLOW . "Not Loaded";
    echo COLOR_CYAN . "  " . str_pad($ext, 15) . COLOR_RESET . " : " . $statusText . COLOR_RESET . "\n";
}

echo "\n";
$loadedCount = count(array_filter($extensionsStatus));
$totalCount = count($extensions);
printStatus("Extensions Summary: $loadedCount of $totalCount extensions loaded", $loadedCount === $totalCount ? 'success' : 'warning');

if ($duplicatesRemoved > 0) {
    echo "\n";
    printStatus("Duplicate entries removed: $duplicatesRemoved", 'success');
}

printSection("Configuration Complete");
if ($saveSuccess) {
    printStatus("PHP configuration has been successfully updated", 'success');
    printStatus("Configuration file saved to: $iniPath", 'success');
} else {
    printStatus("PHP configuration completed with warnings", 'warning');
    printStatus("Please check the configuration file manually: $iniPath", 'warning');
}
?>