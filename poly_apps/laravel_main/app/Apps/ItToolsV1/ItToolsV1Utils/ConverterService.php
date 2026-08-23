<?php

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

use Exception;

class ConverterService
{
    /**
     * Base64 encode
     *
     * @param string $text
     * @return array
     */
    public static function base64Encode(string $text): array
    {
        return [
            'original' => $text,
            'encoded' => base64_encode($text),
            'length' => strlen($text),
            'encodedLength' => strlen(base64_encode($text))
        ];
    }

    /**
     * Base64 decode
     *
     * @param string $text
     * @return array
     * @throws Exception
     */
    public static function base64Decode(string $text): array
    {
        $decoded = base64_decode($text, true);
        if ($decoded === false) {
            throw new Exception("Invalid base64 string");
        }

        return [
            'original' => $text,
            'decoded' => $decoded,
            'length' => strlen($text),
            'decodedLength' => strlen($decoded)
        ];
    }

    /**
     * URL encode
     *
     * @param string $text
     * @return array
     */
    public static function urlEncode(string $text): array
    {
        return [
            'original' => $text,
            'encoded' => urlencode($text),
            'encoded_rfc3986' => rawurlencode($text),
            'length' => strlen($text)
        ];
    }

    /**
     * URL decode
     *
     * @param string $text
     * @return array
     */
    public static function urlDecode(string $text): array
    {
        return [
            'original' => $text,
            'decoded' => urldecode($text),
            'decoded_rfc3986' => rawurldecode($text),
            'length' => strlen($text)
        ];
    }

    /**
     * Change text case
     *
     * @param string $text
     * @param string $case
     * @return array
     * @throws Exception
     */
    public static function changeCase(string $text, string $case = 'lowercase'): array
    {
        $cases = ['lowercase', 'uppercase', 'capitalize', 'title', 'sentence', 'toggle'];

        if (!in_array($case, $cases)) {
            throw new Exception("Invalid case. Must be one of: " . implode(', ', $cases));
        }

        $result = match ($case) {
            'lowercase' => strtolower($text),
            'uppercase' => strtoupper($text),
            'capitalize' => ucfirst(strtolower($text)),
            'title' => ucwords($text),
            'sentence' => ucfirst(strtolower($text)) . '.',
            'toggle' => $this->toggleCase($text),
            default => $text
        };

        return [
            'original' => $text,
            'case' => $case,
            'result' => $result
        ];
    }

    /**
     * Toggle text case
     *
     * @param string $text
     * @return string
     */
    private static function toggleCase(string $text): string
    {
        $result = '';
        for ($i = 0; $i < strlen($text); $i++) {
            $char = $text[$i];
            $result .= (ctype_upper($char)) ? strtolower($char) : strtoupper($char);
        }
        return $result;
    }

    /**
     * Convert between number bases
     *
     * @param string $value
     * @param int $fromBase
     * @param int $toBase
     * @return array
     * @throws Exception
     */
    public static function convertBase(string $value, int $fromBase = 10, int $toBase = 16): array
    {
        if ($fromBase < 2 || $fromBase > 36 || $toBase < 2 || $toBase > 36) {
            throw new Exception("Base must be between 2 and 36");
        }

        try {
            $decimal = intval($value, $fromBase);
            $converted = base_convert($value, $fromBase, $toBase);

            return [
                'original' => $value,
                'fromBase' => $fromBase,
                'toBase' => $toBase,
                'result' => $converted,
                'decimal' => $decimal
            ];
        } catch (Exception $e) {
            throw new Exception("Invalid conversion: " . $e->getMessage());
        }
    }

    /**
     * Convert temperature
     *
     * @param float $value
     * @param string $from
     * @param string $to
     * @return array
     * @throws Exception
     */
    public static function convertTemperature(float $value, string $from = 'celsius', string $to = 'fahrenheit'): array
    {
        $units = ['celsius', 'fahrenheit', 'kelvin'];

        if (!in_array($from, $units) || !in_array($to, $units)) {
            throw new Exception("Invalid unit. Must be one of: " . implode(', ', $units));
        }

        // Convert to Celsius first
        if ($from === 'fahrenheit') {
            $celsius = ($value - 32) * 5 / 9;
        } elseif ($from === 'kelvin') {
            $celsius = $value - 273.15;
        } else {
            $celsius = $value;
        }

        // Convert to target unit
        $result = match ($to) {
            'fahrenheit' => ($celsius * 9 / 5) + 32,
            'kelvin' => $celsius + 273.15,
            default => $celsius
        };

        return [
            'original' => $value,
            'from' => $from,
            'to' => $to,
            'result' => round($result, 2)
        ];
    }

    /**
     * Convert color between formats
     *
     * @param string $color
     * @param string $fromFormat
     * @param string $toFormat
     * @return array
     * @throws Exception
     */
    public static function convertColor(string $color, string $fromFormat = 'hex', string $toFormat = 'rgb'): array
    {
        $formats = ['hex', 'rgb', 'hsl'];

        if (!in_array($fromFormat, $formats) || !in_array($toFormat, $formats)) {
            throw new Exception("Invalid format. Must be one of: " . implode(', ', $formats));
        }

        // First convert to RGB
        if ($fromFormat === 'hex') {
            $rgb = self::hexToRgb($color);
        } elseif ($fromFormat === 'rgb') {
            $rgb = self::parseRgb($color);
        } else { // hsl
            $rgb = self::hslToRgb($color);
        }

        // Then convert to target format
        $result = match ($toFormat) {
            'hex' => self::rgbToHex($rgb),
            'rgb' => self::rgbToString($rgb),
            'hsl' => self::rgbToHsl($rgb),
            default => $color
        };

        return [
            'original' => $color,
            'fromFormat' => $fromFormat,
            'toFormat' => $toFormat,
            'result' => $result
        ];
    }

    /**
     * Convert HEX to RGB
     */
    private static function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        return [
            'r' => hexdec(substr($hex, 0, 2)),
            'g' => hexdec(substr($hex, 2, 2)),
            'b' => hexdec(substr($hex, 4, 2))
        ];
    }

    /**
     * Convert RGB to HEX
     */
    private static function rgbToHex(array $rgb): string
    {
        return '#' . str_pad(dechex($rgb['r']), 2, '0', STR_PAD_LEFT) .
               str_pad(dechex($rgb['g']), 2, '0', STR_PAD_LEFT) .
               str_pad(dechex($rgb['b']), 2, '0', STR_PAD_LEFT);
    }

    /**
     * Parse RGB string
     */
    private static function parseRgb(string $rgb): array
    {
        preg_match('/\d+/', $rgb, $matches);
        $values = explode(',', str_replace(['rgb(', 'rgba(', ')'], '', $rgb));

        return [
            'r' => (int)trim($values[0]),
            'g' => (int)trim($values[1]),
            'b' => (int)trim($values[2])
        ];
    }

    /**
     * RGB to string format
     */
    private static function rgbToString(array $rgb): string
    {
        return "rgb({$rgb['r']}, {$rgb['g']}, {$rgb['b']})";
    }

    /**
     * Convert HSL to RGB
     */
    private static function hslToRgb(string $hsl): array
    {
        preg_match('/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/', $hsl, $matches);
        $h = $matches[1] / 360;
        $s = $matches[2] / 100;
        $l = $matches[3] / 100;

        if ($s === 0) {
            $r = $g = $b = $l;
        } else {
            $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
            $p = 2 * $l - $q;
            $r = self::hslToRgbChannel($p, $q, $h + 1/3);
            $g = self::hslToRgbChannel($p, $q, $h);
            $b = self::hslToRgbChannel($p, $q, $h - 1/3);
        }

        return [
            'r' => (int)round($r * 255),
            'g' => (int)round($g * 255),
            'b' => (int)round($b * 255)
        ];
    }

    private static function hslToRgbChannel(float $p, float $q, float $t): float
    {
        if ($t < 0) $t += 1;
        if ($t > 1) $t -= 1;
        if ($t < 1/6) return $p + ($q - $p) * 6 * $t;
        if ($t < 1/2) return $q;
        if ($t < 2/3) return $p + ($q - $p) * (2/3 - $t) * 6;
        return $p;
    }

    /**
     * Convert RGB to HSL
     */
    private static function rgbToHsl(array $rgb): string
    {
        $r = $rgb['r'] / 255;
        $g = $rgb['g'] / 255;
        $b = $rgb['b'] / 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;

        if ($max === $min) {
            $h = $s = 0;
        } else {
            $d = $max - $min;
            $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);

            if ($max === $r) {
                $h = (($g - $b) / $d + ($g < $b ? 6 : 0)) / 6;
            } elseif ($max === $g) {
                $h = (($b - $r) / $d + 2) / 6;
            } else {
                $h = (($r - $g) / $d + 4) / 6;
            }
        }

        return sprintf('hsl(%d, %d%%, %d%%)', round($h * 360), round($s * 100), round($l * 100));
    }

    public static function arrayToYaml($data, $indent = 0)
    {
        $yaml = '';
        $spaces = str_repeat('  ', $indent);

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $yaml .= $spaces . $key . ":\n" . self::arrayToYaml($value, $indent + 1);
            } else {
                $yaml .= $spaces . $key . ': ' . $value . "\n";
            }
        }

        return $yaml;
    }

    public static function yamlToArray($yaml)
    {
        $lines = explode("\n", trim($yaml));
        $data = [];
        $currentPath = [];

        foreach ($lines as $line) {
            if (trim($line) === '' || strpos($line, '#') === 0) continue;

            preg_match('/^(\s*)(.+?):(.*)$/', $line, $matches);
            if ($matches) {
                $indent = strlen($matches[1]) / 2;
                $key = trim($matches[2]);
                $value = trim($matches[3]);

                if ($value === '') {
                    $currentPath[$indent] = $key;
                } else {
                    $data[$key] = $value;
                }
            }
        }

        return $data;
    }


    public static function arrayToXml($data, $rootElement = 'root', $xml = null)
    {
        if ($xml === null) {
            $xml = new \SimpleXMLElement('<?xml version="1.0"?><' . $rootElement . '></' . $rootElement . '>');
        }

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $subnode = $xml->addChild($key);
                self::arrayToXml($value, $key, $subnode);
            } else {
                $xml->addChild($key, htmlspecialchars($value));
            }
        }

        return $xml->asXML();
    }

    public static function arrayToToml($data, $indent = 0)
    {
        $toml = '';
        $spaces = str_repeat('  ', $indent);

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                if ($indent === 0) {
                    $toml .= "\n[{$key}]\n";
                }
                $toml .= self::arrayToToml($value, $indent + 1);
            } else {
                $toml .= $spaces . $key . ' = ' . self::formatTomlValue($value) . "\n";
            }
        }

        return $toml;
    }

    public static function formatTomlValue($value)
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        } elseif (is_numeric($value)) {
            return $value;
        } elseif (is_string($value)) {
            return '"' . addslashes($value) . '"';
        }
        return '""';
    }

    public static function tomlToArray($toml)
    {
        $data = [];
        $lines = explode("\n", $toml);
        $currentSection = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            if (preg_match('/^\[(.+)\]$/', $line, $matches)) {
                $currentSection = $matches[1];
                if (!isset($data[$currentSection])) {
                    $data[$currentSection] = [];
                }
            } elseif (preg_match('/^(.+?)\s*=\s*(.+)$/', $line, $matches)) {
                $key = trim($matches[1]);
                $value = trim($matches[2]);
                $parsedValue = self::parseTomlValue($value);

                if ($currentSection) {
                    $data[$currentSection][$key] = $parsedValue;
                } else {
                    $data[$key] = $parsedValue;
                }
            }
        }

        return $data;
    }

    public static function parseTomlValue($value)
    {
        $value = trim($value);
        if ($value === 'true') return true;
        if ($value === 'false') return false;
        if (is_numeric($value)) return $value + 0;
        if (preg_match('/^"(.*)"$/', $value, $matches)) {
            return stripslashes($matches[1]);
        }
        return $value;
    }

    public static function detectMimeType(string $data): string
    {
        $fileInfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_buffer($fileInfo, $data);
        finfo_close($fileInfo);

        return $mimeType ?: 'application/octet-stream';
    }
}
