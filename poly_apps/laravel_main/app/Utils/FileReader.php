<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Utils;

use Illuminate\Support\Facades\Log;

class FileReader
{
    /**
     * Get available encodings from mb_list_encodings
     *
     * @return array
     */
    private static function getAvailableEncodings(): array
    {
        static $encodings = null;
        
        if ($encodings === null) {
            try {
                // Get all available encodings from mbstring
                $encodings = mb_list_encodings();
                
                // Ensure UTF-8 is first in the list as it's most common
                $utfKey = array_search('UTF-8', $encodings);
                if ($utfKey !== false) {
                    unset($encodings[$utfKey]);
                    array_unshift($encodings, 'UTF-8');
                }
            } catch (\Exception $e) {
                Log::error('Failed to get encodings list: ' . $e->getMessage());
                // Fallback to UTF-8 only if mb_list_encodings fails
                $encodings = ['UTF-8'];
            }
        }
        
        return $encodings;
    }

    /**
     * Read file content with multiple encoding attempts
     *
     * @param string $filePath
     * @param string|null $encoding
     * @param bool $debug
     * @return array|string
     */
    public static function readWithEncoding(string $filePath, ?string $encoding = null, bool $debug = false)
    {
        $filePath = self::getAbsolutePath($filePath);
        $encodingsToTry = $encoding 
            ? array_merge([$encoding], self::getAvailableEncodings()) 
            : self::getAvailableEncodings();

        foreach ($encodingsToTry as $enc) {
            try {
                $content = file_get_contents($filePath);
                if ($content === false) {
                    continue;
                }

                // Try to detect encoding if none specified
                if (!$encoding) {
                    $detectedEncoding = mb_detect_encoding($content, $encodingsToTry, true);
                    if ($detectedEncoding) {
                        $enc = $detectedEncoding;
                    }
                }

                // Convert content to UTF-8
                if ($enc !== 'UTF-8') {
                    $converted = mb_convert_encoding($content, 'UTF-8', $enc);
                    if ($converted !== false) {
                        $content = $converted;
                    }
                }

                // Validate UTF-8
                if (mb_check_encoding($content, 'UTF-8')) {
                    if ($debug) {
                        Log::info("Successfully read {$filePath} with {$enc} encoding");
                    }
                    return [
                        'content' => $content,
                        'encoding' => $enc
                    ];
                }
            } catch (\Exception $error) {
                if ($debug) {
                    Log::warning("Failed to read with {$enc} encoding: " . $error->getMessage());
                }
                continue;
            }
        }

        return '';
    }

    /**
     * Read text content from file
     *
     * @param string $filePath
     * @param string $encoding
     * @param bool $debug
     * @return string
     */
    public static function readText(string $filePath, string $encoding = 'UTF-8', bool $debug = false): string
    {
        $result = self::readWithEncoding($filePath, $encoding, $debug);
        return is_array($result) ? $result['content'] : '';
    }

    /**
     * Read file content as lines
     *
     * @param string $filePath
     * @param string $encoding
     * @param bool $debug
     * @return array|null
     */
    public static function readLines(string $filePath, string $encoding = 'UTF-8', bool $debug = false): ?array
    {
        $content = self::readText($filePath, $encoding, $debug);
        return $content ? explode(PHP_EOL, $content) : null;
    }

    /**
     * Read JSON file content
     *
     * @param string $filePath
     * @param string $encoding
     * @param bool $debug
     * @return array
     */
    public static function readJson(string $filePath, string $encoding = 'UTF-8', bool $debug = false): array
    {
        $content = self::readText($filePath, $encoding, $debug);
        if ($content) {
            try {
                return json_decode($content, true) ?? [];
            } catch (\Exception $error) {
                Log::error("Failed to parse JSON from {$filePath}: " . $error->getMessage());
            }
        }
        return [];
    }

    /**
     * Get absolute path
     *
     * @param string $inputPath
     * @return string
     */
    private static function getAbsolutePath(string $inputPath): string
    {
        try {
            $absolutePath = realpath($inputPath);
            return $absolutePath !== false ? $absolutePath : $inputPath;
        } catch (\Exception $error) {
            Log::error('Error getting absolute path: ' . $error->getMessage());
            return $inputPath;
        }
    }

    /**
     * Check if path is a file
     *
     * @param string $filePath
     * @return bool
     */
    public static function isFile(string $filePath): bool
    {
        $filePath = self::getAbsolutePath($filePath);
        return file_exists($filePath) && is_file($filePath);
    }

    /**
     * Check if path is a directory
     *
     * @param string $dirPath
     * @return bool
     */
    public static function isDirectory(string $dirPath): bool
    {
        $dirPath = self::getAbsolutePath($dirPath);
        return file_exists($dirPath) && is_dir($dirPath);
    }

    /**
     * Get file size
     *
     * @param string $filePath
     * @return int
     */
    public static function getFileSize(string $filePath): int
    {
        $filePath = self::getAbsolutePath($filePath);
        return file_exists($filePath) ? filesize($filePath) : 0;
    }

    /**
     * Check if file is readable
     *
     * @param string $filePath
     * @return bool
     */
    public static function isReadable(string $filePath): bool
    {
        $filePath = self::getAbsolutePath($filePath);
        return file_exists($filePath) && is_readable($filePath);
    }
} 