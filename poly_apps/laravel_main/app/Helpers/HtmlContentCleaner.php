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

class HtmlContentCleaner
{
    public static function clean($content)
    {
        // Remove all HTML tags but keep newlines and indentation
        $content = preg_replace('/<[^>]+>|<\/[^>]+>/', '', $content);

        // Decode HTML entities
        $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        // Collapse extra spaces but keep newlines and indentation
        $content = preg_replace('/[ ]{2,}/', ' ', $content);

        // Trim leading/trailing spaces on each line but keep newlines
        $lines = explode("\n", $content);
        $lines = array_map('trim', $lines);
        
        return implode("\n", $lines);
    }
} 