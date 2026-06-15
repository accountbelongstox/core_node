<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

class ItToolsV1CommonUtil
{
    public static function base64Encode(string $text): string
    {
        return base64_encode($text);
    }
    
    public static function base64Decode(string $text): string
    {
        return base64_decode($text);
    }
    
    public static function urlEncode(string $text): string
    {
        return urlencode($text);
    }
    
    public static function urlDecode(string $text): string
    {
        return urldecode($text);
    }
    
    public static function hash(string $text, string $algorithm = 'sha256'): string
    {
        $validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
        
        if (!in_array($algorithm, $validAlgorithms)) {
            throw new \InvalidArgumentException("Invalid algorithm. Must be one of: " . implode(', ', $validAlgorithms));
        }
        
        return hash($algorithm, $text);
    }
    
    public static function hmac(string $text, string $secret, string $algorithm = 'sha256'): string
    {
        return hash_hmac($algorithm, $text, $secret);
    }
    
    public static function generateUuid(int $version = 4): string
    {
        if ($version === 4) {
            return sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }
        
        throw new \InvalidArgumentException("Only UUID v4 is currently supported");
    }
    
    public static function generateToken(int $length = 32, string $charset = 'alphanumeric'): string
    {
        $characters = '';
        
        switch ($charset) {
            case 'numeric':
                $characters = '0123456789';
                break;
            case 'alphabetic':
                $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
                break;
            case 'lowercase':
                $characters = 'abcdefghijklmnopqrstuvwxyz';
                break;
            case 'uppercase':
                $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                break;
            case 'hex':
                $characters = '0123456789abcdef';
                break;
            case 'alphanumeric':
            default:
                $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
                break;
        }
        
        $token = '';
        $max = strlen($characters) - 1;
        
        for ($i = 0; $i < $length; $i++) {
            $token .= $characters[random_int(0, $max)];
        }
        
        return $token;
    }
    
    public static function slugify(string $text): string
    {
        $text = strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        $text = trim($text, '-');
        return $text;
    }
    
    public static function escapeHtml(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
    
    public static function unescapeHtml(string $text): string
    {
        return htmlspecialchars_decode($text, ENT_QUOTES);
    }
    
    public static function convertCase(string $text, string $caseType): string
    {
        switch ($caseType) {
            case 'lower':
                return strtolower($text);
            case 'upper':
                return strtoupper($text);
            case 'title':
                return ucwords(strtolower($text));
            case 'sentence':
                return ucfirst(strtolower($text));
            case 'camel':
                $text = str_replace(['-', '_'], ' ', $text);
                $text = ucwords(strtolower($text));
                $text = str_replace(' ', '', $text);
                return lcfirst($text);
            case 'pascal':
                $text = str_replace(['-', '_'], ' ', $text);
                $text = ucwords(strtolower($text));
                return str_replace(' ', '', $text);
            case 'snake':
                $text = preg_replace('/([a-z])([A-Z])/', '$1_$2', $text);
                $text = strtolower($text);
                return str_replace([' ', '-'], '_', $text);
            case 'kebab':
                $text = preg_replace('/([a-z])([A-Z])/', '$1-$2', $text);
                $text = strtolower($text);
                return str_replace([' ', '_'], '-', $text);
            default:
                return $text;
        }
    }
    
    public static function hexToRgb(string $hex): array
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
    
    public static function rgbToHex(int $r, int $g, int $b): string
    {
        return sprintf("#%02x%02x%02x", $r, $g, $b);
    }
    
    public static function analyzePassword(string $password): array
    {
        $length = strlen($password);
        $hasLower = preg_match('/[a-z]/', $password);
        $hasUpper = preg_match('/[A-Z]/', $password);
        $hasNumber = preg_match('/[0-9]/', $password);
        $hasSpecial = preg_match('/[^a-zA-Z0-9]/', $password);
        
        $strength = 0;
        if ($length >= 8) $strength += 20;
        if ($length >= 12) $strength += 20;
        if ($hasLower) $strength += 15;
        if ($hasUpper) $strength += 15;
        if ($hasNumber) $strength += 15;
        if ($hasSpecial) $strength += 15;
        
        $strengthLabel = 'Weak';
        if ($strength >= 80) $strengthLabel = 'Strong';
        elseif ($strength >= 60) $strengthLabel = 'Medium';
        
        return [
            'length' => $length,
            'has_lowercase' => (bool) $hasLower,
            'has_uppercase' => (bool) $hasUpper,
            'has_numbers' => (bool) $hasNumber,
            'has_special' => (bool) $hasSpecial,
            'strength_score' => $strength,
            'strength_label' => $strengthLabel
        ];
    }
}
