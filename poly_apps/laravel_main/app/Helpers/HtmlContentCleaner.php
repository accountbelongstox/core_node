<?php

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