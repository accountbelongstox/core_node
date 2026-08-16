<?php

/**
 * Polyfill for mb_split and mb_ereg functions removed in PHP 8.4
 *
 * mb_split, mb_ereg, mb_eregi, mb_ereg_replace were deprecated in PHP 7.3 and removed in PHP 8.4
 * The official replacement is to use preg_split, preg_match, preg_replace with the 'u' modifier
 *
 * @link https://www.php.net/manual/en/migration80.deprecated.php
 * @link https://wiki.php.net/rfc/deprecate_mb_ereg_replace_eval_option
 */

if (!function_exists('mb_split')) {
    /**
     * Split multibyte string using regular expression
     *
     * REPLACEMENT: Use preg_split() with 'u' modifier instead
     * Example: preg_split('/pattern/u', $string, $limit)
     *
     * @param string $pattern The regular expression pattern
     * @param string $string The string being split
     * @param int $limit Maximum number of elements in the resulting array
     * @return array|false Returns an array of strings or false on failure
     */
    function mb_split(string $pattern, string $string, int $limit = -1): array|false
    {
        // Convert mb_ereg pattern to PCRE pattern
        // mb_ereg uses POSIX regex, PCRE uses different syntax
        // For simple patterns like '_' or ',', they are the same

        // Escape pattern for PCRE (if not already a regex pattern)
        $pcrePattern = '/' . preg_quote($pattern, '/') . '/u';

        $result = preg_split($pcrePattern, $string, $limit);

        return $result !== false ? $result : false;
    }
}

if (!function_exists('mb_ereg')) {
    /**
     * Regular expression match with multibyte support
     *
     * REPLACEMENT: Use preg_match() with 'u' modifier instead
     * Example: preg_match('/pattern/u', $string, $matches)
     *
     * @param string $pattern The pattern to search for
     * @param string $string The input string
     * @param array|null $matches If provided, will be filled with match results
     * @return bool Returns true if pattern matches, false otherwise
     */
    function mb_ereg(string $pattern, string $string, ?array &$matches = null): bool
    {
        // Convert POSIX pattern to PCRE with UTF-8 support
        $pcrePattern = '/' . $pattern . '/u';

        if ($matches !== null) {
            $result = preg_match($pcrePattern, $string, $matches);
        } else {
            $result = preg_match($pcrePattern, $string);
        }

        return $result === 1;
    }
}

if (!function_exists('mb_eregi')) {
    /**
     * Case insensitive regular expression match with multibyte support
     *
     * REPLACEMENT: Use preg_match() with 'ui' modifiers instead
     * Example: preg_match('/pattern/ui', $string, $matches)
     *
     * @param string $pattern The pattern to search for
     * @param string $string The input string
     * @param array|null $matches If provided, will be filled with match results
     * @return bool Returns true if pattern matches, false otherwise
     */
    function mb_eregi(string $pattern, string $string, ?array &$matches = null): bool
    {
        // Convert POSIX pattern to PCRE with UTF-8 and case-insensitive support
        $pcrePattern = '/' . $pattern . '/ui';

        if ($matches !== null) {
            $result = preg_match($pcrePattern, $string, $matches);
        } else {
            $result = preg_match($pcrePattern, $string);
        }

        return $result === 1;
    }
}

if (!function_exists('mb_ereg_replace')) {
    /**
     * Replace regular expression with multibyte support
     *
     * REPLACEMENT: Use preg_replace() with 'u' modifier instead
     * Example: preg_replace('/pattern/u', $replacement, $string)
     *
     * @param string $pattern The pattern to search for
     * @param string $replacement The replacement string
     * @param string $string The input string
     * @param string|null $options Optional flags (e.g., 'i' for case-insensitive)
     * @return string|false|null The resulting string, or false on error
     */
    function mb_ereg_replace(string $pattern, string $replacement, string $string, ?string $options = null): string|false|null
    {
        // Build PCRE pattern with UTF-8 support
        $modifiers = 'u';

        if ($options !== null) {
            if (strpos($options, 'i') !== false) {
                $modifiers .= 'i';
            }
            if (strpos($options, 'm') !== false) {
                $modifiers .= 'm';
            }
            if (strpos($options, 's') !== false) {
                $modifiers .= 's';
            }
        }

        $pcrePattern = '/' . $pattern . '/' . $modifiers;

        return preg_replace($pcrePattern, $replacement, $string);
    }
}

if (!function_exists('mb_eregi_replace')) {
    /**
     * Case insensitive replace regular expression with multibyte support
     *
     * REPLACEMENT: Use preg_replace() with 'ui' modifiers instead
     * Example: preg_replace('/pattern/ui', $replacement, $string)
     *
     * @param string $pattern The pattern to search for
     * @param string $replacement The replacement string
     * @param string $string The input string
     * @param string|null $options Optional flags
     * @return string|false|null The resulting string, or false on error
     */
    function mb_eregi_replace(string $pattern, string $replacement, string $string, ?string $options = null): string|false|null
    {
        $modifiers = 'ui'; // UTF-8 + case-insensitive

        if ($options !== null) {
            if (strpos($options, 'm') !== false) {
                $modifiers .= 'm';
            }
            if (strpos($options, 's') !== false) {
                $modifiers .= 's';
            }
        }

        $pcrePattern = '/' . $pattern . '/' . $modifiers;

        return preg_replace($pcrePattern, $replacement, $string);
    }
}
