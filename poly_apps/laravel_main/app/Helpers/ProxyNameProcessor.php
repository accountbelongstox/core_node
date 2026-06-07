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


namespace App\Helpers;

class ProxyNameProcessor
{
    public static function processProxyLines($proxyLines, array &$existingNames)
    {
        $processedLines = [];
        $updatedNames = array_unique($existingNames); // Ensure initial collection is unique

        // Filter out lines containing specific strings
        $filteredLines = array_filter($proxyLines, function($line) {
            return strpos($line, 'password: //') === false;
        });

        foreach ($filteredLines as $line) {
            $result = self::processLine($line, $updatedNames);
            if ($result['proposed_name']) {
                $updatedNames[] = $result['proposed_name'];
            }
            $processedLines[] = $result['new_line'];
        }

        return [
            'lines' => $processedLines,
            'names' => array_values(array_unique($updatedNames)) // Return final unique name collection
        ];
    }

    public static function processLine($line, array $existingNames)
    {
        // First check if name: marker exists
        if (!preg_match('/name:\s*/', $line)) {
            return [
                'proposed_name' => null,
                'new_line' => $line
            ];
        }

        // Determine the quote type and the name
        if (preg_match('/name:\s*"/', $line)) {
            // Double-quote case
            if (!preg_match('/name:\s*"([^"]+)"/', $line, $matches)) {
                return ['proposed_name' => null, 'new_line' => $line];
            }
            $originalName = $matches[1];
            $quoteType = 'double';
        } elseif (preg_match('/name:\s*\'/', $line)) {
            // Single-quote case
            if (!preg_match('/name:\s*\'([^\']+)\'/', $line, $matches)) {
                return ['proposed_name' => null, 'new_line' => $line];
            }
            $originalName = $matches[1];
            $quoteType = 'single';
        } else {
            // No-quote case
            if (!preg_match('/name:\s*([^,]+)/', $line, $matches)) {
                return ['proposed_name' => null, 'new_line' => $line];
            }
            $originalName = $matches[1];
            $quoteType = 'none';
        }

        $proposedName = self::generateUniqueName(trim($originalName), $existingNames);
        
        // Build the new line based on the quote type
        switch ($quoteType) {
            case 'double':
                $newLine = preg_replace(
                    '/name:\s*"[^"]+"/',
                    'name: "' . $proposedName . '"',
                    $line
                );
                break;
            case 'single':
                $newLine = preg_replace(
                    '/name:\s*\'[^\']+\'/',
                    'name: "' . str_replace('"', '\\"', $proposedName) . '"',
                    $line
                );
                break;
            default:
                $newLine = preg_replace(
                    '/name:\s*[^,]+/',
                    'name: "' . $proposedName . '"',
                    $line
                );
        }

        return [
            'proposed_name' => $proposedName,
            'new_line' => $newLine
        ];
    }

    private static function generateUniqueName($name, array $existingNames, $counter = 0)
    {
        $proposedName = $counter === 0 ? $name : $name . '_' . $counter;
        
        if (!in_array($proposedName, $existingNames)) {
            return $proposedName;
        }
        
        return self::generateUniqueName($name, $existingNames, $counter + 1);
    }
} 