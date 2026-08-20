<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
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

    /** Allowed planes (mirrors set_web_server_plane's case arms). */
    public const PLANES = [self::FRANKENPHP, self::NGINX];

    /**
     * The active plane: WEB_SERVER_PLANE gvar when readable and known, else
     * the contract default. Never throws - an unreadable store degrades to
     * the default plane.
     */
    public static function current(): string
    {
        $file = self::globalVarDirectory().DIRECTORY_SEPARATOR.'WEB_SERVER_PLANE';
        $content = FileSystemManager::readFile($file, false);
        if (is_string($content)) {
            $value = trim((string) strtok($content, "\r\n"));
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
     * provisioning) stays with the shell installers (33/93) and 175.
     */
    public static function adopt(string $plane): bool
    {
        if (!in_array($plane, self::PLANES, true)) {
            throw new RuntimeException('Plane must be frankenphp or nginx');
        }

        $dir = self::globalVarDirectory();
        if (!FileSystemManager::ensureDirectoryExists($dir)) {
            return false;
        }

        FileSystemManager::writeFile(
            $dir.DIRECTORY_SEPARATOR.'WEB_SERVER_PLANE',
            $plane."\n"
        );

        return self::current() === $plane;
    }

    private static function globalVarDirectory(): string
    {
        $root = PathMapper::isWindows()
            ? PathMapper::mapWebPath('www', ServiceContract::string('paths.core_node_data_dir_windows_subpath'))
            : ServiceContract::string('paths.core_node_data_dir_posix');

        return $root
            .DIRECTORY_SEPARATOR.ServiceContract::string('paths.global_var_dir_name');
    }

    private function __construct()
    {
    }
}
