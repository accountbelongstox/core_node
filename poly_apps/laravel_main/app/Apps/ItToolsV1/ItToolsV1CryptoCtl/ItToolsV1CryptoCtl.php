<?php

namespace App\Apps\ItToolsV1\ItToolsV1CryptoCtl;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use App\Traits\ApiResponse;
use App\Apps\ItToolsV1\ItToolsV1Gvar\ItToolsV1Constants;

class ItToolsV1CryptoCtl extends Controller
{
    use ApiResponse;

    public function hashText(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'algorithm' => 'required|in:md5,sha1,sha256,sha512'
        ]);

        $text = $request->input('text');
        $algorithm = $request->input('algorithm');

        try {
            $hash = hash($algorithm, $text);

            return $this->success([
                'algorithm' => $algorithm,
                'hash' => $hash
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

    public function bcryptHash(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
            'rounds' => 'sometimes|integer|min:4|max:31'
        ]);

        $password = $request->input('password');
        $rounds = $request->input('rounds', 10);

        try {
            $hash = Hash::make($password, ['rounds' => $rounds]);

            return $this->success(['hash' => $hash]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function bcryptVerify(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
            'hash' => 'required|string'
        ]);

        $password = $request->input('password');
        $hash = $request->input('hash');

        try {
            $valid = Hash::check($password, $hash);

            return $this->success(['valid' => $valid]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function generateUuid(Request $request)
    {
        $request->validate([
            'count' => 'sometimes|integer|min:1|max:100',
            'uppercase' => 'sometimes|boolean'
        ]);

        $count = $request->input('count', 1);
        $uppercase = $request->input('uppercase', false);

        try {
            $uuids = [];
            for ($i = 0; $i < $count; $i++) {
                $uuid = (string) Str::uuid();
                $uuids[] = $uppercase ? strtoupper($uuid) : $uuid;
            }

            return $this->success(['uuids' => $uuids]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function generateUlid(Request $request)
    {
        $request->validate([
            'count' => 'sometimes|integer|min:1|max:100'
        ]);

        $count = $request->input('count', 1);

        try {
            $ulids = [];
            for ($i = 0; $i < $count; $i++) {
                $ulids[] = (string) Str::ulid();
            }

            return $this->success(['ulids' => $ulids]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function generateToken(Request $request)
    {
        $request->validate([
            'length' => 'sometimes|integer|min:8|max:256',
            'charset' => 'sometimes|in:alphanumeric,alphabetic,numeric,lowercase,uppercase,hex',
            'includeSymbols' => 'sometimes|boolean',
            'count' => 'sometimes|integer|min:1|max:50'
        ]);

        $length = $request->input('length', 32);
        $charset = $request->input('charset', 'alphanumeric');
        $includeSymbols = $request->input('includeSymbols', false);
        $count = $request->input('count', 1);

        $charsets = [
            'alphanumeric' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            'alphabetic' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            'numeric' => '0123456789',
            'lowercase' => 'abcdefghijklmnopqrstuvwxyz0123456789',
            'uppercase' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            'hex' => '0123456789abcdef'
        ];

        $chars = $charsets[$charset] ?? $charsets['alphanumeric'];
        if ($includeSymbols) {
            $chars .= '!@#$%^&*()_+-=[]{}|;:,.<>?';
        }

        try {
            $tokens = [];
            $charsLength = strlen($chars);

            for ($i = 0; $i < $count; $i++) {
                $token = '';
                for ($j = 0; $j < $length; $j++) {
                    $token .= $chars[random_int(0, $charsLength - 1)];
                }
                $tokens[] = $token;
            }

            return $this->success(['tokens' => $tokens]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function generateBasicAuth(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string'
        ]);

        $username = $request->input('username');
        $password = $request->input('password');

        $encoded = base64_encode($username . ':' . $password);

        return $this->success([
            'header' => 'Authorization: Basic ' . $encoded,
            'value' => $encoded
        ]);
    }

    public function generateHmac(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'secret' => 'required|string',
            'algorithm' => 'required|in:sha1,sha256,sha512'
        ]);

        $text = $request->input('text');
        $secret = $request->input('secret');
        $algorithm = $request->input('algorithm');

        try {
            $hmac = hash_hmac($algorithm, $text, $secret);

            return $this->success([
                'hmac' => $hmac,
                'algorithm' => $algorithm
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

    public function generateRsaKeyPair(Request $request)
    {
        $request->validate([
            'keySize' => 'sometimes|integer|in:1024,2048,4096',
            'format' => 'sometimes|in:pem,pkcs8'
        ]);

        $keySize = $request->input('keySize', 2048);
        $format = $request->input('format', 'pem');

        try {
            $config = [
                'private_key_bits' => $keySize,
                'private_key_type' => OPENSSL_KEYTYPE_RSA
            ];

            $resource = openssl_pkey_new($config);
            openssl_pkey_export($resource, $privateKey);
            $publicKey = openssl_pkey_get_details($resource)['key'];

            return $this->success([
                'privateKey' => $privateKey,
                'publicKey' => $publicKey,
                'keySize' => $keySize,
                'format' => $format
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

    public function generateBip39(Request $request)
    {
        $request->validate([
            'strength' => 'sometimes|integer|in:128,160,192,224,256',
            'count' => 'sometimes|integer|min:1|max:10'
        ]);

        $strength = $request->input('strength', 128);
        $count = $request->input('count', 1);

        try {
            $wordList = $this->getBip39WordList();
            $mnemonics = [];

            for ($i = 0; $i < $count; $i++) {
                $entropy = random_bytes($strength / 8);
                $binary = '';

                for ($j = 0; $j < strlen($entropy); $j++) {
                    $binary .= str_pad(decbin(ord($entropy[$j])), 8, '0', STR_PAD_LEFT);
                }

                $checksum = hash('sha256', $entropy, true);
                $checksumBits = substr(str_pad(decbin(ord($checksum[0])), 8, '0', STR_PAD_LEFT), 0, $strength / 32);
                $binary .= $checksumBits;

                $words = [];
                for ($j = 0; $j < strlen($binary); $j += 11) {
                    $index = bindec(substr($binary, $j, 11));
                    $words[] = $wordList[$index];
                }

                $mnemonics[] = implode(' ', $words);
            }

            return $this->success([
                'mnemonics' => $mnemonics,
                'strength' => $strength,
                'wordCount' => ($strength / 32) * 3
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

    public function generateOtp(Request $request)
    {
        $request->validate([
            'secret' => 'sometimes|string',
            'period' => 'sometimes|integer|min:15|max:120',
            'digits' => 'sometimes|integer|in:6,8'
        ]);

        $secret = $request->input('secret', Str::random(32));
        $period = $request->input('period', 30);
        $digits = $request->input('digits', 6);

        try {
            $timestamp = floor(time() / $period);
            $hash = hash_hmac('sha1', pack('N*', 0) . pack('N*', $timestamp), $secret, true);
            $offset = ord($hash[strlen($hash) - 1]) & 0xf;
            $code = (
                ((ord($hash[$offset + 0]) & 0x7f) << 24) |
                ((ord($hash[$offset + 1]) & 0xff) << 16) |
                ((ord($hash[$offset + 2]) & 0xff) << 8) |
                (ord($hash[$offset + 3]) & 0xff)
            ) % pow(10, $digits);

            $otp = str_pad($code, $digits, '0', STR_PAD_LEFT);

            return $this->success([
                'otp' => $otp,
                'secret' => $secret,
                'period' => $period,
                'digits' => $digits,
                'expiresIn' => $period - (time() % $period)
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

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'otp' => 'required|string',
            'secret' => 'required|string',
            'period' => 'sometimes|integer|min:15|max:120',
            'digits' => 'sometimes|integer|in:6,8'
        ]);

        $otp = $request->input('otp');
        $secret = $request->input('secret');
        $period = $request->input('period', 30);
        $digits = $request->input('digits', 6);

        try {
            $timestamp = floor(time() / $period);

            for ($i = -1; $i <= 1; $i++) {
                $hash = hash_hmac('sha1', pack('N*', 0) . pack('N*', $timestamp + $i), $secret, true);
                $offset = ord($hash[strlen($hash) - 1]) & 0xf;
                $code = (
                    ((ord($hash[$offset + 0]) & 0x7f) << 24) |
                    ((ord($hash[$offset + 1]) & 0xff) << 16) |
                    ((ord($hash[$offset + 2]) & 0xff) << 8) |
                    (ord($hash[$offset + 3]) & 0xff)
                ) % pow(10, $digits);

                $expectedOtp = str_pad($code, $digits, '0', STR_PAD_LEFT);

                if ($otp === $expectedOtp) {
                    return $this->success([
                        'valid' => true,
                        'timeDrift' => $i
                    ]);
                }
            }

            return $this->success(['valid' => false]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function analyzePassword(Request $request)
    {
        $request->validate(['password' => 'required|string']);

        $password = $request->input('password');

        try {
            $length = strlen($password);
            $hasLowercase = preg_match('/[a-z]/', $password);
            $hasUppercase = preg_match('/[A-Z]/', $password);
            $hasNumbers = preg_match('/[0-9]/', $password);
            $hasSymbols = preg_match('/[^a-zA-Z0-9]/', $password);

            $charsetSize = 0;
            if ($hasLowercase) $charsetSize += 26;
            if ($hasUppercase) $charsetSize += 26;
            if ($hasNumbers) $charsetSize += 10;
            if ($hasSymbols) $charsetSize += 32;

            $entropy = $length > 0 && $charsetSize > 0 ? $length * log($charsetSize, 2) : 0;

            $strength = 'weak';
            if ($entropy >= 80) $strength = 'strong';
            elseif ($entropy >= 50) $strength = 'medium';

            $crackTimeSeconds = $charsetSize > 0 ? pow($charsetSize, $length) / 1000000000 : 0;
            $crackTime = $this->formatTime($crackTimeSeconds);

            return $this->success([
                'length' => $length,
                'hasLowercase' => $hasLowercase,
                'hasUppercase' => $hasUppercase,
                'hasNumbers' => $hasNumbers,
                'hasSymbols' => $hasSymbols,
                'entropy' => round($entropy, 2),
                'strength' => $strength,
                'crackTime' => $crackTime,
                'charsetSize' => $charsetSize
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

    public function encrypt(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'key' => 'required|string',
            'algorithm' => 'sometimes|in:aes-128-cbc,aes-256-cbc,aes-128-gcm,aes-256-gcm'
        ]);

        $text = $request->input('text');
        $key = $request->input('key');
        $algorithm = $request->input('algorithm', 'aes-256-cbc');

        try {
            $keyHash = hash('sha256', $key, true);
            $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length($algorithm));
            $encrypted = openssl_encrypt($text, $algorithm, $keyHash, OPENSSL_RAW_DATA, $iv);
            $result = base64_encode($iv . $encrypted);

            return $this->success([
                'encrypted' => $result,
                'algorithm' => $algorithm
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

    public function decrypt(Request $request)
    {
        $request->validate([
            'encrypted' => 'required|string',
            'key' => 'required|string',
            'algorithm' => 'sometimes|in:aes-128-cbc,aes-256-cbc,aes-128-gcm,aes-256-gcm'
        ]);

        $encrypted = $request->input('encrypted');
        $key = $request->input('key');
        $algorithm = $request->input('algorithm', 'aes-256-cbc');

        try {
            $keyHash = hash('sha256', $key, true);
            $data = base64_decode($encrypted);
            $ivLength = openssl_cipher_iv_length($algorithm);
            $iv = substr($data, 0, $ivLength);
            $ciphertext = substr($data, $ivLength);
            $decrypted = openssl_decrypt($ciphertext, $algorithm, $keyHash, OPENSSL_RAW_DATA, $iv);

            if ($decrypted === false) {
                throw new \Exception('Decryption failed');
            }

            return $this->success([
                'decrypted' => $decrypted,
                'algorithm' => $algorithm
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

    private function getBip39WordList(): array
    {
        // Full official 2048-word BIP-39 English wordlist (the inline list was
        // truncated to 140 words, so any 11-bit index >= 140 hit an undefined key
        // and the request 500'd). Sourced as a standalone data file.
        return require __DIR__ . '/../ItToolsV1Gvar/Bip39WordList.php';
    }

    private function formatTime(float $seconds): string
    {
        if ($seconds < 60) {
            return round($seconds, 2) . ' seconds';
        } elseif ($seconds < 3600) {
            return round($seconds / 60, 2) . ' minutes';
        } elseif ($seconds < 86400) {
            return round($seconds / 3600, 2) . ' hours';
        } elseif ($seconds < 31536000) {
            return round($seconds / 86400, 2) . ' days';
        } else {
            return round($seconds / 31536000, 2) . ' years';
        }
    }
}
