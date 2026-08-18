<?php

namespace App\Support;

use RuntimeException;

/**
 * Canonical Laravel-end web-server plane resolver (DESIGN_20260817_2115
 * PART_0 §0.3): ONE shared plane constant, never parsed from another
 * script's state.
 *
 * SYNC CONTRACT (two ends, one truth): the plane record is the
 * WEB_SERVER_PLANE global var. The shell end resolves it through
 * gvar_common.sh web_server_plane() / set_web_server_plane(); this class is
 * the PHP end reading/writing the same file. Any change to the constant's
 * name, allowed values, or default MUST be applied to both ends in the same
 * change. Default plane = service contract planes.web_server_default
 * (frankenphp: single octane:frankenphp process, built-in Mercure hub on
 * 443/h2/h3).
 */
final class WebServerPlane
{
    public const FRANKENPHP = 'frankenphp';
    public const NGINX = 'nginx';

    /** Global-var store root (mirrors gvar_common.sh CORE_NODE_DATA_DIR). */
    private const GVAR_DIR = '/var/_core_node/global_var';

    /** Allowed planes (mirrors set_web_server_plane's case arms). */
    public const PLANES = [self::FRANKENPHP, self::NGINX];

    /**
     * The active plane: WEB_SERVER_PLANE gvar when readable and known, else
     * the contract default. Never throws - an unreadable store degrades to
     * the default plane.
     */
    public static function current(): string
    {
        $file = self::GVAR_DIR . DIRECTORY_SEPARATOR . 'WEB_SERVER_PLANE';
        if (is_file($file) && is_readable($file)) {
            $value = trim((string) strtok((string) @file_get_contents($file), "\r\n"));
            if (in_array($value, self::PLANES, true)) {
                return $value;
            }
        }

        $default = ServiceContract::document()['planes']['web_server_default'] ?? null;

        return is_string($default) && in_array($default, self::PLANES, true)
            ? $default
            : self::FRANKENPHP;
    }

    public static function isFrankenPhp(): bool
    {
        return self::current() === self::FRANKENPHP;
    }

    /**
     * Adopt a plane (record-only switch, mirrors set_web_server_plane 'false'
     * fan-out mode): writes the constant so every plane-aware resolver on both
     * ends converges. Runtime adoption (service stop/start, Caddyfile/nginx
     * provisioning) stays with the shell installers (26/27/28) and 132.
     */
    public static function adopt(string $plane): bool
    {
        if (!in_array($plane, self::PLANES, true)) {
            throw new RuntimeException('Plane must be frankenphp or nginx');
        }

        $dir = self::GVAR_DIR;
        if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
            return false;
        }

        return @file_put_contents($dir . DIRECTORY_SEPARATOR . 'WEB_SERVER_PLANE', $plane . "\n") !== false;
    }

    private function __construct()
    {
    }
}
