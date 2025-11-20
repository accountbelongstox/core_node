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

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

class ItToolsV1PdfUtil
{
    private static function getPdftkPath(): string
    {
        $paths = [
            '/usr/bin/pdftk',
            '/usr/local/bin/pdftk',
            'pdftk'
        ];
        
        foreach ($paths as $path) {
            if (file_exists($path) || shell_exec("which $path 2>/dev/null")) {
                return $path;
            }
        }
        
        throw new \RuntimeException("pdftk is not installed. Please install it first.");
    }
    
    private static function getGs Path(): string
    {
        $paths = [
            '/usr/bin/gs',
            '/usr/local/bin/gs',
            'gs'
        ];
        
        foreach ($paths as $path) {
            if (file_exists($path) || shell_exec("which $path 2>/dev/null")) {
                return $path;
            }
        }
        
        throw new \RuntimeException("Ghostscript is not installed. Please install it first.");
    }
    
    public static function getPdfPageCount(string $pdfPath): int
    {
        if (!file_exists($pdfPath)) {
            throw new \InvalidArgumentException("PDF file not found: $pdfPath");
        }
        
        $pdftk = self::getPdftkPath();
        $output = shell_exec("$pdftk " . escapeshellarg($pdfPath) . " dump_data 2>&1");
        
        if (preg_match('/NumberOfPages:\s*(\d+)/', $output, $matches)) {
            return (int)$matches[1];
        }
        
        throw new \RuntimeException("Could not determine PDF page count");
    }
    
    public static function splitPdf(string $pdfPath, array $pageRanges): array
    {
        if (!file_exists($pdfPath)) {
            throw new \InvalidArgumentException("PDF file not found: $pdfPath");
        }
        
        $pdftk = self::getPdftkPath();
        $totalPages = self::getPdfPageCount($pdfPath);
        $results = [];
        
        foreach ($pageRanges as $index => $range) {
            $outputPath = tempnam(sys_get_temp_dir(), 'pdf_split_') . '.pdf';
            
            if (is_array($range)) {
                $start = $range['start'] ?? 1;
                $end = $range['end'] ?? $totalPages;
                $pageSpec = "$start-$end";
            } else {
                $pageSpec = (string)$range;
            }
            
            $cmd = sprintf(
                "%s %s cat %s output %s 2>&1",
                $pdftk,
                escapeshellarg($pdfPath),
                escapeshellarg($pageSpec),
                escapeshellarg($outputPath)
            );
            
            $output = shell_exec($cmd);
            
            if (!file_exists($outputPath) || filesize($outputPath) === 0) {
                throw new \RuntimeException("Failed to split PDF: $output");
            }
            
            $results[] = [
                'path' => $outputPath,
                'pages' => $pageSpec,
                'file_size' => filesize($outputPath),
                'index' => $index
            ];
        }
        
        return $results;
    }
    
    public static function mergePdfs(array $pdfPaths, string $outputPath = null): array
    {
        foreach ($pdfPaths as $path) {
            if (!file_exists($path)) {
                throw new \InvalidArgumentException("PDF file not found: $path");
            }
        }
        
        $pdftk = self::getPdftkPath();
        $output = $outputPath ?: tempnam(sys_get_temp_dir(), 'pdf_merge_') . '.pdf';
        
        $inputFiles = implode(' ', array_map('escapeshellarg', $pdfPaths));
        $cmd = sprintf(
            "%s %s cat output %s 2>&1",
            $pdftk,
            $inputFiles,
            escapeshellarg($output)
        );
        
        $result = shell_exec($cmd);
        
        if (!file_exists($output) || filesize($output) === 0) {
            throw new \RuntimeException("Failed to merge PDFs: $result");
        }
        
        return [
            'path' => $output,
            'file_size' => filesize($output),
            'page_count' => self::getPdfPageCount($output),
            'input_count' => count($pdfPaths)
        ];
    }
    
    public static function compressPdf(string $pdfPath, string $quality = 'screen'): array
    {
        if (!file_exists($pdfPath)) {
            throw new \InvalidArgumentException("PDF file not found: $pdfPath");
        }
        
        $gs = self::getGsPath();
        $outputPath = tempnam(sys_get_temp_dir(), 'pdf_compress_') . '.pdf';
        
        $qualitySettings = [
            'screen' => '/screen',
            'ebook' => '/ebook',
            'printer' => '/printer',
            'prepress' => '/prepress'
        ];
        
        $setting = $qualitySettings[$quality] ?? '/screen';
        
        $cmd = sprintf(
            "%s -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=%s -dNOPAUSE -dQUIET -dBATCH -sOutputFile=%s %s 2>&1",
            $gs,
            $setting,
            escapeshellarg($outputPath),
            escapeshellarg($pdfPath)
        );
        
        $output = shell_exec($cmd);
        
        if (!file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new \RuntimeException("Failed to compress PDF: $output");
        }
        
        $originalSize = filesize($pdfPath);
        $compressedSize = filesize($outputPath);
        
        return [
            'path' => $outputPath,
            'original_size' => $originalSize,
            'compressed_size' => $compressedSize,
            'compression_ratio' => round((1 - $compressedSize / $originalSize) * 100, 2),
            'quality' => $quality
        ];
    }
    
    public static function rotatePdf(string $pdfPath, int $rotation, array $pages = null): array
    {
        if (!file_exists($pdfPath)) {
            throw new \InvalidArgumentException("PDF file not found: $pdfPath");
        }
        
        $pdftk = self::getPdftkPath();
        $outputPath = tempnam(sys_get_temp_dir(), 'pdf_rotate_') . '.pdf';
        
        $validRotations = [90 => 'east', 180 => 'south', 270 => 'west'];
        if (!isset($validRotations[$rotation])) {
            throw new \InvalidArgumentException("Invalid rotation. Must be 90, 180, or 270");
        }
        
        $direction = $validRotations[$rotation];
        $totalPages = self::getPdfPageCount($pdfPath);
        
        if ($pages === null) {
            $pageSpec = "1-end$direction";
        } else {
            $pageSpec = implode(' ', array_map(function($page) use ($direction) {
                return $page . $direction;
            }, $pages));
        }
        
        $cmd = sprintf(
            "%s %s cat %s output %s 2>&1",
            $pdftk,
            escapeshellarg($pdfPath),
            $pageSpec,
            escapeshellarg($outputPath)
        );
        
        $output = shell_exec($cmd);
        
        if (!file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new \RuntimeException("Failed to rotate PDF: $output");
        }
        
        return [
            'path' => $outputPath,
            'rotation' => $rotation,
            'pages' => $pages ?? 'all',
            'file_size' => filesize($outputPath)
        ];
    }
    
    public static function addPasswordToPdf(string $pdfPath, string $userPassword, string $ownerPassword = null): array
    {
        if (!file_exists($pdfPath)) {
            throw new \InvalidArgumentException("PDF file not found: $pdfPath");
        }
        
        $pdftk = self::getPdftkPath();
        $outputPath = tempnam(sys_get_temp_dir(), 'pdf_protected_') . '.pdf';
        $owner = $ownerPassword ?: $userPassword;
        
        $cmd = sprintf(
            "%s %s output %s user_pw %s owner_pw %s encrypt_128bit 2>&1",
            $pdftk,
            escapeshellarg($pdfPath),
            escapeshellarg($outputPath),
            escapeshellarg($userPassword),
            escapeshellarg($owner)
        );
        
        $output = shell_exec($cmd);
        
        if (!file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new \RuntimeException("Failed to add password to PDF: $output");
        }
        
        return [
            'path' => $outputPath,
            'protected' => true,
            'file_size' => filesize($outputPath)
        ];
    }
    
    public static function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
