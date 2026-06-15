<?php

namespace App\Services\AiGateway;

use App\Helpers\GlobalSecretReader;

/**
 * Indexed secret loader — the PHP twin of pycore's
 * pyfoundations.secret_manager.get_secret_key_indexed.
 *
 * A logical AI/provider secret is stored as <BASE>_1 .. <BASE>_N (key rotation /
 * multiple accounts) and sometimes as a bare <BASE>. Callers MUST NOT hardcode a
 * single index: if _1 is absent the value may live under _2.._5. Both pycore and
 * Laravel read the SAME files under <core_node>/.secret_keys/.secret_ignore via
 * GlobalSecretReader, so this loader keeps the exact same resolution order:
 *
 *     <BASE>_1, <BASE>_2, ... <BASE>_<maxIndex>, then bare <BASE>
 *
 * First non-empty value wins.
 */
class AiSecretLoader
{
    /**
     * Resolve a secret by base name, auto-scanning numbered variants.
     */
    public static function getIndexed(string $baseName, int $maxIndex = 5): string
    {
        if ($baseName === '') {
            return '';
        }

        for ($i = 1; $i <= $maxIndex; $i++) {
            $value = trim(GlobalSecretReader::getSecretContent($baseName . '_' . $i));
            if ($value !== '') {
                return $value;
            }
        }

        return trim(GlobalSecretReader::getSecretContent($baseName));
    }

    /**
     * ALL non-empty numbered variants of a base secret, in resolution order.
     *
     * The PHP twin of pycore's secret_manager.get_all_secret_keys_indexed: same
     * convention as getIndexed() but returns EVERY key found
     * (<BASE>_1 .. <BASE>_<maxIndex> then bare <BASE>) so callers can ROTATE
     * across multiple keys/accounts (try KEY_1, then KEY_2 on a rate-limit /
     * quota error). Duplicates are removed while preserving order.
     *
     * @return string[] distinct non-empty secret values (possibly empty)
     */
    public static function getAllIndexed(string $baseName, int $maxIndex = 5): array
    {
        if ($baseName === '') {
            return [];
        }

        $found = [];
        $seen = [];
        for ($i = 1; $i <= $maxIndex; $i++) {
            $value = trim(GlobalSecretReader::getSecretContent($baseName . '_' . $i));
            if ($value !== '' && !isset($seen[$value])) {
                $seen[$value] = true;
                $found[] = $value;
            }
        }
        $bare = trim(GlobalSecretReader::getSecretContent($baseName));
        if ($bare !== '' && !isset($seen[$bare])) {
            $found[] = $bare;
        }
        return $found;
    }

    /**
     * Read a single secret by its exact key name (no index scanning).
     */
    public static function get(string $keyName): string
    {
        return trim(GlobalSecretReader::getSecretContent($keyName));
    }
}
