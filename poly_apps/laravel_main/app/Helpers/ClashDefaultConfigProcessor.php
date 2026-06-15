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

use Illuminate\Support\Facades\File;

class ClashDefaultConfigProcessor
{
    public static function processConfig()
    {
        $configPath = app_path('Providers/openwrt_default_config.yaml');
        if (!file_exists($configPath)) {
            throw new \Exception('Default Clash config file not found');
        }

        $content = file_get_contents($configPath);
        $lines = explode("\n", $content);
        
        $proxiesIndex = null;
        $proxiesEndIndex = null;
        
        // Find the main proxies section
        foreach ($lines as $index => $line) {
            if (trim($line) === 'proxies:') {
                $proxiesIndex = $index;
                continue;
            }
            
            if ($proxiesIndex !== null && !preg_match('/^\s*-/', $line)) {
                $proxiesEndIndex = $index;
                break;
            }
        }

        // Remove the main proxies section content (excluding the boundary lines)
        if ($proxiesIndex !== null && $proxiesEndIndex !== null) {
            array_splice($lines, $proxiesIndex + 1, $proxiesEndIndex - $proxiesIndex - 1);
        }

        // Process the indentation set of the proxy-groups section
        $groupsStartIndex = null;
        $groupsEndIndex = null;
        $indentCounts = [];
        $secondMaxIndentLines = [];

        // Find the proxy-groups section and collect indentation info
        foreach ($lines as $index => $line) {
            if (trim($line) === 'proxy-groups:') {
                $groupsStartIndex = $index;
                continue;
            }
            if ($groupsStartIndex !== null && trim($line) === 'rules:') {
                $groupsEndIndex = $index;
                break;
            }
            
            // Within the proxy-groups section, collect the indentation of lines starting with -
            if ($groupsStartIndex !== null && $groupsEndIndex === null) {
                if (preg_match('/^(\s+)-/', $line, $matches)) {
                    $indentCount = strlen($matches[1]);
                    $indentCounts[] = $indentCount;
                }
            }
        }

        // Get the largest and second-largest indentation values
        $uniqueIndents = array_unique($indentCounts);
        rsort($uniqueIndents);
        $maxIndent = $uniqueIndents[0] ?? 0;
        $secondMaxIndent = $uniqueIndents[1] ?? 0;

        // Collect the lines with the second-largest indentation value
        if ($groupsStartIndex !== null && $groupsEndIndex !== null) {
            for ($i = $groupsStartIndex + 1; $i < $groupsEndIndex; $i++) {
                if (preg_match('/^(\s+)-/', $lines[$i], $matches)) {
                    $indentCount = strlen($matches[1]);
                    if ($indentCount === $secondMaxIndent) {
                        // Only replace 'name:', keeping the leading '-'
                        $line = trim($lines[$i]);
                        $line = preg_replace('/^- name:\s*/', '- ', $line);
                        $secondMaxIndentLines[] = $line;
                    }
                }
            }
        }

        // Remove the max-indent lines that are not in secondMaxIndentLines
        if ($groupsStartIndex !== null && $groupsEndIndex !== null) {
            $linesToRemove = [];
            for ($i = $groupsStartIndex + 1; $i < $groupsEndIndex; $i++) {
                if (preg_match('/^(\s+)-/', $lines[$i], $matches)) {
                    $indentCount = strlen($matches[1]);
                    if ($indentCount === $maxIndent) {
                        $currentLine = trim($lines[$i]);
                        $currentLine = preg_replace('/^- name:\s*/', '- ', $currentLine);
                        if (!in_array($currentLine, $secondMaxIndentLines)) {
                            $linesToRemove[] = $i;
                        }
                    }
                }
            }

            // Remove the lines from back to front
            foreach (array_reverse($linesToRemove) as $index) {
                array_splice($lines, $index, 1);
            }
        }

        // Generate the new content
        $newContent = implode("\n", $lines);

        // Use a fixed backup file name
        $backupPath = dirname($configPath) . DIRECTORY_SEPARATOR . 
                     'openwrt_default_config_template.yaml';
        
        File::put($backupPath, $newContent);

        return [
            'template' => $newContent,
            'proxies_index' => $proxiesIndex,
            'proxies_end_index' => $proxiesEndIndex,
            'proxy_groups_section' => [
                'start' => $groupsStartIndex,
                'end' => $groupsEndIndex,
                'max_indent' => $maxIndent,
                'second_max_indent' => $secondMaxIndent,
                'second_max_indent_set' => array_unique($secondMaxIndentLines),
                'removed_lines' => $secondMaxIndentLines
            ],
            'processed_config_lines' => $lines
        ];
    }
} 