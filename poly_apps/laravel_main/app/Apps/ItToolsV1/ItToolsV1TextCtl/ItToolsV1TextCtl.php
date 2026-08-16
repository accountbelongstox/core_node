<?php

namespace App\Apps\ItToolsV1\ItToolsV1TextCtl;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Apps\ItToolsV1\ItToolsV1Gvar\ItToolsV1Constants;

class ItToolsV1TextCtl extends Controller
{
    use ApiResponse;

    public function statistics(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $text = $request->input('text');

        $characters = mb_strlen($text);
        $charactersWithoutSpaces = mb_strlen(str_replace(' ', '', $text));
        $words = str_word_count($text);
        $sentences = preg_match_all('/[.!?]+/', $text);
        $paragraphs = count(array_filter(explode("\n\n", $text)));
        $lines = substr_count($text, "\n") + 1;

        $readingTime = round($words / 200, 2) . ' minutes';
        $speakingTime = round($words / 150, 2) . ' minutes';

        return $this->success([
            'characters' => $characters,
            'charactersWithoutSpaces' => $charactersWithoutSpaces,
            'words' => $words,
            'sentences' => $sentences,
            'paragraphs' => $paragraphs,
            'lines' => $lines,
            'readingTime' => $readingTime,
            'speakingTime' => $speakingTime
        ]);
    }

    public function regexTest(Request $request)
    {
        $request->validate([
            'pattern' => 'required|string',
            'text' => 'required|string',
            'flags' => 'sometimes|string'
        ]);

        $pattern = $request->input('pattern');
        $text = $request->input('text');
        $flags = $request->input('flags', 'g');

        try {
            $modifiers = '';
            if (strpos($flags, 'i') !== false) $modifiers .= 'i';
            if (strpos($flags, 'm') !== false) $modifiers .= 'm';
            if (strpos($flags, 's') !== false) $modifiers .= 's';

            $fullPattern = '/' . $pattern . '/' . $modifiers;

            preg_match_all($fullPattern, $text, $matches);

            return $this->success([
                'matches' => $matches[0] ?? [],
                'matchCount' => count($matches[0] ?? []),
                'isValid' => true
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function urlParse(Request $request)
    {
        $request->validate(['url' => 'required|string']);

        $url = $request->input('url');

        try {
            $parsed = parse_url($url);

            return $this->success([
                'protocol' => ($parsed['scheme'] ?? '') . ':',
                'host' => ($parsed['host'] ?? '') . (isset($parsed['port']) ? ':' . $parsed['port'] : ''),
                'hostname' => $parsed['host'] ?? '',
                'port' => $parsed['port'] ?? '',
                'pathname' => $parsed['path'] ?? '',
                'search' => isset($parsed['query']) ? '?' . $parsed['query'] : '',
                'hash' => isset($parsed['fragment']) ? '#' . $parsed['fragment'] : '',
                'username' => $parsed['user'] ?? '',
                'password' => $parsed['pass'] ?? '',
                'origin' => ($parsed['scheme'] ?? '') . '://' . ($parsed['host'] ?? '') . (isset($parsed['port']) ? ':' . $parsed['port'] : '')
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function loremIpsum(Request $request)
    {
        $request->validate([
            'count' => 'sometimes|integer|min:1|max:100',
            'unit' => 'sometimes|in:words,sentences,paragraphs',
            'startWithLorem' => 'sometimes|boolean'
        ]);

        $count = $request->input('count', 3);
        $unit = $request->input('unit', 'paragraphs');
        $startWithLorem = $request->input('startWithLorem', true);

        $loremStart = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
        $words = ["sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua"];

        try {
            $text = $startWithLorem ? $loremStart . " " : "";

            if ($unit === 'paragraphs') {
                for ($i = 0; $i < $count; $i++) {
                    $paragraph = [];
                    for ($j = 0; $j < 50; $j++) {
                        $paragraph[] = $words[array_rand($words)];
                    }
                    $text .= ucfirst(implode(' ', $paragraph)) . ".\n\n";
                }
            }

            return $this->success(['text' => trim($text)]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function emailNormalize(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $email = $request->input('email');

        try {
            list($localPart, $domain) = explode('@', $email);

            $localPart = explode('+', $localPart)[0];
            $normalized = strtolower($localPart . '@' . $domain);

            return $this->success([
                'normalized' => $normalized,
                'valid' => filter_var($normalized, FILTER_VALIDATE_EMAIL) !== false,
                'localPart' => $localPart,
                'domain' => strtolower($domain)
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function numeronym(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $text = $request->input('text');

        try {
            $length = strlen($text);
            $numeronym = $length > 2 ? $text[0] . ($length - 2) . $text[$length - 1] : $text;

            return $this->success([
                'numeronym' => $numeronym,
                'original' => $text,
                'length' => $length
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function textDiff(Request $request)
    {
        $request->validate([
            'text1' => 'required|string',
            'text2' => 'required|string',
            'ignoreWhitespace' => 'sometimes|boolean',
            'ignoreCase' => 'sometimes|boolean'
        ]);

        $text1 = $request->input('text1');
        $text2 = $request->input('text2');
        $ignoreWhitespace = $request->input('ignoreWhitespace', false);
        $ignoreCase = $request->input('ignoreCase', false);

        try {
            if ($ignoreWhitespace) {
                $text1 = preg_replace('/\s+/', ' ', $text1);
                $text2 = preg_replace('/\s+/', ' ', $text2);
            }

            if ($ignoreCase) {
                $text1 = strtolower($text1);
                $text2 = strtolower($text2);
            }

            $lines1 = explode("\n", $text1);
            $lines2 = explode("\n", $text2);

            $diff = $this->computeDiff($lines1, $lines2);

            return $this->success([
                'diff' => $diff,
                'hasDifferences' => count($diff) > 0
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function asciiArt(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'font' => 'sometimes|in:standard,banner,block'
        ]);

        $text = $request->input('text');
        $font = $request->input('font', 'standard');

        try {
            $art = $this->generateAsciiArt($text, $font);

            return $this->success([
                'art' => $art,
                'font' => $font
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function parseCrontab(Request $request)
    {
        $request->validate(['expression' => 'required|string']);

        $expression = $request->input('expression');

        try {
            $parts = preg_split('/\s+/', trim($expression));

            if (count($parts) < 5) {
                throw new \Exception('Invalid crontab expression');
            }

            $schedule = [
                'minute' => $parts[0],
                'hour' => $parts[1],
                'dayOfMonth' => $parts[2],
                'month' => $parts[3],
                'dayOfWeek' => $parts[4],
                'command' => isset($parts[5]) ? implode(' ', array_slice($parts, 5)) : ''
            ];

            $description = $this->describeCrontab($schedule);

            return $this->success([
                'schedule' => $schedule,
                'description' => $description,
                'isValid' => true
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function parsePhone(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'country' => 'sometimes|string'
        ]);

        $phone = $request->input('phone');
        $country = $request->input('country', 'US');

        try {
            $cleaned = preg_replace('/[^0-9+]/', '', $phone);

            $hasCountryCode = str_starts_with($cleaned, '+');
            $countryCode = $hasCountryCode ? substr($cleaned, 0, strpos($cleaned, ' ') ?: 2) : '';
            $nationalNumber = $hasCountryCode ? substr($cleaned, strlen($countryCode)) : $cleaned;

            $formatted = $this->formatPhoneNumber($nationalNumber, $country);

            return $this->success([
                'original' => $phone,
                'cleaned' => $cleaned,
                'countryCode' => $countryCode,
                'nationalNumber' => $nationalNumber,
                'formatted' => $formatted,
                'isValid' => strlen($cleaned) >= 10
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function validateIban(Request $request)
    {
        $request->validate(['iban' => 'required|string']);

        $iban = $request->input('iban');

        try {
            $iban = strtoupper(str_replace(' ', '', $iban));

            if (strlen($iban) < 15 || strlen($iban) > 34) {
                throw new \Exception('Invalid IBAN length');
            }

            $countryCode = substr($iban, 0, 2);
            $checkDigits = substr($iban, 2, 2);
            $bban = substr($iban, 4);

            $rearranged = $bban . $countryCode . $checkDigits;
            $numericString = '';

            for ($i = 0; $i < strlen($rearranged); $i++) {
                $char = $rearranged[$i];
                if (ctype_alpha($char)) {
                    $numericString .= (ord($char) - ord('A') + 10);
                } else {
                    $numericString .= $char;
                }
            }

            $mod = '';
            foreach (str_split($numericString) as $digit) {
                $mod = ($mod . $digit) % 97;
            }

            $isValid = $mod === 1;

            return $this->success([
                'iban' => $iban,
                'countryCode' => $countryCode,
                'checkDigits' => $checkDigits,
                'bban' => $bban,
                'isValid' => $isValid
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function encodeSafelink(Request $request)
    {
        $request->validate([
            'url' => 'required|url',
            'action' => 'required|in:encode,decode'
        ]);

        $url = $request->input('url');
        $action = $request->input('action');

        try {
            if ($action === 'encode') {
                $encoded = str_replace([':', '//', '.', '/', '?', '=', '&'], ['%3A', '%2F%2F', '%2E', '%2F', '%3F', '%3D', '%26'], $url);
                $result = $encoded;
            } else {
                $decoded = urldecode($url);
                $result = $decoded;
            }

            return $this->success([
                'original' => $url,
                'result' => $result,
                'action' => $action
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function emojiPicker(Request $request)
    {
        $request->validate([
            'search' => 'sometimes|string',
            'category' => 'sometimes|in:smileys,people,animals,food,travel,activities,objects,symbols,flags'
        ]);

        $search = $request->input('search', '');
        $category = $request->input('category', 'all');

        try {
            $emojis = $this->getEmojiList($category);

            if ($search) {
                $emojis = array_filter($emojis, function($emoji) use ($search) {
                    return stripos($emoji['name'], $search) !== false ||
                           stripos($emoji['keywords'], $search) !== false;
                });
            }

            return $this->success([
                'emojis' => array_values($emojis),
                'count' => count($emojis),
                'search' => $search,
                'category' => $category
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function generateGitMemo(Request $request)
    {
        $request->validate([
            'type' => 'required|in:feat,fix,docs,style,refactor,test,chore',
            'scope' => 'sometimes|string',
            'subject' => 'required|string',
            'body' => 'sometimes|string',
            'breaking' => 'sometimes|boolean'
        ]);

        $type = $request->input('type');
        $scope = $request->input('scope', '');
        $subject = $request->input('subject');
        $body = $request->input('body', '');
        $breaking = $request->input('breaking', false);

        try {
            $header = $type;
            if ($scope) {
                $header .= '(' . $scope . ')';
            }
            if ($breaking) {
                $header .= '!';
            }
            $header .= ': ' . $subject;

            $message = $header;
            if ($body) {
                $message .= "\n\n" . $body;
            }
            if ($breaking) {
                $message .= "\n\nBREAKING CHANGE: This is a breaking change";
            }

            return $this->success([
                'message' => $message,
                'header' => $header,
                'type' => $type,
                'scope' => $scope,
                'subject' => $subject
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    private function computeDiff(array $lines1, array $lines2): array
    {
        $diff = [];
        $maxLen = max(count($lines1), count($lines2));

        for ($i = 0; $i < $maxLen; $i++) {
            $line1 = $lines1[$i] ?? null;
            $line2 = $lines2[$i] ?? null;

            if ($line1 === $line2) {
                $diff[] = ['type' => 'equal', 'line' => $line1];
            } elseif ($line1 === null) {
                $diff[] = ['type' => 'added', 'line' => $line2];
            } elseif ($line2 === null) {
                $diff[] = ['type' => 'removed', 'line' => $line1];
            } else {
                $diff[] = ['type' => 'changed', 'from' => $line1, 'to' => $line2];
            }
        }

        return $diff;
    }

    private function generateAsciiArt(string $text, string $font): string
    {
        $art = '';
        foreach (str_split($text) as $char) {
            $art .= $this->getAsciiChar($char, $font) . "\n";
        }
        return trim($art);
    }

    private function getAsciiChar(string $char, string $font): string
    {
        if ($font === 'banner') {
            return strtoupper($char) . str_repeat('=', 5);
        } elseif ($font === 'block') {
            return '[' . strtoupper($char) . ']';
        }
        return '--- ' . $char . ' ---';
    }

    private function describeCrontab(array $schedule): string
    {
        $descriptions = [];

        if ($schedule['minute'] !== '*') {
            $descriptions[] = 'at minute ' . $schedule['minute'];
        }
        if ($schedule['hour'] !== '*') {
            $descriptions[] = 'at hour ' . $schedule['hour'];
        }
        if ($schedule['dayOfMonth'] !== '*') {
            $descriptions[] = 'on day ' . $schedule['dayOfMonth'];
        }
        if ($schedule['month'] !== '*') {
            $descriptions[] = 'in month ' . $schedule['month'];
        }
        if ($schedule['dayOfWeek'] !== '*') {
            $descriptions[] = 'on ' . $this->getDayName($schedule['dayOfWeek']);
        }

        return empty($descriptions) ? 'Every minute' : 'Runs ' . implode(', ', $descriptions);
    }

    private function getDayName(string $day): string
    {
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return is_numeric($day) ? $days[$day] ?? 'day ' . $day : $day;
    }

    private function formatPhoneNumber(string $number, string $country): string
    {
        if ($country === 'US' && strlen($number) === 10) {
            return '(' . substr($number, 0, 3) . ') ' . substr($number, 3, 3) . '-' . substr($number, 6);
        }
        return $number;
    }

    public function obfuscate(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'method' => 'sometimes|in:unicode,hex,rot13,base64,reverse'
        ]);

        $text = $request->input('text');
        $method = $request->input('method', 'unicode');

        try {
            $result = '';

            switch ($method) {
                case 'unicode':
                    for ($i = 0; $i < mb_strlen($text, 'UTF-8'); $i++) {
                        $char = mb_substr($text, $i, 1, 'UTF-8');
                        $code = mb_ord($char, 'UTF-8');
                        $result .= '\\u' . str_pad(dechex($code), 4, '0', STR_PAD_LEFT);
                    }
                    break;

                case 'hex':
                    for ($i = 0; $i < strlen($text); $i++) {
                        $result .= '\\x' . str_pad(dechex(ord($text[$i])), 2, '0', STR_PAD_LEFT);
                    }
                    break;

                case 'rot13':
                    $result = str_rot13($text);
                    break;

                case 'base64':
                    $result = base64_encode($text);
                    break;

                case 'reverse':
                    $result = strrev($text);
                    break;

                default:
                    $result = $text;
            }

            return $this->success([
                'original' => $text,
                'obfuscated' => $result,
                'method' => $method,
                'length' => strlen($result)
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    private function getEmojiList(string $category): array
    {
        return [
            ['emoji' => '😀', 'name' => 'grinning face', 'keywords' => 'happy smile', 'category' => 'smileys'],
            ['emoji' => '😁', 'name' => 'beaming face', 'keywords' => 'smile happy', 'category' => 'smileys'],
            ['emoji' => '😂', 'name' => 'tears of joy', 'keywords' => 'laugh funny', 'category' => 'smileys'],
            ['emoji' => '🤣', 'name' => 'rolling on floor', 'keywords' => 'laugh funny', 'category' => 'smileys'],
            ['emoji' => '😊', 'name' => 'smiling face', 'keywords' => 'happy smile', 'category' => 'smileys'],
            ['emoji' => '👍', 'name' => 'thumbs up', 'keywords' => 'like approve', 'category' => 'people'],
            ['emoji' => '👎', 'name' => 'thumbs down', 'keywords' => 'dislike disapprove', 'category' => 'people'],
            ['emoji' => '👋', 'name' => 'waving hand', 'keywords' => 'hello hi', 'category' => 'people'],
            ['emoji' => '🐶', 'name' => 'dog', 'keywords' => 'pet animal', 'category' => 'animals'],
            ['emoji' => '🐱', 'name' => 'cat', 'keywords' => 'pet animal', 'category' => 'animals'],
            ['emoji' => '🍕', 'name' => 'pizza', 'keywords' => 'food italian', 'category' => 'food'],
            ['emoji' => '🍔', 'name' => 'hamburger', 'keywords' => 'food burger', 'category' => 'food'],
            ['emoji' => '🚀', 'name' => 'rocket', 'keywords' => 'space launch', 'category' => 'travel'],
            ['emoji' => '⚽', 'name' => 'soccer ball', 'keywords' => 'sport football', 'category' => 'activities'],
            ['emoji' => '🎉', 'name' => 'party popper', 'keywords' => 'celebrate party', 'category' => 'objects'],
            ['emoji' => '❤️', 'name' => 'red heart', 'keywords' => 'love like', 'category' => 'symbols'],
            ['emoji' => '🇺🇸', 'name' => 'us flag', 'keywords' => 'america usa', 'category' => 'flags']
        ];
    }
}
