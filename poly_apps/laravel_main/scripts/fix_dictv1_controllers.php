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


/**
 * Script to fix DictV1 controller inheritance issues
 * This script will replace all "extends Controller" with "extends BaseController"
 * and add the proper import statement
 */

$controllersDir = __DIR__ . '/../app/Apps/DictV1/Controllers/';

function fixControllerFile($filePath) {
    $content = file_get_contents($filePath);
    
    // Check if file already has the correct import
    if (strpos($content, 'use Illuminate\Routing\Controller as BaseController;') !== false) {
        echo "File already fixed: " . basename($filePath) . "\n";
        return;
    }
    
    // Add the import statement after the namespace
    $content = preg_replace(
        '/(namespace App\\\Apps\\\DictV1\\\Controllers;)/',
        '$1' . "\n" . 'use Illuminate\Routing\Controller as BaseController;',
        $content
    );
    
    // Replace "extends Controller" with "extends BaseController"
    $content = str_replace('extends Controller', 'extends BaseController', $content);
    
    // Remove any existing "use App\DictV1\Controller;" lines
    $content = preg_replace('/use App\\\DictV1\\\Controller;.*\n/', '', $content);
    
    file_put_contents($filePath, $content);
    echo "Fixed: " . basename($filePath) . "\n";
}

function processDirectory($dir) {
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
    );
    
    foreach ($files as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            fixControllerFile($file->getPathname());
        }
    }
}

echo "Starting DictV1 controller fixes...\n";
processDirectory($controllersDir);
echo "Completed DictV1 controller fixes.\n"; 