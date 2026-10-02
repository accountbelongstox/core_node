<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use RuntimeException;

/**
 * Laravel adapter for the canonical service contract (ports, loopback host,
 * shared external data paths, shared file names).
 *
 * Source: config/service_contract.json (repo root)
 * Aligned adapters:
 * - scripts/shells/linux/common/service_contract_common.sh
 * - poly_apps/pycore_laravel_wordnew_ui/core/contracts/ServiceContract.ts
 *
 * A port, host, shared path or shared file name must be changed in the JSON
 * source first; every end reads the same file. Mirrors the path resolution
 * of QueueCenterContract (config/ at the repo root).
 */
final class ServiceContract
{
    private const LABEL = 'service contract';
    private const HOME_DATA_DIR_FALLBACK_KEY = 'home_data_dir_fallback';
    private const DRIVE_LAYOUT_PATH = 'paths.drive_layout';
    private const RULE_NEGATION_PREFIX = 'not ';
    private const POSIX_SEPARATOR = '/';
    private const WINDOWS_SEPARATOR = '\\';

    private static ?array $document = null;

    public static function document(): array
    {
        if (self::$document !== null) {
            return self::$document;
        }

        $path = PathMapper::getCoreNodeDir().DIRECTORY_SEPARATOR.'config'
            .DIRECTORY_SEPARATOR.'service_contract.json';
        $json = FileSystemManager::readFile($path, false);
        $document = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($document)) {
            throw new RuntimeException("Unable to load service contract: {$path}");
        }

        self::$document = $document;

        return self::$document;
    }

    public static function port(string $name): int
    {
        $ports = self::document()['ports'] ?? [];
        if (!isset($ports[$name]) || !is_int($ports[$name])) {
            throw new RuntimeException("Unknown service contract port: {$name}");
        }

        return $ports[$name];
    }

    public static function host(string $name): string
    {
        $hosts = self::document()['hosts'] ?? [];
        if (!isset($hosts[$name]) || !is_string($hosts[$name])) {
            throw new RuntimeException("Unknown service contract host: {$name}");
        }

        return $hosts[$name];
    }

    public static function file(string $name): string
    {
        $files = self::document()['files'] ?? [];
        if (!isset($files[$name]) || !is_string($files[$name])) {
            throw new RuntimeException("Unknown service contract file: {$name}");
        }

        return $files[$name];
    }

    public static function path(string $name): string
    {
        $paths = self::document()['paths'] ?? [];
        if (!isset($paths[$name]) || !is_string($paths[$name]) || $paths[$name] === '') {
            throw new RuntimeException("Unknown service contract path: {$name}");
        }

        return $paths[$name];
    }

    public static function string(string $path): string
    {
        return ContractDocument::string(self::document(), $path, self::LABEL);
    }

    public static function positiveInt(string $path): int
    {
        return ContractDocument::positiveInt(self::document(), $path, self::LABEL);
    }

    public static function boolean(string $path): bool
    {
        return ContractDocument::boolean(self::document(), $path, self::LABEL);
    }

    /**
     * @return array<int, string>
     */
    public static function stringList(string $path): array
    {
        return ContractDocument::stringList(self::document(), $path, self::LABEL);
    }

    /**
     * @return array<string, mixed>
     */
    public static function section(string $path): array
    {
        return ContractDocument::section(self::document(), $path, self::LABEL);
    }

    public static function wwwDirName(): string
    {
        return self::path('www_dir_name');
    }

    public static function coreNodeDataDirName(): string
    {
        return self::path('core_node_data_dir_name');
    }

    public static function globalVarDirName(): string
    {
        return self::path('global_var_dir_name');
    }

    public static function linuxWwwRoot(): string
    {
        return self::path('linux_www_root');
    }

    /** The /www/www level of a dual-boot NTFS /www mount (detection only). */
    public static function linuxNtfsNestedWwwRoot(): string
    {
        return self::path('linux_ntfs_nested_www_root');
    }

    public static function legacyLinuxDataDir(): string
    {
        return self::path('legacy_linux_data_dir');
    }

    /**
     * Dual-boot drive layout (paths.drive_layout): tree, tool and toolchain
     * roots per OS and the Windows program-drive letters.
     *
     * @return array<string, mixed>
     */
    public static function driveLayout(): array
    {
        return self::section(self::DRIVE_LAYOUT_PATH);
    }

    /** Windows program drive used when no program drive is recorded (drive_layout.program_drive_fallback, e.g. D:). */
    public static function windowsProgramDriveFallback(): string
    {
        return self::string(self::DRIVE_LAYOUT_PATH.'.program_drive_fallback');
    }

    /** Parent directory of drive_layout.tool_root.linux (the ext4 base that holds every /_<os>_<ver> tool root). */
    public static function linuxToolBase(): string
    {
        $toolRoot = self::string(self::DRIVE_LAYOUT_PATH.'.tool_root.linux');
        $separatorAt = strrpos($toolRoot, self::POSIX_SEPARATOR);

        if ($separatorAt === false) {
            throw new RuntimeException('Unknown service contract Linux tool root: '.$toolRoot);
        }

        return $separatorAt === 0 ? self::POSIX_SEPARATOR : substr($toolRoot, 0, $separatorAt);
    }

    /** Windows data drive root in native form (paths.windows_data_drive_root, e.g. D:\). */
    public static function windowsDataDriveRoot(): string
    {
        return rtrim(str_replace('/', self::WINDOWS_SEPARATOR, self::path('windows_data_drive_root')), self::WINDOWS_SEPARATOR)
            .self::WINDOWS_SEPARATOR;
    }

    /**
     * The word-batch TTS engine: the one engine of tts_runtime_plan word_batch,
     * equal in every mode (pycore runtime_profile reads the same plan).
     */
    public static function ttsWordBatchEngine(): string
    {
        $engines = self::stringList('tts_runtime_plan.cpu.word_batch');
        if (count($engines) !== 1 || $engines !== self::stringList('tts_runtime_plan.gpu.word_batch')) {
            throw new RuntimeException('Service contract tts_runtime_plan word_batch must be one engine, equal in every mode');
        }

        return $engines[0];
    }

    /**
     * @return array<int, string>
     */
    public static function ntfsFileSystemTypes(): array
    {
        return self::stringList('paths.ntfs_fs_types');
    }

    /**
     * Linux data dir candidates that need a writability test, in contract
     * order (paths.linux_data_dir_candidates), with each "when" rule
     * evaluated from $rules (rule key => holds). The home fallback is
     * excluded; homeDataDirFallback() resolves it.
     *
     * @param array<string, bool> $rules
     * @return array<int, string>
     */
    public static function linuxDataDirCandidates(array $rules): array
    {
        $candidates = [];
        $when = '';
        $negated = false;
        $rule = '';
        $path = '';

        foreach (ContractDocument::section(self::document(), 'paths.linux_data_dir_candidates', self::LABEL) as $candidate) {
            if (!is_array($candidate) || !is_string($candidate['path'] ?? null)) {
                throw new RuntimeException('Unknown service contract data dir candidate');
            }
            if ($candidate['path'] === self::HOME_DATA_DIR_FALLBACK_KEY) {
                continue;
            }
            $when = (string) ($candidate['when'] ?? '');
            if ($when !== '') {
                $negated = str_starts_with($when, self::RULE_NEGATION_PREFIX);
                $rule = $negated ? substr($when, strlen(self::RULE_NEGATION_PREFIX)) : $when;
                if (!array_key_exists($rule, $rules)) {
                    throw new RuntimeException("Unknown service contract data dir rule: {$rule}");
                }
                if ($rules[$rule] === $negated) {
                    continue;
                }
            }
            $path = self::path($candidate['path']);
            if (isset($candidate['join'])) {
                $path = rtrim($path, '/').'/'.self::path((string) $candidate['join']);
            }
            $candidates[] = $path;
        }

        return $candidates;
    }

    /** paths.home_data_dir_fallback with its leading ~ resolved against $home ('' without a home). */
    public static function homeDataDirFallback(string $home): string
    {
        $fallback = self::path(self::HOME_DATA_DIR_FALLBACK_KEY);

        if ($home === '') {
            return '';
        }

        return str_starts_with($fallback, '~') ? rtrim($home, '/'.self::WINDOWS_SEPARATOR).substr($fallback, 1) : $fallback;
    }

    /**
     * The data_sync block (protocol version, status groups, roles, retention).
     *
     * @return array<string, mixed>
     */
    public static function dataSync(): array
    {
        return self::section('data_sync');
    }

    public static function globalVarDirectory(): string
    {
        return PathMapper::getCoreNodeRuntimeDir()
            .DIRECTORY_SEPARATOR.self::globalVarDirName();
    }

    public static function webAccessDocument(): array
    {
        $path = self::globalVarDirectory().DIRECTORY_SEPARATOR.self::file('web_access_config');
        $json = FileSystemManager::readFile($path, false);
        $document = is_string($json) ? json_decode($json, true) : null;
        $prefix = is_array($document) ? ($document['apiRegionPrefix'] ?? null) : null;

        if (!is_array($document)
            || !is_string($prefix)
            || preg_match('/^[a-z0-9][a-z0-9-]{0,30}$/', $prefix) !== 1
        ) {
            throw new RuntimeException("Unable to load web access config: {$path}");
        }

        return $document;
    }

    public static function webAccessStringList(string $name): array
    {
        $value = self::webAccessDocument()[$name] ?? null;
        if (!is_array($value)
            || $value === []
            || array_filter($value, static fn (mixed $item): bool => !is_string($item) || $item === '') !== []) {
            throw new RuntimeException("Unknown web access string list: {$name}");
        }

        return array_values(array_unique($value));
    }

    /**
     * CORS origin patterns for every machine of this machine's own tailnet: a UI page
     * opened on one machine calls the other machines' Laravel. The tailnet is taken
     * from this machine's MagicDNS name in the web access hosts (any mesh provider:
     * Tailscale or Headscale), so other tailnets sharing a public suffix are never allowed.
     */
    public static function tailnetCorsOriginPatterns(): array
    {
        $tailnets = array_filter(array_map(
            static fn (string $host): string => self::tailnetDomainOf($host),
            self::webAccessStringList('allowedHosts'),
        ));

        return array_values(array_map(
            static fn (string $tailnet): string => '#^https?://[a-z0-9-]+\.'.preg_quote($tailnet, '#').'(:\d+)?$#',
            array_unique($tailnets),
        ));
    }

    /**
     * The tailnet domain of a `[api.]<machine>.<tailnet domain>` host for any mesh
     * provider's contract template (access.mesh.<provider>.domain_labels); '' otherwise.
     * Aligned with core/contracts/MeshDomain.ts tailnetDomainOf.
     */
    public static function tailnetDomainOf(string $host): string
    {
        $host = rtrim(strtolower(trim($host)), '.');
        $dnsLabel = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
        $roots = '(?:'.implode('|', array_map(
            static fn (string $root): string => preg_quote($root, '#'),
            self::stringList('access.root_domains'),
        )).')';
        $apiLabel = preg_quote(self::string('access.tailnet.api_label'), '#');

        foreach (['headscale', 'tailscale'] as $provider) {
            $domainPattern = implode('\.', array_map(
                static fn (string $label): string => match (true) {
                    $label === '{root}' => $roots,
                    (bool) preg_match('/^\{\w+\}$/', $label) => $dnsLabel,
                    default => preg_quote($label, '#'),
                },
                self::stringList("access.mesh.{$provider}.domain_labels"),
            ));
            if (preg_match("#^(?:{$apiLabel}\.)?{$dnsLabel}\.({$domainPattern})$#", $host, $match) === 1) {
                return $match[1];
            }
        }

        return '';
    }

    public static function laravelApiBackendUrl(): string
    {
        return 'http://'.self::host('loopback').':'.self::port('laravel_api_backend');
    }

    public static function frankenPhpRoot(): string
    {
        return PathMapper::isWindows()
            ? PathMapper::mapWebPath('www', self::string('paths.frankenphp_root_windows_subpath'))
            : self::path('frankenphp_root_posix');
    }

    public static function pycoreBackendUrl(?string $host = null): string
    {
        return 'http://'.($host ?? self::host('loopback')).':'.self::port('pycore_backend');
    }

    private function __construct()
    {
    }
}
