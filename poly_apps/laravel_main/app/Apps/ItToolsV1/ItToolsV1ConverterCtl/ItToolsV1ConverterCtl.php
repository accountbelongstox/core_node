<?php

namespace App\Apps\ItToolsV1\ItToolsV1ConverterCtl;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Apps\ItToolsV1\ItToolsV1Gvar\ItToolsV1Constants;

class ItToolsV1ConverterCtl extends Controller
{
    use ApiResponse;

    public function base64Encode(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $encoded = base64_encode($request->input('text'));

        return $this->success(['encoded' => $encoded]);
    }

    public function base64Decode(Request $request)
    {
        $request->validate(['encoded' => 'required|string']);

        try {
            $decoded = base64_decode($request->input('encoded'), true);

            if ($decoded === false) {
                throw new \Exception('Invalid base64 string');
            }

            return $this->success(['decoded' => $decoded]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
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

        return $this->success([
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

        return $this->success(['encoded' => $encoded]);
    }

    public function urlDecode(Request $request)
    {
        $request->validate(['encoded' => 'required|string']);

        $decoded = urldecode($request->input('encoded'));

        return $this->success(['decoded' => $decoded]);
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

            return $this->success([
                'hex' => $hex,
                'rgb' => "rgb($r, $g, $b)",
                'hsl' => sprintf('hsl(%d, %d%%, %d%%)', $hsl['h'], $hsl['s'], $hsl['l']),
                'hsv' => sprintf('hsv(%d, %d%%, %d%%)', $hsv['h'], $hsv['s'], $hsv['v']),
                'cmyk' => sprintf('cmyk(%d%%, %d%%, %d%%, %d%%)', $cmyk['c'], $cmyk['m'], $cmyk['y'], $cmyk['k'])
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

            return $this->success([
                'binary' => base_convert($decimal, 10, 2),
                'octal' => base_convert($decimal, 10, 8),
                'decimal' => $decimal,
                'hexadecimal' => strtoupper(base_convert($decimal, 10, 16))
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

        return $this->success(['slug' => $slug]);
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

            return $this->success(['yaml' => $yaml]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
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

            return $this->success(['json' => $json]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
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

            return $this->success(['csv' => trim($csv)]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
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

            return $this->success([
                'celsius' => round($celsius, 2),
                'fahrenheit' => round($fahrenheit, 2),
                'kelvin' => round($kelvin, 2)
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

            return $this->success(['arabic' => $arabic]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
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

    public function base64FileEncode(Request $request)
    {
        $request->validate([
            'fileData' => 'required|string',
            'fileName' => 'sometimes|string'
        ]);

        $fileData = $request->input('fileData');
        $fileName = $request->input('fileName', 'file');

        try {
            $encoded = base64_encode($fileData);
            $size = strlen($fileData);

            return $this->success([
                'encoded' => $encoded,
                'fileName' => $fileName,
                'size' => $size,
                'dataUri' => 'data:application/octet-stream;base64,' . $encoded
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

    public function base64FileDecode(Request $request)
    {
        $request->validate(['encoded' => 'required|string']);

        try {
            $encoded = $request->input('encoded');
            $decoded = base64_decode($encoded, true);

            if ($decoded === false) {
                throw new \Exception('Invalid base64 string');
            }

            $size = strlen($decoded);
            $mimeType = $this->detectMimeType($decoded);

            return $this->success([
                'fileData' => $decoded,
                'size' => $size,
                'mimeType' => $mimeType,
                'dataUri' => 'data:' . $mimeType . ';base64,' . $encoded
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

    public function convertDateTime(Request $request)
    {
        $request->validate([
            'input' => 'required|string',
            'inputFormat' => 'sometimes|string|nullable',
            'outputFormat' => 'sometimes|string|nullable',
            'timezone' => 'sometimes|string|nullable',
            'customFormat' => 'sometimes|string|nullable',
            'customInputFormat' => 'sometimes|string|nullable'
        ]);

        $input = $request->input('input');
        $inputFormat = $request->input('inputFormat');
        $outputFormat = $request->input('outputFormat');
        $timezone = $request->input('timezone', 'UTC');
        $customFormat = $request->input('customFormat');
        $customInputFormat = $request->input('customInputFormat');

        try {
            $dateTime = null;

            if ($customInputFormat) {
                $dateTime = \DateTime::createFromFormat($customInputFormat, $input, new \DateTimeZone($timezone));
            } elseif ($inputFormat) {
                $formatMap = [
                    'iso8601' => 'Y-m-d\TH:i:s\Z',
                    'rfc2822' => 'D, d M Y H:i:s O',
                    'unix' => 'U',
                    'mysql' => 'Y-m-d H:i:s',
                    'date' => 'Y-m-d',
                    'time' => 'H:i:s'
                ];
                $format = $formatMap[$inputFormat] ?? $inputFormat;
                $dateTime = \DateTime::createFromFormat($format, $input, new \DateTimeZone($timezone));
            } else {
                $dateTime = new \DateTime($input, new \DateTimeZone($timezone));
            }

            if ($dateTime === false) {
                throw new \Exception('Invalid date/time format');
            }

            $result = [];

            if ($customFormat) {
                $result['custom'] = $dateTime->format($customFormat);
            }

            if ($outputFormat) {
                $formatMap = [
                    'iso8601' => 'Y-m-d\TH:i:s\Z',
                    'rfc2822' => 'D, d M Y H:i:s O',
                    'unix' => 'U',
                    'mysql' => 'Y-m-d H:i:s',
                    'date' => 'Y-m-d',
                    'time' => 'H:i:s',
                    'timestamp' => 'U'
                ];
                $format = $formatMap[$outputFormat] ?? $outputFormat;
                $result[$outputFormat] = $dateTime->format($format);
            }

            $result['iso8601'] = $dateTime->format('Y-m-d\TH:i:s\Z');
            $result['rfc2822'] = $dateTime->format('D, d M Y H:i:s O');
            $result['unix'] = $dateTime->format('U');
            $result['mysql'] = $dateTime->format('Y-m-d H:i:s');
            $result['date'] = $dateTime->format('Y-m-d');
            $result['time'] = $dateTime->format('H:i:s');
            $result['year'] = (int)$dateTime->format('Y');
            $result['month'] = (int)$dateTime->format('m');
            $result['day'] = (int)$dateTime->format('d');
            $result['hour'] = (int)$dateTime->format('H');
            $result['minute'] = (int)$dateTime->format('i');
            $result['second'] = (int)$dateTime->format('s');
            $result['dayOfWeek'] = (int)$dateTime->format('w');
            $result['dayOfYear'] = (int)$dateTime->format('z');
            $result['week'] = (int)$dateTime->format('W');
            $result['timezone'] = $dateTime->getTimezone()->getName();

            return $this->success($result);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function jsonToXml(Request $request)
    {
        $request->validate(['json' => 'required|string']);

        try {
            $data = json_decode($request->input('json'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON');
            }

            $xml = $this->arrayToXml($data);

            return $this->success(['xml' => $xml]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function xmlToJson(Request $request)
    {
        $request->validate(['xml' => 'required|string']);

        try {
            $xml = simplexml_load_string($request->input('xml'));
            if ($xml === false) {
                throw new \Exception('Invalid XML');
            }

            $json = json_encode($xml, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            return $this->success(['json' => $json]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function jsonToToml(Request $request)
    {
        $request->validate(['json' => 'required|string']);

        try {
            $data = json_decode($request->input('json'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON');
            }

            $toml = $this->arrayToToml($data);

            return $this->success(['toml' => $toml]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function tomlToJson(Request $request)
    {
        $request->validate(['toml' => 'required|string']);

        try {
            $data = $this->tomlToArray($request->input('toml'));
            $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            return $this->success(['json' => $json]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function tomlToYaml(Request $request)
    {
        $request->validate(['toml' => 'required|string']);

        try {
            $data = $this->tomlToArray($request->input('toml'));
            $yaml = $this->arrayToYaml($data);

            return $this->success(['yaml' => $yaml]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function yamlToToml(Request $request)
    {
        $request->validate(['yaml' => 'required|string']);

        try {
            $data = $this->yamlToArray($request->input('yaml'));
            $toml = $this->arrayToToml($data);

            return $this->success(['toml' => $toml]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function textToBinary(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $text = $request->input('text');
        $binary = '';

        for ($i = 0; $i < strlen($text); $i++) {
            $binary .= str_pad(decbin(ord($text[$i])), 8, '0', STR_PAD_LEFT) . ' ';
        }

        return $this->success(['binary' => trim($binary)]);
    }

    public function textToUnicode(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $text = $request->input('text');
        $unicode = [];

        for ($i = 0; $i < mb_strlen($text, 'UTF-8'); $i++) {
            $char = mb_substr($text, $i, 1, 'UTF-8');
            $unicode[] = 'U+' . strtoupper(str_pad(dechex(mb_ord($char, 'UTF-8')), 4, '0', STR_PAD_LEFT));
        }

        return $this->success(['unicode' => implode(' ', $unicode)]);
    }

    public function textToNato(Request $request)
    {
        $request->validate(['text' => 'required|string']);

        $text = strtoupper($request->input('text'));
        $natoAlphabet = [
            'A' => 'Alpha', 'B' => 'Bravo', 'C' => 'Charlie', 'D' => 'Delta',
            'E' => 'Echo', 'F' => 'Foxtrot', 'G' => 'Golf', 'H' => 'Hotel',
            'I' => 'India', 'J' => 'Juliet', 'K' => 'Kilo', 'L' => 'Lima',
            'M' => 'Mike', 'N' => 'November', 'O' => 'Oscar', 'P' => 'Papa',
            'Q' => 'Quebec', 'R' => 'Romeo', 'S' => 'Sierra', 'T' => 'Tango',
            'U' => 'Uniform', 'V' => 'Victor', 'W' => 'Whiskey', 'X' => 'X-ray',
            'Y' => 'Yankee', 'Z' => 'Zulu', '0' => 'Zero', '1' => 'One',
            '2' => 'Two', '3' => 'Three', '4' => 'Four', '5' => 'Five',
            '6' => 'Six', '7' => 'Seven', '8' => 'Eight', '9' => 'Nine',
            ' ' => 'Space'
        ];

        $nato = [];
        for ($i = 0; $i < strlen($text); $i++) {
            $char = $text[$i];
            $nato[] = $natoAlphabet[$char] ?? $char;
        }

        return $this->success(['nato' => implode(' ', $nato)]);
    }

    public function convertList(Request $request)
    {
        $request->validate([
            'list' => 'required|string',
            'from' => 'sometimes|string',
            'to' => 'sometimes|string'
        ]);

        $list = $request->input('list');
        $from = $request->input('from', 'comma');
        $to = $request->input('to', 'newline');

        try {
            $separators = [
                'comma' => ',',
                'semicolon' => ';',
                'pipe' => '|',
                'space' => ' ',
                'tab' => "\t",
                'newline' => "\n"
            ];

            $fromSep = $separators[$from] ?? $from;
            $toSep = $separators[$to] ?? $to;

            $items = explode($fromSep, $list);
            $items = array_map('trim', $items);
            $items = array_filter($items);

            $result = implode($toSep, $items);

            return $this->success([
                'original' => $list,
                'converted' => $result,
                'from' => $from,
                'to' => $to,
                'itemCount' => count($items)
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

    private function detectMimeType($data): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_buffer($finfo, $data);
        finfo_close($finfo);

        return $mimeType ?: 'application/octet-stream';
    }

    private function arrayToXml($data, $rootElement = 'root', $xml = null)
    {
        if ($xml === null) {
            $xml = new \SimpleXMLElement('<?xml version="1.0"?><' . $rootElement . '></' . $rootElement . '>');
        }

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $subnode = $xml->addChild($key);
                $this->arrayToXml($value, $key, $subnode);
            } else {
                $xml->addChild($key, htmlspecialchars($value));
            }
        }

        return $xml->asXML();
    }

    private function arrayToToml($data, $indent = 0)
    {
        $toml = '';
        $spaces = str_repeat('  ', $indent);

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                if ($indent === 0) {
                    $toml .= "\n[{$key}]\n";
                }
                $toml .= $this->arrayToToml($value, $indent + 1);
            } else {
                $toml .= $spaces . $key . ' = ' . $this->formatTomlValue($value) . "\n";
            }
        }

        return $toml;
    }

    private function formatTomlValue($value)
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

    private function tomlToArray($toml)
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
                $parsedValue = $this->parseTomlValue($value);

                if ($currentSection) {
                    $data[$currentSection][$key] = $parsedValue;
                } else {
                    $data[$key] = $parsedValue;
                }
            }
        }

        return $data;
    }

    private function parseTomlValue($value)
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
}
