<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;

final class ServerManagerV1NuxtSystemdConfig
{
    public static function production(string $appName, string $factoryPath, int $port): string
    {
        $nodePath = PathMapper::getNodeBinaryPath();
        $path = self::binaryPath([dirname($nodePath)]);

        return <<<SERVICE
[Unit]
Description=Nuxt PolyApp - $appName (Production)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$factoryPath
Environment="PATH=$path"
Environment="NODE_ENV=production"
Environment="PORT=$port"
Environment="NITRO_PORT=$port"
Environment="NUXT_APP_NAMESPACE=$appName"
ExecStart=$nodePath $factoryPath/.output/server/index.mjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE;
    }

    public static function debug(string $appName, int $port): string
    {
        $nodePath = PathMapper::getNodeBinaryPath();
        $pnpmPath = PathMapper::getPnpmBinaryPath();
        $coreNodeDirectory = PathMapper::getCoreNodeDir();
        $nuxtMainPath = $coreNodeDirectory . '/poly_apps/nuxt_main';
        $switchScript = $nuxtMainPath . '/scripts/switch-app.js';
        $path = self::binaryPath([dirname($nodePath), dirname($pnpmPath)]);

        return <<<SERVICE
[Unit]
Description=Nuxt PolyApp - $appName (Debug Mode - Factory with File Watcher)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$nuxtMainPath
Environment="PATH=$path"
Environment="NODE_ENV=development"
Environment="PORT=$port"
Environment="NITRO_PORT=$port"
Environment="NUXT_PORT=$port"
Environment="NUXT_HOST=0.0.0.0"
Environment="APP_ENTRY=$appName"
ExecStart=$nodePath $switchScript $appName --mode dev
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE;
    }

    private static function binaryPath(array $directories): string
    {
        return implode(':', array_unique([
            ...$directories,
            '/usr/local/bin',
            '/usr/bin',
            '/bin',
        ]));
    }
}
