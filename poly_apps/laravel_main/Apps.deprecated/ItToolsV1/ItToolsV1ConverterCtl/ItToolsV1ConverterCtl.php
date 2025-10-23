<?php

namespace App\Apps\ItToolsV1\ItToolsV1ConverterCtl;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Apps\ItToolsV1\ItToolsV1Utils\ResponseHelper;
use App\Apps\ItToolsV1\ItToolsV1Gvar\Constants;

class ItToolsV1ConverterCtl extends Controller
{
    public function base64Encode(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $encoded = base64_encode($request->input('text'));

        return ResponseHelper::success(['encoded' => $encoded]);
    }

    public function base64Decode(Request $request)
    {
        $request->validate(['encoded' => 'required|string']);

        try {
            $decoded = base64_decode($request->input('encoded'), true);

            if ($decoded === false) {
                throw new \Exception('Invalid base64 string');
            }

            return ResponseHelper::success(['decoded' => $decoded]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function convertCase(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $text = $request->input('text');

        $toCamelCase = function($str) {
            return lcfirst(str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $str))));
        };

        $toPascalCase = function($str) {
            return str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $str)));
        };

        $toSnakeCase = function($str) {
            return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', str_replace(['-', ' '], '_', $str)));
        };

        $toKebabCase = function($str) {
            return strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', str_replace(['_', ' '], '-', $str)));
        };

        $toTitleCase = function($str) {
            return ucwords(strtolower(str_replace(['-', '_'], ' ', $str)));
        };

        return ResponseHelper::success([
            'camelCase' => $toCamelCase($text),
            'PascalCase' => $toPascalCase($text),
            'snake_case' => $toSnakeCase($text),
            'kebab-case' => $toKebabCase($text),
            'SCREAMING_SNAKE_CASE' => strtoupper($toSnakeCase($text)),
            'lowercase' => strtolower($text),
            'UPPERCASE' => strtoupper($text),
            'Title Case' => $toTitleCase($text)
        ]);
    }

    public function urlEncode(Request $request)
    {
        $request->validate(['url' => 'required|string']);

        $encoded = urlencode($request->input('url'));

        return ResponseHelper::success(['encoded' => $encoded]);
    }

    public function urlDecode(Request $request)
    {
        $request->validate(['encoded' => 'required|string']);

        $decoded = urldecode($request->input('encoded'));

        return ResponseHelper::success(['decoded' => $decoded]);
    }

    public function convertColor(Request $request)
    {
        $request->validate(['color' => 'required|string']);

        $color = $request->input('color');

        try {
            if (preg_match('/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/', $color)) {
                $hex = $color;
                $r = hexdec(substr($hex, 1, 2));
                $g = hexdec(substr($hex, 3, 2));
                $b = hexdec(substr($hex, 5, 2));
            } elseif (preg_match('/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/', $color, $matches)) {
                $r = $matches[1];
                $g = $matches[2];
                $b = $matches[3];
                $hex = sprintf('#%02X%02X%02X', $r, $g, $b);
            } else {
                throw new \Exception('Invalid color format');
            }

            $hsl = $this->rgbToHsl($r, $g, $b);
            $hsv = $this->rgbToHsv($r, $g, $b);
            $cmyk = $this->rgbToCmyk($r, $g, $b);

            return ResponseHelper::success([
                'hex' => $hex,
                'rgb' => "rgb($r, $g, $b)",
                'hsl' => sprintf('hsl(%d, %d%%, %d%%)', $hsl['h'], $hsl['s'], $hsl['l']),
                'hsv' => sprintf('hsv(%d, %d%%, %d%%)', $hsv['h'], $hsv['s'], $hsv['v']),
                'cmyk' => sprintf('cmyk(%d%%, %d%%, %d%%, %d%%)', $cmyk['c'], $cmyk['m'], $cmyk['y'], $cmyk['k'])
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function convertBase(Request $request)
    {
        $request->validate([
            'value' => 'required|string',
            'from' => 'required|integer|in:2,8,10,16',
            'to' => 'sometimes|integer|in:2,8,10,16'
        ]);

        $value = $request->input('value');
        $from = $request->input('from');

        try {
            $decimal = base_convert($value, $from, 10);

            return ResponseHelper::success([
                'binary' => base_convert($decimal, 10, 2),
                'octal' => base_convert($decimal, 10, 8),
                'decimal' => $decimal,
                'hexadecimal' => strtoupper(base_convert($decimal, 10, 16))
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function slugify(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'separator' => 'sometimes|string',
            'lowercase' => 'sometimes|boolean'
        ]);

        $text = $request->input('text');
        $separator = $request->input('separator', '-');
        $lowercase = $request->input('lowercase', true);

        $slug = preg_replace('/[^A-Za-z0-9-]+/', $separator, $text);
        $slug = trim($slug, $separator);

        if ($lowercase) {
            $slug = strtolower($slug);
        }

        return ResponseHelper::success(['slug' => $slug]);
    }

    private function rgbToHsl($r, $g, $b)
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;

        if ($max == $min) {
            $h = $s = 0;
        } else {
            $d = $max - $min;
            $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);

            switch ($max) {
                case $r: $h = ($g - $b) / $d + ($g < $b ? 6 : 0); break;
                case $g: $h = ($b - $r) / $d + 2; break;
                case $b: $h = ($r - $g) / $d + 4; break;
            }
            $h /= 6;
        }

        return ['h' => round($h * 360), 's' => round($s * 100), 'l' => round($l * 100)];
    }

    private function rgbToHsv($r, $g, $b)
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $v = $max;

        $d = $max - $min;
        $s = $max == 0 ? 0 : $d / $max;

        if ($max == $min) {
            $h = 0;
        } else {
            switch ($max) {
                case $r: $h = ($g - $b) / $d + ($g < $b ? 6 : 0); break;
                case $g: $h = ($b - $r) / $d + 2; break;
                case $b: $h = ($r - $g) / $d + 4; break;
            }
            $h /= 6;
        }

        return ['h' => round($h * 360), 's' => round($s * 100), 'v' => round($v * 100)];
    }

    private function rgbToCmyk($r, $g, $b)
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;

        $k = 1 - max($r, $g, $b);
        $c = (1 - $r - $k) / (1 - $k);
        $m = (1 - $g - $k) / (1 - $k);
        $y = (1 - $b - $k) / (1 - $k);

        return [
            'c' => round($c * 100),
            'm' => round($m * 100),
            'y' => round($y * 100),
            'k' => round($k * 100)
        ];
    }

    public function jsonToYaml(Request $request)
    {
        $request->validate(['json' => 'required|string']);

        try {
            $data = json_decode($request->input('json'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON');
            }

            $yaml = $this->arrayToYaml($data);

            return ResponseHelper::success(['yaml' => $yaml]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function yamlToJson(Request $request)
    {
        $request->validate(['yaml' => 'required|string']);

        try {
            $data = $this->yamlToArray($request->input('yaml'));
            $json = json_encode($data, JSON_PRETTY_PRINT);

            return ResponseHelper::success(['json' => $json]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function jsonToCsv(Request $request)
    {
        $request->validate([
            'json' => 'required|string',
            'delimiter' => 'sometimes|string',
            'includeHeaders' => 'sometimes|boolean'
        ]);

        try {
            $data = json_decode($request->input('json'), true);
            if (!is_array($data) || empty($data)) {
                throw new \Exception('JSON must be a non-empty array');
            }

            $delimiter = $request->input('delimiter', ',');
            $includeHeaders = $request->input('includeHeaders', true);

            $csv = '';
            if ($includeHeaders && isset($data[0])) {
                $csv .= implode($delimiter, array_keys($data[0])) . "\n";
            }

            foreach ($data as $row) {
                $csv .= implode($delimiter, array_values($row)) . "\n";
            }

            return ResponseHelper::success(['csv' => trim($csv)]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function temperature(Request $request)
    {
        $request->validate([
            'value' => 'required|numeric',
            'from' => 'required|in:celsius,fahrenheit,kelvin'
        ]);

        $value = $request->input('value');
        $from = $request->input('from');

        try {
            if ($from === 'celsius') {
                $celsius = $value;
                $fahrenheit = ($value * 9/5) + 32;
                $kelvin = $value + 273.15;
            } elseif ($from === 'fahrenheit') {
                $celsius = ($value - 32) * 5/9;
                $fahrenheit = $value;
                $kelvin = $celsius + 273.15;
            } else {
                $celsius = $value - 273.15;
                $fahrenheit = ($celsius * 9/5) + 32;
                $kelvin = $value;
            }

            return ResponseHelper::success([
                'celsius' => round($celsius, 2),
                'fahrenheit' => round($fahrenheit, 2),
                'kelvin' => round($kelvin, 2)
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function romanToArabic(Request $request)
    {
        $request->validate(['roman' => 'required|string']);

        try {
            $roman = strtoupper($request->input('roman'));
            $romanMap = ['I' => 1, 'V' => 5, 'X' => 10, 'L' => 50, 'C' => 100, 'D' => 500, 'M' => 1000];

            $arabic = 0;
            $prevValue = 0;

            for ($i = strlen($roman) - 1; $i >= 0; $i--) {
                $value = $romanMap[$roman[$i]] ?? 0;
                if ($value < $prevValue) {
                    $arabic -= $value;
                } else {
                    $arabic += $value;
                }
                $prevValue = $value;
            }

            return ResponseHelper::success(['arabic' => $arabic]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    private function arrayToYaml($data, $indent = 0)
    {
        $yaml = '';
        $spaces = str_repeat('  ', $indent);

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $yaml .= $spaces . $key . ":\n" . $this->arrayToYaml($value, $indent + 1);
            } else {
                $yaml .= $spaces . $key . ': ' . $value . "\n";
            }
        }

        return $yaml;
    }

    private function yamlToArray($yaml)
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
}
