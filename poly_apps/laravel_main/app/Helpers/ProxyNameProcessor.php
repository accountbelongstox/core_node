<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
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