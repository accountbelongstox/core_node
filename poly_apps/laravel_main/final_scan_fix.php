<?php

echo "=== Final Comprehensive Scan and Fix ===\n\n";

$appDir = __DIR__ . '/app/Apps/AppQyV1';
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($appDir),
    RecursiveIteratorIterator::LEAVES_ONLY
);

$issues = [];
$fixed = [];

foreach ($files as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $filePath = $file->getRealPath();
        $content = file_get_contents($filePath);
        $originalContent = $content;
        
        // Fix 1: Inconsistent AppTablePrefixServiceProvider usage
        if (strpos($content, 'use App\Providers\AppTablePrefixServiceProvider;') !== false) {
            // File has use statement, but might still use full namespace
            $content = preg_replace(
                '/\\\\App\\\\Providers\\\\AppTablePrefixServiceProvider::/',
                'AppTablePrefixServiceProvider::',
                $content
            );
        }
        
        // Fix 2: Inconsistent AppKeys usage
        if (strpos($content, 'use App\Constants\AppKeys;') !== false) {
            $content = preg_replace(
                '/\\\\App\\\\Constants\\\\AppKeys::APPQYV1/',
                'AppKeys::APPQYV1',
                $content
            );
        }
        
        // Fix 3: Remove unnecessary catch blocks (only logging, no rethrow)
        $content = preg_replace_callback(
            '/catch\s*\([^)]+\)\s*\{([^}]*)\}/s',
            function ($matches) use (&$issues, $filePath) {
                $catchContent = $matches[1];
                $hasRethrow = preg_match('/throw\s+(\$e|\$exception|\$error|\$ex)/i', $catchContent);
                $hasReturn = preg_match('/return\s+[^;]+;/', $catchContent);
                $hasMeaningfulCode = preg_match('/(if|else|switch|foreach|while|for)\s*\(/', $catchContent);
                $onlyLogging = preg_match('/^(Log::|error_log|var_dump|print_r|dd\(|dump\().*$/m', $catchContent) 
                    && !$hasRethrow && !$hasReturn && !$hasMeaningfulCode;
                
                if ($onlyLogging) {
                    $issues[] = [
                        'file' => $filePath,
                        'type' => 'unnecessary_catch',
                        'content' => trim($catchContent),
                    ];
                    // Remove catch block - let exception propagate
                    return '';
                }
                
                return $matches[0];
            },
            $content
        );
        
        if ($content !== $originalContent) {
            $fixed[] = str_replace(__DIR__ . '/', '', $filePath);
            file_put_contents($filePath, $content);
        }
    }
}

echo "=== Issues Found ===\n";
echo "Total: " . count($issues) . "\n\n";

foreach ($issues as $issue) {
    $relPath = str_replace(__DIR__ . '/', '', $issue['file']);
    echo "File: {$relPath}\n";
    echo "Type: {$issue['type']}\n";
    echo "Content: " . substr($issue['content'], 0, 100) . "...\n\n";
}

echo "=== Files Fixed ===\n";
echo "Total: " . count($fixed) . "\n\n";

foreach ($fixed as $file) {
    echo "Fixed: {$file}\n";
}

if (empty($issues) && empty($fixed)) {
    echo "✅ No issues found!\n";
}

