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


namespace App\Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class StrTool
{
    public static function validateWord(?string $word): ?string
    {
        try {
            if (empty($word)) {
                return null;
            }

            $word = trim($word);
            $word = str_replace(["''", "“", "”"], "'", $word);
            $word = str_replace(['""', '“', '”'], '"', $word);
            $word = str_replace(['–', '—'], '-', $word);
            $word = preg_replace('/[^a-zA-Z0-9\'\-]/', '', $word);

            return preg_match('/[a-zA-Z]/', $word) ? $word : null;
        } catch (\Exception $e) {
            Log::error('Error validating word:', ['error' => $e]);
            return null;
        }
    }

    public static function toWordArray(string|array|null $doc): array
    {
        if (is_string($doc)) {
            return self::extractWords($doc);
        }
        if (is_array($doc)) {
            return $doc;
        }
        return [];
    }

    public static function toWordFrequencyArray(string|array|null $doc): array
    {
        if (is_string($doc)) {
            return self::extractWords($doc, true);
        }
        if (is_array($doc)) {
            return $doc;
        }
        return [];
    }

    public static function wordCount(string|array $doc): int
    {
        return count(self::toWordArray($doc));
    }

    public static function extractWords(
        string $doc,
        bool $withFrequency = false,
    ): array {
        $doc = self::trimPunctuation($doc);
        $words = preg_split('/[^a-zA-Z0-9]+/', $doc, -1, PREG_SPLIT_NO_EMPTY);
        $uniqueWords = [];
        $wordCounts = [];
        $words_frequency = [];

        foreach ($words as $word) {
            if (!empty($word)) {
                $key = $word;
                if (!isset($uniqueWords[$key])) {
                    $uniqueWords[$key] = self::cleanWord($word); // Preserve original case
                    $wordCounts[$key] = 1;
                    $words_frequency[$key] = 1;
                } else {
                    $wordCounts[$key]++;
                    $words_frequency[$key]++;
                }
            }
        }

        if ($withFrequency) {
            $result = [
                'words' => array_values($uniqueWords),
                'frequency' => $words_frequency
            ];
            return $result;
        }

        return array_values($uniqueWords);
    }

    public static function validateSentence(?string $text): string
    {
        try {
            if (empty($text)) {
                return '';
            }

            $text = trim($text);
            $text = str_replace(['\'\'', '"', '"'], '\'', $text);
            $text = str_replace(['""', '"', '"'], '"', $text);
            $text = str_replace(['–', '—'], '-', $text);
            $text = str_replace(['。'], '.', $text);
            $text = str_replace(['，'], ',', $text);
            $text = str_replace(['！'], '!', $text);
            $text = str_replace(['？'], '?', $text);
            $text = preg_replace('/[^a-zA-Z0-9\s.,!?\'"()\-]/', ' ', $text);
            $text = preg_replace('/\s+/', ' ', $text);

            return preg_match('/[a-zA-Z]/', $text) ? $text : '';
        } catch (\Exception $e) {
            Log::error('Error validating sentence:', ['error' => $e]);
            return '';
        }
    }

    public static function cleanWord(?string $word): string
    {
        try {
            if (empty($word)) {
                return '';
            }

            $word = preg_replace('/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/', '', $word);
            $word = trim($word);
            $hasLetters = preg_match('/[a-zA-Z]/', $word);

            if ($hasLetters) {
                $word = preg_replace('/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/', '', $word);
                $word = preg_replace('/\"+/', "'", $word);
                $word = preg_replace('/\'+/', "'", $word);
                $word = preg_replace('/\s+/', ' ', $word);
                $word = preg_replace('/\-+/', '-', $word);
                return preg_replace('/[^a-zA-Z\'\-]/', '', $word);
            }

            return '';
        } catch (\Exception $e) {
            Log::error('Error cleaning word:', ['error' => $e]);
            return '';
        }
    }

    public static function wordToFileName(string $word): string
    {
        $word = self::cleanWord($word);
        return preg_replace('/[^a-zA-Z0-9\'\-]/', '', $word);
    }

    public static function cleanSentence(?string $sentence): string
    {
        try {
            if (empty($sentence)) {
                return '';
            }

            $sentence = trim($sentence);
            $sentence = preg_replace('/[^a-zA-Z0-9\s]/', ' ', $sentence);
            $sentence = preg_replace('/\s+/', ' ', $sentence);

            return preg_match('/[a-zA-Z]/', $sentence) ? $sentence : '';
        } catch (\Exception $e) {
            Log::error('Error cleaning sentence:', ['error' => $e]);
            return '';
        }
    }

    public static function trimPunctuation(?string $text): string
    {
        try {
            if (empty($text)) {
                return '';
            }

            return preg_replace('/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/', '', trim($text));
        } catch (\Exception $e) {
            Log::error('Error trimming punctuation:', ['error' => $e]);
            return $text ?? '';
        }
    }

    public static function replaceSpaceToDash(string $text): string
    {
        return str_replace(' ', '-', trim($text));
    }

    public static function extractHttpUrl(string $str): string
    {
        preg_match('/(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?/', $str, $matches);
        return $matches[0] ?? '';
    }

    public static function cleanString(?string $str, array $options = []): string
    {
        $defaults = [
            'replacement' => '_',
            'illegalChars' => '/[?<>:*|"\/\\\\]/',
            'removeLeadingNumbers' => true
        ];
        $options = array_merge($defaults, $options);

        if (empty($str)) {
            return '';
        }

        $result = $str;
        if ($options['removeLeadingNumbers']) {
            $result = preg_replace('/^\d+/', '', $result);
        }
        return preg_replace($options['illegalChars'], $options['replacement'], $result);
    }

    public static function forceUtf8($input): string
    {
        try {
            if (is_string($input)) {
                return mb_convert_encoding($input, 'UTF-8', 'UTF-8');
            }
            return mb_convert_encoding(strval($input), 'UTF-8', 'UTF-8');
        } catch (\Exception $e) {
            Log::error('Error forceUtf8:', ['error' => $e]);
            return is_string($input) ? $input : strval($input);
        }
    }

    public static function isValidUtf8(string $str): bool
    {
        return mb_check_encoding($str, 'UTF-8');
    }

    public static function isEnglishWord(string $word): bool
    {
        $word = trim($word);

        // Basic pattern check (letters, apostrophes, hyphens)
        if (!preg_match('/^[a-zA-Z\'\-]+$/', $word)) {
            return false;
        }

        // First and last character checks
        $firstChar = substr($word, 0, 1);
        $lastChar = substr($word, -1);

        if (
            !preg_match('/[a-zA-Z]/', $firstChar) ||
            !preg_match('/[a-zA-Z\']/', $lastChar)
        ) {
            return false;
        }

        $lowerWord = strtolower($word);
        $length = strlen($word);

        // Single character words
        if ($length === 1) {
            return in_array($lowerWord, ['a', 'i', 'o', 'x', 'y']);
        }

        // Two character words (commented out as in original)
        // if ($length === 2) {
        //     $twoLetterWords = [
        //         'aa', 'ab', 'ad', 'ae', 'ag', 'ah', 'ai', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
        //         'ba', 'be', 'bi', 'bo', 'by',
        //         'ch',
        //         'da', 'de', 'di', 'do',
        //         'ea', 'ed', 'ee', 'ef', 'eh', 'el', 'em', 'en', 'er', 'es', 'et', 'ex',
        //         'fa', 'fe', 'fy',
        //         'gi', 'go',
        //         'ha', 'he', 'hi', 'hm', 'ho',
        //         'id', 'if', 'in', 'is', 'it',
        //         'jo',
        //         'ka', 'ki', 'ko',
        //         'la', 'li', 'lo',
        //         'ma', 'me', 'mi', 'mm', 'mo', 'mu', 'my',
        //         'na', 'ne', 'no', 'nu',
        //         'od', 'oe', 'of', 'oh', 'oi', 'ok', 'om', 'on', 'op', 'or', 'os', 'ow', 'ox', 'oy',
        //         'pa', 'pe', 'pi', 'po',
        //         'qi', 'ms', 'pm', 'vt',
        //         're',
        //         'sh', 'si', 'so',
        //         'ta', 'ti', 'to',
        //         'uh', 'um', 'un', 'up', 'ur', 'us', 'ut',
        //         'we', 'wo',
        //         'xi', 'xu',
        //         'ya', 'ye', 'yo',
        //         'za'
        //     ];
        //     return in_array($lowerWord, $twoLetterWords);
        // }

        // Check for repeated characters (e.g., "aaa")
        return !preg_match('/^([a-zA-Z])\1*$/', $word);
    }

    public static function combineIfNotIncluded(string|null $textA, string|null $textB, $join_sep = null): string
    {
        $textA = trim($textA ?? "");
        $textB = trim($textB ?? "");
        if (strpos($textA, $textB) === false) {
            if ($join_sep === null)
                $join_sep = "\n";
            return $textA . $join_sep . $textB;
        } else {
            return $textA;
        }
    }

    public static function genGnameByTimeAndUUID()
    {
        return date('YmdHis').'-'.Str::uuid()->toString();
    }

    public static function genUserTokenByTimeAndUUID()
    {
        return date('YmdHis').'-'.Str::uuid()->toString();
    }

    public static function genUsername($max_length = 16){
        $username = 'u'.Str::uuid()->toString();
        if(strlen($username) > $max_length){
            $username = substr($username, 0, $max_length);
        }
        return $username;
    }

    public static function genPassword($max_length = 16){
        $password = 'p_'.date('YmdHis').'-'.Str::uuid()->toString();
        if(strlen($password) > $max_length){
            $password = substr($password, 0, $max_length);
        }
        return $password;
    }
}