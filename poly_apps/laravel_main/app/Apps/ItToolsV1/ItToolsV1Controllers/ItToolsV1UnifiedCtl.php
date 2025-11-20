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

namespace App\Apps\ItToolsV1\ItToolsV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1CommonUtil;

class ItToolsV1UnifiedCtl extends ItToolsV1BaseCtl
{
    public function encode(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $text = $request->input('text');
            $type = $request->input('type', 'base64');
            
            if ($error = $this->validateRequired($request->all(), ['text'])) {
                return $error;
            }
            
            $result = match($type) {
                'base64' => ItToolsV1CommonUtil::base64Encode($text),
                'url' => ItToolsV1CommonUtil::urlEncode($text),
                'html' => ItToolsV1CommonUtil::escapeHtml($text),
                default => throw new \InvalidArgumentException("Invalid encoding type: $type")
            };
            
            return [
                'encoded' => $result,
                'type' => $type,
                'original_length' => strlen($text),
                'encoded_length' => strlen($result)
            ];
        });
    }
    
    public function decode(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $text = $request->input('text');
            $type = $request->input('type', 'base64');
            
            if ($error = $this->validateRequired($request->all(), ['text'])) {
                return $error;
            }
            
            $result = match($type) {
                'base64' => ItToolsV1CommonUtil::base64Decode($text),
                'url' => ItToolsV1CommonUtil::urlDecode($text),
                'html' => ItToolsV1CommonUtil::unescapeHtml($text),
                default => throw new \InvalidArgumentException("Invalid decoding type: $type")
            };
            
            return [
                'decoded' => $result,
                'type' => $type
            ];
        });
    }
    
    public function hash(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $text = $request->input('text');
            $algorithm = $request->input('algorithm', 'sha256');
            
            if ($error = $this->validateRequired($request->all(), ['text'])) {
                return $error;
            }
            
            $hash = ItToolsV1CommonUtil::hash($text, $algorithm);
            
            return [
                'hash' => $hash,
                'algorithm' => $algorithm,
                'length' => strlen($hash)
            ];
        });
    }
    
    public function hmac(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $text = $request->input('text');
            $secret = $request->input('secret');
            $algorithm = $request->input('algorithm', 'sha256');
            
            if ($error = $this->validateRequired($request->all(), ['text', 'secret'])) {
                return $error;
            }
            
            $hmac = ItToolsV1CommonUtil::hmac($text, $secret, $algorithm);
            
            return [
                'hmac' => $hmac,
                'algorithm' => $algorithm
            ];
        });
    }
    
    public function uuid(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $count = $request->input('count', 1);
            $count = min(max($count, 1), 100);
            
            $uuids = [];
            for ($i = 0; $i < $count; $i++) {
                $uuids[] = ItToolsV1CommonUtil::generateUuid();
            }
            
            return [
                'uuids' => $uuids,
                'count' => count($uuids)
            ];
        });
    }
    
    public function token(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $length = $request->input('length', 32);
            $charset = $request->input('charset', 'alphanumeric');
            $count = $request->input('count', 1);
            
            $length = min(max($length, 4), 256);
            $count = min(max($count, 1), 100);
            
            $tokens = [];
            for ($i = 0; $i < $count; $i++) {
                $tokens[] = ItToolsV1CommonUtil::generateToken($length, $charset);
            }
            
            return [
                'tokens' => $tokens,
                'count' => count($tokens),
                'length' => $length,
                'charset' => $charset
            ];
        });
    }
    
    public function convertCase(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $text = $request->input('text');
            $caseType = $request->input('case', 'lower');
            
            if ($error = $this->validateRequired($request->all(), ['text'])) {
                return $error;
            }
            
            $result = ItToolsV1CommonUtil::convertCase($text, $caseType);
            
            return [
                'converted' => $result,
                'case_type' => $caseType
            ];
        });
    }
    
    public function slugify(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $text = $request->input('text');
            
            if ($error = $this->validateRequired($request->all(), ['text'])) {
                return $error;
            }
            
            return [
                'slug' => ItToolsV1CommonUtil::slugify($text),
                'original' => $text
            ];
        });
    }
    
    public function convertColor(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $color = $request->input('color');
            $fromFormat = $request->input('from', 'hex');
            $toFormat = $request->input('to', 'rgb');
            
            if ($error = $this->validateRequired($request->all(), ['color'])) {
                return $error;
            }
            
            if ($fromFormat === 'hex' && $toFormat === 'rgb') {
                $rgb = ItToolsV1CommonUtil::hexToRgb($color);
                return [
                    'converted' => "rgb({$rgb['r']}, {$rgb['g']}, {$rgb['b']})",
                    'r' => $rgb['r'],
                    'g' => $rgb['g'],
                    'b' => $rgb['b'],
                    'hex' => $color
                ];
            } elseif ($fromFormat === 'rgb' && $toFormat === 'hex') {
                preg_match('/rgb\((\d+),\s*(\d+),\s*(\d+)\)/', $color, $matches);
                $hex = ItToolsV1CommonUtil::rgbToHex((int)$matches[1], (int)$matches[2], (int)$matches[3]);
                return [
                    'converted' => $hex,
                    'r' => (int)$matches[1],
                    'g' => (int)$matches[2],
                    'b' => (int)$matches[3]
                ];
            }
            
            throw new \InvalidArgumentException("Unsupported color conversion");
        });
    }
    
    public function analyzePassword(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $password = $request->input('password');
            
            if ($error = $this->validateRequired($request->all(), ['password'])) {
                return $error;
            }
            
            return ItToolsV1CommonUtil::analyzePassword($password);
        });
    }
    
    public function basicAuth(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $username = $request->input('username');
            $password = $request->input('password');
            
            if ($error = $this->validateRequired($request->all(), ['username', 'password'])) {
                return $error;
            }
            
            $credentials = base64_encode("$username:$password");
            
            return [
                'header' => "Authorization: Basic $credentials",
                'credentials' => $credentials,
                'username' => $username
            ];
        });
    }
}
