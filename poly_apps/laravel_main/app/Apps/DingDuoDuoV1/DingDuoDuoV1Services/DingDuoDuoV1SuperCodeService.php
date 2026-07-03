<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Services;

/**
 * Super-code mint / verify. The algorithm is a byte-for-byte port of the 订多多
 * Chrome extension's lib/superCode.ts so codes minted here verify OFFLINE in the
 * extension and vice-versa. Do NOT change the salt, master list, FNV-1a folding,
 * or the DDK-<base>-<sig> format without changing the extension in lockstep.
 */
class DingDuoDuoV1SuperCodeService
{
    /** Shared salt mixed into every signature. Must match lib/superCode.ts. */
    public const SUPER_SALT = 'dingduoduo::supercode::v1';

    /** Always-valid master codes (bypass the signature check). */
    public const MASTER_CODES = [
        'DDK-MASTER-0000',
        'DINGDUODUO-VIP',
        'DDK-SUPER-FOREVER',
    ];

    /**
     * FNV-1a 32-bit hash. Each step masks to 32 bits so the result matches the
     * extension's JS implementation (Math.imul + >>> 0).
     */
    private static function fnv1a32(string $s): int
    {
        $h = 0x811c9dc5;
        $len = strlen($s);
        for ($i = 0; $i < $len; $i++) {
            $h ^= ord($s[$i]);
            $h &= 0xffffffff;
            $h = ($h * 0x01000193) & 0xffffffff;
        }
        return $h;
    }

    /**
     * Signature = last 6 chars of the uppercased 8-wide hex of
     * fnv1a32(strtoupper(base) . SUPER_SALT).
     */
    private static function sig(string $base): string
    {
        $hash = self::fnv1a32(strtoupper($base) . self::SUPER_SALT);
        $hex = str_pad(dechex($hash), 8, '0', STR_PAD_LEFT);
        return substr(strtoupper($hex), -6);
    }

    /**
     * Mint a verifiable super code from an arbitrary base label.
     * base := strtoupper(strip non [A-Z0-9]) limited to 12 chars (fallback 'CODE').
     */
    public static function mint(string $base): string
    {
        $clean = strtoupper(preg_replace('/[^A-Z0-9]/', '', $base));
        $clean = substr($clean, 0, 12);
        if ($clean === '') {
            $clean = 'CODE';
        }
        return 'DDK-' . $clean . '-' . self::sig($clean);
    }

    /**
     * Verify a super code: a master code, or a DDK-<base>-<sig> whose signature
     * recomputes correctly.
     */
    public static function verify(string $code): bool
    {
        $code = strtoupper(trim($code));

        if (in_array($code, self::MASTER_CODES, true)) {
            return true;
        }

        if (preg_match('/^DDK-([A-Z0-9]{1,12})-([0-9A-F]{6})$/', $code, $m)) {
            return self::sig($m[1]) === $m[2];
        }

        return false;
    }
}
