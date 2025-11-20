<?php

namespace App\Apps\ItToolsV1\ItToolsV1WebCtl;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Apps\ItToolsV1\ItToolsV1Utils\ResponseHelper;
use App\Apps\ItToolsV1\ItToolsV1Gvar\Constants;

class ItToolsV1WebCtl extends Controller
{
    public function jsonPrettify(Request $request)
    {
        $request->validate([
            'json' => 'required|string',
            'indent' => 'sometimes|integer|in:2,4,8'
        ]);

        $json = $request->input('json');
        $indent = $request->input('indent', 2);

        try {
            $data = json_decode($json, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON: ' . json_last_error_msg());
            }

            $prettified = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            return ResponseHelper::success(['prettified' => $prettified]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function jsonMinify(Request $request)
    {
        $request->validate(['json' => 'required|string']);

        $json = $request->input('json');

        try {
            $data = json_decode($json, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON: ' . json_last_error_msg());
            }

            $minified = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            return ResponseHelper::success(['minified' => $minified]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function jwtParse(Request $request)
    {
        $request->validate(['token' => 'required|string']);

        $token = $request->input('token');

        try {
            $parts = explode('.', $token);

            if (count($parts) !== 3) {
                throw new \Exception('Invalid JWT format');
            }

            $header = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
            $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
            $signature = $parts[2];

            return ResponseHelper::success([
                'header' => $header,
                'payload' => $payload,
                'signature' => $signature
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

    public function htmlEncode(Request $request)
    {
        $request->validate(['html' => 'required|string']);

        $html = $request->input('html');
        $encoded = htmlentities($html, ENT_QUOTES, 'UTF-8');

        return ResponseHelper::success(['encoded' => $encoded]);
    }

    public function htmlDecode(Request $request)
    {
        $request->validate(['encoded' => 'required|string']);

        $encoded = $request->input('encoded');
        $decoded = html_entity_decode($encoded, ENT_QUOTES, 'UTF-8');

        return ResponseHelper::success(['decoded' => $decoded]);
    }

    public function jsonDiff(Request $request)
    {
        $request->validate([
            'json1' => 'required|string',
            'json2' => 'required|string'
        ]);

        try {
            $data1 = json_decode($request->input('json1'), true);
            $data2 = json_decode($request->input('json2'), true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON');
            }

            $differences = $this->findDifferences($data1, $data2);

            return ResponseHelper::success([
                'differences' => $differences,
                'hasDifferences' => !empty($differences)
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

    public function markdownToHtml(Request $request)
    {
        $request->validate([
            'markdown' => 'required|string',
            'sanitize' => 'sometimes|boolean'
        ]);

        $markdown = $request->input('markdown');

        try {
            $html = preg_replace('/^### (.*?)$/m', '<h3>$1</h3>', $markdown);
            $html = preg_replace('/^## (.*?)$/m', '<h2>$1</h2>', $html);
            $html = preg_replace('/^# (.*?)$/m', '<h1>$1</h1>', $html);
            $html = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $html);
            $html = preg_replace('/\*(.*?)\*/', '<em>$1</em>', $html);
            $html = preg_replace('/\n\n/', '</p><p>', $html);
            $html = '<p>' . $html . '</p>';

            return ResponseHelper::success(['html' => $html]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function sqlFormat(Request $request)
    {
        $request->validate([
            'sql' => 'required|string',
            'indent' => 'sometimes|string',
            'uppercase' => 'sometimes|boolean'
        ]);

        $sql = $request->input('sql');
        $uppercase = $request->input('uppercase', true);

        try {
            $keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'LIMIT'];

            if ($uppercase) {
                foreach ($keywords as $keyword) {
                    $sql = preg_replace('/\b' . $keyword . '\b/i', $keyword, $sql);
                }
            }

            $formatted = str_replace(',', ",\n  ", $sql);
            $formatted = preg_replace('/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/', "\n$1\n  ", $formatted);

            return ResponseHelper::success(['formatted' => trim($formatted)]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function generateQrCode(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'size' => 'sometimes|integer|min:100|max:1000',
            'errorCorrection' => 'sometimes|in:L,M,Q,H'
        ]);

        $text = $request->input('text');
        $size = $request->input('size', 300);
        $errorCorrection = $request->input('errorCorrection', 'M');

        try {
            $qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=' . $size . 'x' . $size . '&data=' . urlencode($text) . '&ecc=' . $errorCorrection;

            return ResponseHelper::success([
                'qrCodeUrl' => $qrCodeUrl,
                'size' => $size,
                'errorCorrection' => $errorCorrection,
                'text' => $text
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

    public function yamlFormat(Request $request)
    {
        $request->validate([
            'yaml' => 'required|string',
            'indent' => 'sometimes|integer|in:2,4'
        ]);

        $yaml = $request->input('yaml');
        $indent = $request->input('indent', 2);

        try {
            $lines = explode("\n", $yaml);
            $formatted = '';
            $spaces = str_repeat(' ', $indent);

            foreach ($lines as $line) {
                $trimmed = ltrim($line);
                $level = (strlen($line) - strlen($trimmed)) / 2;
                $formatted .= str_repeat($spaces, $level) . $trimmed . "\n";
            }

            return ResponseHelper::success(['formatted' => trim($formatted)]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function xmlFormat(Request $request)
    {
        $request->validate([
            'xml' => 'required|string',
            'indent' => 'sometimes|integer|in:2,4'
        ]);

        $xml = $request->input('xml');
        $indent = $request->input('indent', 2);

        try {
            $dom = new \DOMDocument('1.0');
            $dom->preserveWhiteSpace = false;
            $dom->formatOutput = true;
            $dom->loadXML($xml);

            $formatted = $dom->saveXML();

            return ResponseHelper::success(['formatted' => $formatted]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function httpStatus(Request $request)
    {
        $request->validate(['code' => 'required|integer|min:100|max:599']);

        $code = $request->input('code');

        try {
            $statusCodes = [
                200 => 'OK',
                201 => 'Created',
                204 => 'No Content',
                301 => 'Moved Permanently',
                302 => 'Found',
                304 => 'Not Modified',
                400 => 'Bad Request',
                401 => 'Unauthorized',
                403 => 'Forbidden',
                404 => 'Not Found',
                405 => 'Method Not Allowed',
                429 => 'Too Many Requests',
                500 => 'Internal Server Error',
                502 => 'Bad Gateway',
                503 => 'Service Unavailable',
                504 => 'Gateway Timeout'
            ];

            $message = $statusCodes[$code] ?? 'Unknown Status';
            $category = $this->getStatusCategory($code);

            return ResponseHelper::success([
                'code' => $code,
                'message' => $message,
                'category' => $category
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

    public function mimeTypes(Request $request)
    {
        $request->validate([
            'search' => 'sometimes|string',
            'extension' => 'sometimes|string'
        ]);

        $search = $request->input('search', '');
        $extension = $request->input('extension', '');

        try {
            $mimeTypes = $this->getMimeTypeList();

            if ($extension) {
                $filtered = array_filter($mimeTypes, function($item) use ($extension) {
                    return $item['extension'] === $extension;
                });
            } elseif ($search) {
                $filtered = array_filter($mimeTypes, function($item) use ($search) {
                    return stripos($item['type'], $search) !== false ||
                           stripos($item['extension'], $search) !== false;
                });
            } else {
                $filtered = $mimeTypes;
            }

            return ResponseHelper::success([
                'mimeTypes' => array_values($filtered),
                'count' => count($filtered)
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

    public function generateMetaTags(Request $request)
    {
        $request->validate([
            'title' => 'required|string',
            'description' => 'required|string',
            'url' => 'sometimes|url',
            'image' => 'sometimes|url',
            'type' => 'sometimes|in:website,article,product'
        ]);

        $title = $request->input('title');
        $description = $request->input('description');
        $url = $request->input('url', '');
        $image = $request->input('image', '');
        $type = $request->input('type', 'website');

        try {
            $tags = [
                'basic' => [
                    '<title>' . htmlspecialchars($title) . '</title>',
                    '<meta name="description" content="' . htmlspecialchars($description) . '">'
                ],
                'og' => [
                    '<meta property="og:title" content="' . htmlspecialchars($title) . '">',
                    '<meta property="og:description" content="' . htmlspecialchars($description) . '">',
                    '<meta property="og:type" content="' . $type . '">'
                ],
                'twitter' => [
                    '<meta name="twitter:card" content="summary_large_image">',
                    '<meta name="twitter:title" content="' . htmlspecialchars($title) . '">',
                    '<meta name="twitter:description" content="' . htmlspecialchars($description) . '">'
                ]
            ];

            if ($url) {
                $tags['og'][] = '<meta property="og:url" content="' . htmlspecialchars($url) . '">';
            }

            if ($image) {
                $tags['og'][] = '<meta property="og:image" content="' . htmlspecialchars($image) . '">';
                $tags['twitter'][] = '<meta name="twitter:image" content="' . htmlspecialchars($image) . '">';
            }

            $allTags = implode("\n", array_merge($tags['basic'], $tags['og'], $tags['twitter']));

            return ResponseHelper::success([
                'tags' => $tags,
                'allTags' => $allTags
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

    public function svgOptimize(Request $request)
    {
        $request->validate([
            'svg' => 'required|string',
            'precision' => 'sometimes|integer|min:1|max:5'
        ]);

        $svg = $request->input('svg');
        $precision = $request->input('precision', 2);

        try {
            $optimized = preg_replace('/\s+/', ' ', $svg);
            $optimized = preg_replace('/>\s+</', '><', $optimized);
            $optimized = trim($optimized);

            $originalSize = strlen($svg);
            $optimizedSize = strlen($optimized);
            $savings = round((1 - $optimizedSize / $originalSize) * 100, 2);

            return ResponseHelper::success([
                'optimized' => $optimized,
                'originalSize' => $originalSize,
                'optimizedSize' => $optimizedSize,
                'savings' => $savings . '%'
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

    public function generateWifiQrCode(Request $request)
    {
        $request->validate([
            'ssid' => 'required|string',
            'password' => 'sometimes|string',
            'encryption' => 'sometimes|in:WPA,WEP,nopass',
            'hidden' => 'sometimes|boolean',
            'size' => 'sometimes|integer|min:100|max:1000'
        ]);

        $ssid = $request->input('ssid');
        $password = $request->input('password', '');
        $encryption = $request->input('encryption', 'WPA');
        $hidden = $request->input('hidden', false);
        $size = $request->input('size', 300);

        try {
            $wifiString = 'WIFI:T:' . $encryption . ';S:' . $ssid . ';';
            if ($password) {
                $wifiString .= 'P:' . $password . ';';
            }
            if ($hidden) {
                $wifiString .= 'H:true;';
            }
            $wifiString .= ';;';

            $qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=' . $size . 'x' . $size . '&data=' . urlencode($wifiString);

            return ResponseHelper::success([
                'qrCodeUrl' => $qrCodeUrl,
                'wifiString' => $wifiString,
                'ssid' => $ssid,
                'encryption' => $encryption,
                'hidden' => $hidden,
                'size' => $size
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

    private function findDifferences($arr1, $arr2, $path = '')
    {
        $differences = [];

        foreach ($arr1 as $key => $value) {
            $currentPath = $path ? $path . '.' . $key : $key;

            if (!array_key_exists($key, $arr2)) {
                $differences[] = [
                    'path' => $currentPath,
                    'oldValue' => $value,
                    'newValue' => null,
                    'type' => 'removed'
                ];
            } elseif ($value !== $arr2[$key]) {
                $differences[] = [
                    'path' => $currentPath,
                    'oldValue' => $value,
                    'newValue' => $arr2[$key],
                    'type' => 'modified'
                ];
            }
        }

        foreach ($arr2 as $key => $value) {
            if (!array_key_exists($key, $arr1)) {
                $currentPath = $path ? $path . '.' . $key : $key;
                $differences[] = [
                    'path' => $currentPath,
                    'oldValue' => null,
                    'newValue' => $value,
                    'type' => 'added'
                ];
            }
        }

        return $differences;
    }

    private function getStatusCategory(int $code): string
    {
        if ($code >= 100 && $code < 200) return 'Informational';
        if ($code >= 200 && $code < 300) return 'Success';
        if ($code >= 300 && $code < 400) return 'Redirection';
        if ($code >= 400 && $code < 500) return 'Client Error';
        if ($code >= 500 && $code < 600) return 'Server Error';
        return 'Unknown';
    }

    private function getMimeTypeList(): array
    {
        return [
            ['type' => 'text/html', 'extension' => 'html', 'description' => 'HTML document'],
            ['type' => 'text/css', 'extension' => 'css', 'description' => 'CSS stylesheet'],
            ['type' => 'text/javascript', 'extension' => 'js', 'description' => 'JavaScript'],
            ['type' => 'application/json', 'extension' => 'json', 'description' => 'JSON data'],
            ['type' => 'application/xml', 'extension' => 'xml', 'description' => 'XML document'],
            ['type' => 'image/jpeg', 'extension' => 'jpg', 'description' => 'JPEG image'],
            ['type' => 'image/png', 'extension' => 'png', 'description' => 'PNG image'],
            ['type' => 'image/gif', 'extension' => 'gif', 'description' => 'GIF image'],
            ['type' => 'image/svg+xml', 'extension' => 'svg', 'description' => 'SVG image'],
            ['type' => 'application/pdf', 'extension' => 'pdf', 'description' => 'PDF document'],
            ['type' => 'application/zip', 'extension' => 'zip', 'description' => 'ZIP archive'],
            ['type' => 'video/mp4', 'extension' => 'mp4', 'description' => 'MP4 video'],
            ['type' => 'audio/mpeg', 'extension' => 'mp3', 'description' => 'MP3 audio'],
            ['type' => 'text/plain', 'extension' => 'txt', 'description' => 'Plain text']
        ];
    }
}
