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