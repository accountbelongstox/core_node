<?php

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

use Exception;

class CryptoService
{
    /**
     * Generate hash from text
     *
     * @param string $text
     * @param string $algorithm
     * @return array
     * @throws Exception
     */
    public static function hashText(string $text, string $algorithm = 'sha256'): array
    {
        $validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];

        if (!in_array($algorithm, $validAlgorithms)) {
            throw new Exception("Invalid hash algorithm. Must be one of: " . implode(', ', $validAlgorithms));
        }

        return [
            'text' => $text,
            'algorithm' => $algorithm,
            'hash' => hash($algorithm, $text)
        ];
    }

    /**
     * Generate UUID v4
     *
     * @param int $count
     * @param bool $uppercase
     * @return array
     */
    public static function generateUUID(int $count = 1, bool $uppercase = false): array
    {
        $count = max(1, min($count, 100));
        $uuids = [];

        for ($i = 0; $i < $count; $i++) {
            $uuid = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );

            $uuids[] = $uppercase ? strtoupper($uuid) : $uuid;
        }

        return [
            'uuids' => $uuids,
            'count' => count($uuids)
        ];
    }

    /**
     * Generate random token
     *
     * @param int $length
     * @param string $charset
     * @return array
     * @throws Exception
     */
    public static function generateToken(int $length = 32, string $charset = 'alphanumeric'): array
    {
        $length = max(1, min($length, 256));

        $charsets = [
            'alphanumeric' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            'numeric' => '0123456789',
            'alphabetic' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            'special' => '!@#$%^&*()_+-=[]{}|;:,.<>?'
        ];

        if (!isset($charsets[$charset])) {
            throw new Exception("Invalid charset. Must be one of: " . implode(', ', array_keys($charsets)));
        }

        $chars = $charsets[$charset];
        $token = '';

        for ($i = 0; $i < $length; $i++) {
            $token .= $chars[random_int(0, strlen($chars) - 1)];
        }

        return [
            'token' => $token,
            'length' => $length,
            'charset' => $charset
        ];
    }

    /**
     * Generate bcrypt hash
     *
     * @param string $password
     * @param int $rounds
     * @return array
     * @throws Exception
     */
    public static function bcryptHash(string $password, int $rounds = 10): array
    {
        if ($rounds < 4 || $rounds > 31) {
            throw new Exception("Rounds must be between 4 and 31");
        }

        return [
            'hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => $rounds]),
            'rounds' => $rounds,
            'algorithm' => 'bcrypt'
        ];
    }

    /**
     * Verify bcrypt hash
     *
     * @param string $password
     * @param string $hash
     * @return array
     */
    public static function bcryptVerify(string $password, string $hash): array
    {
        return [
            'verified' => password_verify($password, $hash),
            'password' => $password,
            'hash' => $hash
        ];
    }

    /**
     * Generate HMAC
     *
     * @param string $message
     * @param string $key
     * @param string $algorithm
     * @return array
     * @throws Exception
     */
    public static function hmac(string $message, string $key, string $algorithm = 'sha256'): array
    {
        $validAlgorithms = ['sha256', 'sha512', 'sha1', 'md5'];

        if (!in_array($algorithm, $validAlgorithms)) {
            throw new Exception("Invalid algorithm. Must be one of: " . implode(', ', $validAlgorithms));
        }

        return [
            'message' => $message,
            'key' => $key,
            'algorithm' => $algorithm,
            'hmac' => hash_hmac($algorithm, $message, $key)
        ];
    }

    /**
     * Analyze password strength
     *
     * @param string $password
     * @return array
     */
    public static function analyzePassword(string $password): array
    {
        $length = strlen($password);
        $hasLower = preg_match('/[a-z]/', $password);
        $hasUpper = preg_match('/[A-Z]/', $password);
        $hasNumbers = preg_match('/\d/', $password);
        $hasSpecial = preg_match('/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/', $password);

        $strength = 0;
        $feedback = [];

        // Length score
        if ($length >= 8) $strength += 20;
        if ($length >= 12) $strength += 10;
        if ($length >= 16) $strength += 10;

        if ($length < 8) {
            $feedback[] = "Password should be at least 8 characters long";
        }

        // Character variety
        if ($hasLower) $strength += 15;
        else $feedback[] = "Add lowercase letters";

        if ($hasUpper) $strength += 15;
        else $feedback[] = "Add uppercase letters";

        if ($hasNumbers) $strength += 15;
        else $feedback[] = "Add numbers";

        if ($hasSpecial) $strength += 15;
        else $feedback[] = "Add special characters";

        $strength = min(100, $strength);

        $level = 'Very Weak';
        if ($strength >= 80) $level = 'Very Strong';
        elseif ($strength >= 60) $level = 'Strong';
        elseif ($strength >= 40) $level = 'Medium';
        elseif ($strength >= 20) $level = 'Weak';

        return [
            'password' => str_repeat('*', strlen($password)),
            'length' => $length,
            'strength' => $strength,
            'level' => $level,
            'hasLowercase' => (bool)$hasLower,
            'hasUppercase' => (bool)$hasUpper,
            'hasNumbers' => (bool)$hasNumbers,
            'hasSpecial' => (bool)$hasSpecial,
            'feedback' => $feedback
        ];
    }
}
