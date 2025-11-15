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
        // 移除所有 HTML 标签，但保留换行和缩进
        $content = preg_replace('/<[^>]+>|<\/[^>]+>/', '', $content);
        
        // 处理 HTML 实体
        $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        // 移除多余的空格，但保留换行和缩进
        $content = preg_replace('/[ ]{2,}/', ' ', $content);
        
        // 移除行首尾的空格，但保留换行
        $lines = explode("\n", $content);
        $lines = array_map('trim', $lines);
        
        return implode("\n", $lines);
    }
} 