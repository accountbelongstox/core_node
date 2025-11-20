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
        
        // 查找主代理区域
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

        // 移除主代理区域内容（不包含边界行）
        if ($proxiesIndex !== null && $proxiesEndIndex !== null) {
            array_splice($lines, $proxiesIndex + 1, $proxiesEndIndex - $proxiesIndex - 1);
        }

        // 处理 proxy-groups 区域的缩进集合
        $groupsStartIndex = null;
        $groupsEndIndex = null;
        $indentCounts = [];
        $secondMaxIndentLines = [];

        // 查找 proxy-groups 区域并收集缩进信息
        foreach ($lines as $index => $line) {
            if (trim($line) === 'proxy-groups:') {
                $groupsStartIndex = $index;
                continue;
            }
            if ($groupsStartIndex !== null && trim($line) === 'rules:') {
                $groupsEndIndex = $index;
                break;
            }
            
            // 在 proxy-groups 区域内收集带 - 的行的缩进
            if ($groupsStartIndex !== null && $groupsEndIndex === null) {
                if (preg_match('/^(\s+)-/', $line, $matches)) {
                    $indentCount = strlen($matches[1]);
                    $indentCounts[] = $indentCount;
                }
            }
        }

        // 获取最大和第二大的缩进值
        $uniqueIndents = array_unique($indentCounts);
        rsort($uniqueIndents);
        $maxIndent = $uniqueIndents[0] ?? 0;
        $secondMaxIndent = $uniqueIndents[1] ?? 0;

        // 收集第二大缩进值的行
        if ($groupsStartIndex !== null && $groupsEndIndex !== null) {
            for ($i = $groupsStartIndex + 1; $i < $groupsEndIndex; $i++) {
                if (preg_match('/^(\s+)-/', $lines[$i], $matches)) {
                    $indentCount = strlen($matches[1]);
                    if ($indentCount === $secondMaxIndent) {
                        // 只替换 'name:'，保留前面的 '-'
                        $line = trim($lines[$i]);
                        $line = preg_replace('/^- name:\s*/', '- ', $line);
                        $secondMaxIndentLines[] = $line;
                    }
                }
            }
        }

        // 移除不在 secondMaxIndentLines 中的最大缩进行
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

            // 从后向前移除行
            foreach (array_reverse($linesToRemove) as $index) {
                array_splice($lines, $index, 1);
            }
        }

        // 生成新内容
        $newContent = implode("\n", $lines);
        
        // 使用固定的备份文件名
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