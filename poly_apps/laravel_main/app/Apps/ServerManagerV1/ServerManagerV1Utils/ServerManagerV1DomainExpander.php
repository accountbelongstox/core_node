<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

/**
 * Domain/SAN expansion library for certificate issuance (Let's Encrypt rules).
 *
 * The Let's Encrypt constraints this library encodes:
 *   - at most ONE wildcard per name, as the entire leftmost label
 *     ("*.example.com" valid; "*.*.example.com" / "foo.*.example.com" invalid)
 *   - a wildcard covers exactly ONE label level: "*.12gm.com" covers
 *     "api.12gm.com" but NOT "api.si.12gm.com" — deeper coverage is only
 *     possible by enumerating one wildcard per region prefix
 *     ("*.si.12gm.com"), which is exactly what expand() generates
 *   - <= 100 SAN entries per certificate; name <= 253 chars; label <= 63
 *
 * Given one base domain (or a group of them), expand() produces the
 * canonical SAN set: the apex, its wildcard, and one wildcard per region
 * prefix. Bare prefix domains (si.12gm.com) are already covered by
 * *.12gm.com and are intentionally not listed.
 *
 * SYNC CONTRACT: this is the single implementation of SAN expansion. The
 * shell end (scripts/shells/linux/common/domain_setup_common.sh) never
 * expands SANs itself — it calls `artisan servermanager:certificate`, which
 * funnels into this class via ServerManagerV1CertificateManager. The region
 * prefix choices offered by the shell end (si/sh/sz/hk/custom) mirror
 * DEFAULT_REGION_PREFIXES.
 */
final class ServerManagerV1DomainExpander
{
    // Region prefixes expanded into one wildcard SAN each. SYNC with the
    // shell end region choices (domain_setup_common.sh: si/sh/sz/hk/custom).
    public const array DEFAULT_REGION_PREFIXES = ['si', 'sh', 'sz', 'hk', 'local', 'api'];

    public const int MAX_SAN_ENTRIES = 100;
    private const int MAX_NAME_LENGTH = 253;
    private const int MAX_LABEL_LENGTH = 63;

    /**
     * Lowercase, trim, strip the trailing root dot.
     */
    public static function normalize(string $domain): string
    {
        return rtrim(strtolower(trim($domain)), '.');
    }

    public static function isWildcard(string $domain): bool
    {
        return str_starts_with(self::normalize($domain), '*.');
    }

    /**
     * Valid per ACME/Let's Encrypt: exactly one '*', as the entire leftmost
     * label.
     */
    public static function isValidWildcard(string $domain): bool
    {
        $domain = self::normalize($domain);
        if (!str_starts_with($domain, '*.')) {
            return false;
        }
        return substr_count($domain, '*') === 1;
    }

    /**
     * Wildcard-stripped form: "*.si.12gm.com" -> "si.12gm.com".
     */
    public static function baseDomain(string $domain): string
    {
        $domain = self::normalize($domain);
        return str_starts_with($domain, '*.') ? substr($domain, 2) : $domain;
    }

    /**
     * Resolve the registrable base for expansion: strips the wildcard marker
     * and any leading labels that are known region prefixes
     * (api.si.12gm.com -> 12gm.com). Without a Public Suffix List dependency
     * an arbitrary subdomain (www.12gm.com) cannot be resolved to its apex —
     * pass apex/base domains whenever possible.
     */
    public static function resolveBaseDomain(string $domain, ?array $prefixes = null): string
    {
        $prefixes = $prefixes ?? self::DEFAULT_REGION_PREFIXES;
        $labels = explode('.', self::baseDomain($domain));
        while (count($labels) > 2 && in_array($labels[0], $prefixes, true)) {
            array_shift($labels);
        }
        return implode('.', $labels);
    }

    /**
     * One base domain -> canonical SAN set:
     *   12gm.com, *.12gm.com, *.si.12gm.com, *.sh.12gm.com, ...
     */
    public static function expandBase(string $baseDomain, ?array $prefixes = null): array
    {
        $prefixes = $prefixes ?? self::DEFAULT_REGION_PREFIXES;
        $base = self::baseDomain($baseDomain);
        $domains = [$base, '*.' . $base];
        foreach ($prefixes as $prefix) {
            $domains[] = '*.' . $prefix . '.' . $base;
        }
        return $domains;
    }

    /**
     * One domain or a group of domains -> canonical SAN set, deduplicated,
     * order preserved. Each input is normalized, validated and resolved to
     * its base before expansion; invalid entries are skipped and reported in
     * $errors.
     */
    public static function expand(string|array $domains, ?array $prefixes = null, ?array &$errors = null): array
    {
        $errors = [];
        $result = [];
        foreach ((array) $domains as $input) {
            $input = self::normalize((string) $input);
            if ($input === '') {
                continue;
            }
            if (str_contains($input, '*') && !self::isValidWildcard($input)) {
                $errors[] = "Invalid wildcard (Let's Encrypt allows a single leftmost wildcard only): $input";
                continue;
            }
            if (!self::isValidName(self::baseDomain($input))) {
                $errors[] = "Invalid domain name: $input";
                continue;
            }
            foreach (self::expandBase(self::resolveBaseDomain($input, $prefixes), $prefixes) as $entry) {
                if (!in_array($entry, $result, true)) {
                    $result[] = $entry;
                }
            }
        }
        if (count($result) > self::MAX_SAN_ENTRIES) {
            $errors[] = 'SAN entry count ' . count($result) . " exceeds the Let's Encrypt limit of " . self::MAX_SAN_ENTRIES;
        }
        return $result;
    }

    /**
     * Hostname shape check (labels a-z0-9 plus inner hyphens, label <= 63
     * chars, name <= 253 chars).
     */
    public static function isValidName(string $domain): bool
    {
        if ($domain === '' || strlen($domain) > self::MAX_NAME_LENGTH) {
            return false;
        }
        foreach (explode('.', $domain) as $label) {
            if ($label === '' || strlen($label) > self::MAX_LABEL_LENGTH
                || preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/', $label) !== 1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Is $fqdn covered by the SAN set? Direct match or a single-level
     * wildcard against the parent — the only two forms Let's Encrypt honors.
     */
    public static function covers(string $fqdn, array $sanEntries): bool
    {
        $fqdn = self::normalize($fqdn);
        if (in_array($fqdn, $sanEntries, true)) {
            return true;
        }
        $labels = explode('.', $fqdn);
        if (count($labels) > 1) {
            $wildcard = '*.' . implode('.', array_slice($labels, 1));
            if (in_array($wildcard, $sanEntries, true)) {
                return true;
            }
        }
        return false;
    }
}
