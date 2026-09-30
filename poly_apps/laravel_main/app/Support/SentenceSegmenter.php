<?php

namespace App\Support;

use RuntimeException;

/**
 * Laravel adapter of the shared sentence segmentation.
 *
 * Source of truth: config/sentence_segmentation_contract.json (rules, abbreviations,
 * speakable thresholds, timing constants and the test vectors).
 * Aligned adapters:
 * - pycore/pyfoundations/sentence_segmenter.py
 * - poly_apps/pycore_laravel_wordnew_ui/core/contracts/SentenceSegmenter.ts
 *
 * No controller, service or parser may cut text into sentences on its own (a
 * preg_split on ". ! ?" breaks decimals, IPs, file names and abbreviations). A
 * rule changes in the JSON first and every adapter must pass every vector.
 * Nothing here rewrites text: a sentence is a slice of the input with runs of
 * whitespace collapsed; ``clean`` is the explicit clean-up for spoken text.
 */
final class SentenceSegmenter
{
    private const HEADING_MAX_LEVEL = 6;

    private static ?array $config = null;

    public static function contractPath(): string
    {
        return dirname(dirname(base_path())).DIRECTORY_SEPARATOR.'config'.DIRECTORY_SEPARATOR.'sentence_segmentation_contract.json';
    }

    /**
     * @return string[] sentences of $text; $speakable cleans markdown and drops what
     *                  would be read as noise, $maxChars cuts a longer sentence at
     *                  clause breaks then spaces, $minChars / $maxSentences bound it
     */
    public static function split(
        string $text,
        bool $speakable = false,
        int $minChars = 0,
        int $maxChars = 0,
        int $maxSentences = 0
    ): array {
        $sentences = [];
        foreach (self::blocks($text) as $block) {
            foreach (self::scan($block) as $sentence) {
                $sentences[] = $sentence;
            }
        }
        if ($speakable) {
            $sentences = self::speakableOnly($sentences);
        }
        if ($maxChars > 0) {
            $cut = [];
            foreach ($sentences as $sentence) {
                foreach (self::cutLong($sentence, $maxChars) as $piece) {
                    $cut[] = $piece;
                }
            }
            $sentences = $cut;
        }
        if ($minChars > 0) {
            $sentences = array_values(array_filter(
                $sentences,
                static fn (string $sentence): bool => mb_strlen($sentence) >= $minChars
            ));
        }
        if ($maxSentences > 0) {
            $sentences = array_slice($sentences, 0, $maxSentences);
        }

        return $sentences;
    }

    /** One list / heading / quote marker and the emphasis marks removed. */
    public static function clean(string $text): string
    {
        $text = self::strip($text);
        $text = mb_substr($text, self::markerLength($text));
        foreach (self::config()['emphasis'] as $marker) {
            $text = str_replace($marker, '', $text);
        }

        return self::collapse($text);
    }

    /** False for a fragment (too few letters) or text that is mostly code symbols. */
    public static function isSpeakable(string $text): bool
    {
        $config = self::config();
        $letters = preg_match_all('/\p{L}/u', $text);
        if ($letters < $config['min_letters']) {
            return false;
        }
        $symbols = 0;
        foreach (self::chars($text) as $char) {
            if (isset($config['code_symbols'][$char])) {
                $symbols++;
            }
        }

        return $symbols / max(1, mb_strlen($text)) < $config['max_symbol_ratio'];
    }

    /** Rough spoken duration of $text, without the gap between clips. */
    public static function estimateSeconds(string $text, string $language = 'en'): float
    {
        $config = self::config();
        if (trim($text) === '') {
            return 0.0;
        }
        $language = strtolower($language);
        foreach ($config['chars_languages'] as $prefix) {
            if (str_starts_with($language, $prefix)) {
                return mb_strlen($text) / $config['zh_chars_per_second'];
            }
        }
        $words = count(preg_split('/\s+/u', self::strip($text), -1, PREG_SPLIT_NO_EMPTY) ?: []);

        return max(1, $words) / $config['en_words_per_second'];
    }

    public static function sentenceGapSeconds(): float
    {
        return self::config()['sentence_gap_seconds'];
    }

    public static function isCjk(string $char): bool
    {
        $code = mb_ord($char);
        foreach (self::config()['cjk'] as [$low, $high]) {
            if ($code >= $low && $code <= $high) {
                return true;
            }
        }

        return false;
    }

    // ---------------------------------------------------------------- blocks

    private static function markerLength(string $line): int
    {
        $config = self::config();
        foreach ($config['list_prefixes'] as $prefix) {
            if (str_starts_with($line, $prefix.' ')) {
                return mb_strlen($prefix) + 1;
            }
        }
        $digits = 0;
        $length = strlen($line);
        while ($digits < $length && $line[$digits] >= '0' && $line[$digits] <= '9') {
            $digits++;
        }
        if ($digits > 0 && $digits <= $config['numbered_max_digits']) {
            foreach ($config['numbered_suffixes'] as $suffix) {
                if (substr($line, $digits, strlen($suffix) + 1) === $suffix.' ') {
                    return $digits + strlen($suffix) + 1;
                }
            }
        }
        $quote = $config['quote_marker'];
        if (str_starts_with($line, $quote)) {
            $count = 0;
            while (substr($line, $count, strlen($quote)) === $quote) {
                $count += strlen($quote);
            }

            return substr($line, $count, 1) === ' ' ? $count + 1 : 0;
        }
        if (self::isHeading($line)) {
            return (int) strpos($line, ' ') + 1;
        }

        return 0;
    }

    private static function isHeading(string $line): bool
    {
        $marker = self::config()['heading_marker'];
        $hashes = 0;
        while (substr($line, $hashes * strlen($marker), strlen($marker)) === $marker) {
            $hashes++;
        }

        return $hashes > 0 && $hashes <= self::HEADING_MAX_LEVEL && substr($line, $hashes * strlen($marker), 1) === ' ';
    }

    /** @return string[] */
    private static function blocks(string $text): array
    {
        $blocks = [];
        $current = [];
        foreach (preg_split('/\r\n|\r|\n/', $text) ?: [] as $raw) {
            $line = self::strip($raw);
            if ($line === '') {
                if ($current !== []) {
                    $blocks[] = $current;
                }
                $current = [];
                continue;
            }
            if (self::markerLength($line) > 0 && $current !== []) {
                $blocks[] = $current;
                $current = [];
            }
            $current[] = $line;
            if (self::isHeading($line)) {
                $blocks[] = $current;
                $current = [];
            }
        }
        if ($current !== []) {
            $blocks[] = $current;
        }

        return array_map(static fn (array $block): string => implode(' ', $block), $blocks);
    }

    // --------------------------------------------------------------- scanner

    /** @return string[] */
    private static function scan(string $block): array
    {
        $config = self::config();
        $chars = self::chars($block);
        $length = count($chars);
        $sentences = [];
        $start = 0;
        $index = 0;
        while ($index < $length) {
            if (!isset($config['terminals'][$chars[$index]])) {
                $index++;
                continue;
            }
            $runEnd = $index;
            while ($runEnd < $length && isset($config['terminals'][$chars[$runEnd]])) {
                $runEnd++;
            }
            $end = $runEnd;
            while ($end < $length && isset($config['closers'][$chars[$end]])) {
                $end++;
            }
            if (self::endsSentence($chars, $start, $index, $runEnd, $end)) {
                $sentences[] = self::collapse(implode('', array_slice($chars, $start, $end - $start)));
                $start = $end;
            }
            $index = $end;
        }
        $rest = self::collapse(implode('', array_slice($chars, $start)));
        if ($rest !== '') {
            $sentences[] = $rest;
        }

        return array_values(array_filter($sentences, static fn (string $sentence): bool => $sentence !== ''));
    }

    /** @param string[] $chars */
    private static function endsSentence(array $chars, int $start, int $runStart, int $runEnd, int $end): bool
    {
        $config = self::config();
        $run = array_slice($chars, $runStart, $runEnd - $runStart);
        foreach ($run as $char) {
            if (isset($config['native_terminals'][$char])) {
                return true;
            }
        }
        $following = $chars[$end] ?? '';
        if ($following !== '' && !self::isSpace($following) && !self::isCjk($following)) {
            return false;
        }
        if (!isset($config['period_like'][$run[0]]) || $following === '') {
            return true;
        }
        $tail = self::ltrimSpaces(implode('', array_slice($chars, $end)));
        $next = mb_substr($tail, 0, 1);
        if ($next !== '' && self::isLower($next)) {
            return false;
        }
        if (implode('', $run) !== '.') {
            return true;
        }
        $head = implode('', array_slice($chars, $start, $runStart - $start));
        $tokens = explode(' ', $head);
        $token = self::ltrimChars((string) end($tokens), $config['openers']);
        if (in_array(mb_strtolower($token), $config['abbreviations'], true)) {
            return false;
        }
        if (mb_strlen($token) === 1 && self::isAlpha($token) && self::isUpper($token)) {
            return false;
        }
        $parts = explode('.', $token);
        if (count($parts) >= 2) {
            $dotted = true;
            foreach ($parts as $part) {
                if (mb_strlen($part) !== 1 || !self::isAlpha($part)) {
                    $dotted = false;
                    break;
                }
            }
            if ($dotted) {
                return false;
            }
        }
        if (preg_match('/^[0-9]{1,2}$/', $token) === 1 && self::strip($head) === $token) {
            return false;
        }

        return true;
    }

    // ------------------------------------------------------ speech and length

    /**
     * @param string[] $sentences
     * @return string[]
     */
    private static function speakableOnly(array $sentences): array
    {
        $kept = [];
        foreach ($sentences as $sentence) {
            if (!self::isSpeakable($sentence)) {
                continue;
            }
            $cleaned = self::clean($sentence);
            if (self::isSpeakable($cleaned)) {
                $kept[] = $cleaned;
            }
        }

        return $kept;
    }

    /** @return string[] */
    private static function cutLong(string $sentence, int $maxChars): array
    {
        $pieces = [];
        $rest = $sentence;
        while (mb_strlen($rest) > $maxChars) {
            $cut = self::cutPosition($rest, $maxChars);
            $pieces[] = self::strip(mb_substr($rest, 0, $cut));
            $rest = self::strip(mb_substr($rest, $cut));
        }
        if ($rest !== '') {
            $pieces[] = $rest;
        }

        return array_values(array_filter($pieces, static fn (string $piece): bool => $piece !== ''));
    }

    private static function cutPosition(string $text, int $maxChars): int
    {
        $config = self::config();
        $chars = self::chars($text);
        $length = count($chars);
        $clause = 0;
        for ($position = 0; $position < min($length, $maxChars); $position++) {
            if (isset($config['clause_breaks'][$chars[$position]])
                && ($position + 1 === $length || $chars[$position + 1] === ' ')) {
                $clause = $position + 1;
            }
        }
        if ($clause > 0) {
            return $clause;
        }
        $space = mb_strrpos(mb_substr($text, 0, $maxChars + 1), ' ');

        return ($space !== false && $space > 0) ? $space : $maxChars;
    }

    // ---------------------------------------------------------------- helpers

    /** @return string[] one entry per character (UTF-8 safe) */
    private static function chars(string $text): array
    {
        return preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }

    private static function isSpace(string $char): bool
    {
        return preg_match('/^\s$/u', $char) === 1;
    }

    private static function isAlpha(string $char): bool
    {
        return preg_match('/^\p{L}$/u', $char) === 1;
    }

    private static function isLower(string $char): bool
    {
        return mb_strtolower($char) === $char && mb_strtoupper($char) !== $char;
    }

    private static function isUpper(string $char): bool
    {
        return mb_strtoupper($char) === $char && mb_strtolower($char) !== $char;
    }

    private static function strip(string $text): string
    {
        return (string) preg_replace('/^\s+|\s+$/u', '', $text);
    }

    private static function ltrimSpaces(string $text): string
    {
        return (string) preg_replace('/^\s+/u', '', $text);
    }

    private static function collapse(string $text): string
    {
        return self::strip((string) preg_replace('/\s+/u', ' ', $text));
    }

    /** @param array<string,true> $chars */
    private static function ltrimChars(string $text, array $chars): string
    {
        while ($text !== '' && isset($chars[mb_substr($text, 0, 1)])) {
            $text = mb_substr($text, 1);
        }

        return $text;
    }

    /** @return array<string,mixed> the contract prepared for the scanner */
    private static function config(): array
    {
        if (self::$config !== null) {
            return self::$config;
        }
        $json = file_get_contents(self::contractPath());
        $contract = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($contract)) {
            throw new RuntimeException('Unable to load the sentence segmentation contract: '.self::contractPath());
        }
        $set = static fn (string $characters): array => array_fill_keys(self::chars($characters), true);
        $markers = $contract['block_markers'];
        $speakable = $contract['speakable'];
        $timing = $contract['timing'];
        self::$config = [
            'terminals' => $set($contract['terminals'].$contract['ellipsis']),
            'period_like' => $set($contract['period_like']),
            'native_terminals' => $set($contract['native_terminals']),
            'closers' => $set($contract['closers']),
            'openers' => $set($contract['openers']),
            'cjk' => array_map(static fn (array $range): array => [hexdec($range[0]), hexdec($range[1])], $contract['cjk_ranges']),
            'abbreviations' => $contract['abbreviations'],
            'list_prefixes' => $markers['list_prefixes'],
            'numbered_max_digits' => (int) $markers['numbered_max_digits'],
            'numbered_suffixes' => $markers['numbered_suffixes'],
            'heading_marker' => (string) $markers['heading_marker'],
            'quote_marker' => (string) $markers['quote_marker'],
            'clause_breaks' => $set($contract['long_sentence']['clause_breaks']),
            'min_letters' => (int) $speakable['min_letters'],
            'code_symbols' => $set($speakable['code_symbols']),
            'max_symbol_ratio' => (float) $speakable['max_code_symbol_ratio'],
            'emphasis' => $speakable['emphasis_markers'],
            'en_words_per_second' => (float) $timing['en_words_per_second'],
            'zh_chars_per_second' => (float) $timing['zh_chars_per_second'],
            'sentence_gap_seconds' => (float) $timing['sentence_gap_seconds'],
            'chars_languages' => $timing['chars_language_prefixes'],
        ];

        return self::$config;
    }
}
