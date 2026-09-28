<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;

/**
 * Single source of truth for nginx vhost generation (modern nginx >= 1.30
 * with HTTP/3, HTTP/2, TLS 1.3 early data). Every caller (controllers,
 * domain manager, CLI commands) renders through this builder so all sites
 * share one canonical TLS/QUIC stanza.
 *
 * SYNC CONTRACT (two ends, one truth): this is the Laravel end of the nginx
 * vhost templates. The shell end is:
 *   scripts/shells/linux/common/nginx_common.sh
 *     (nginx_render_tls_stanza / nginx_render_site_vhost /
 *      nginx_render_proxy_vhost / nginx_render_http_bootstrap)
 *   scripts/shells/linux/common/nginx_manager.sh (nm_http3_migrate)
 * Any change to the TLS/QUIC stanza, the 301 redirect server, the api.*
 * direct-proxy :80 block, the early-data guard, or the ACME location MUST
 * be applied to both ends in the same
 * change. Initial provisioning renders through the shell end; afterwards the
 * UI (http://127.0.0.1:13054/laravel-manager#/server) manages sites through
 * this builder via the laravel_main API.
 */
class ServerManagerV1NginxConfigBuilder
{
    /**
     * True when the domain's first label is "api" (api.<region>.<domain>).
     * api.* vhosts proxy directly on :80 (no 301) so plain HTTP reaches the
     * backend even while the cloud security group blocks 443; apex domains
     * keep the 301. Single Laravel-end copy of the api/apex rule (shell
     * mirror: nginx_is_api_fqdn in nginx_common.sh).
     */
    public static function isApiDomain(string $domain): bool
    {
        $first = preg_split('/\s+/', trim($domain))[0];

        return str_starts_with($first, 'api.');
    }

    /**
     * Render the canonical TLS + HTTP/3 listener stanza for an HTTPS server
     * block. Uses the modern directive syntax (http2 on / http3 on instead
     * of the deprecated "listen ... http2" parameter).
     */
    public static function renderTlsStanza(string $certPath, string $keyPath, string $indent = '    '): string
    {
        $lines = [
            'listen 443 ssl;',
            'listen [::]:443 ssl;',
            'listen 443 quic;',
            'listen [::]:443 quic;',
            'http2 on;',
            'http3 on;',
            'quic_retry on;',
        ];

        // Fixed QUIC host key (shell mirror: nginx_ensure_quic_host_key in
        // nginx_common.sh): without it every reload generates a random key and
        // voids outstanding quic_retry tokens. Rendered only when the key file
        // is really in place so the stanza stays nginx -t valid.
        $quicHostKey = self::ensureQuicHostKey();
        if ($quicHostKey !== null) {
            $lines[] = "quic_host_key {$quicHostKey};";
        }

        $lines = array_merge($lines, [
            "ssl_certificate {$certPath};",
            "ssl_certificate_key {$keyPath};",
            'ssl_protocols TLSv1.2 TLSv1.3;',
            'ssl_early_data on;',
            'ssl_session_cache shared:SSL:10m;',
            'ssl_session_timeout 1d;',
            'ssl_session_tickets off;',
            "add_header Alt-Svc 'h3=\":443\"; ma=86400' always;",
        ]);

        return implode("\n", array_map(
            static fn (string $line): string => $indent . $line,
            $lines
        ));
    }

    /**
     * Ensure the fixed QUIC host key exists (created once, 32 random bytes)
     * and return its path; null when it cannot be ensured (the stanza then
     * omits the directive). Shell mirror: nginx_quic_host_key_file /
     * nginx_ensure_quic_host_key in nginx_common.sh.
     */
    private static function ensureQuicHostKey(): ?string
    {
        try {
            $file = \App\Providers\PathMapper::mapWebPath('nginxconfig') . '/ssl/quic/host.key';
            if (is_file($file)) {
                return $file;
            }
            $dir = dirname($file);
            if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
                return null;
            }
            if (@file_put_contents($file, random_bytes(32)) === false) {
                return null;
            }
            @chmod($file, 0600);

            return $file;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Render the port-80 redirect server that forwards plain HTTP traffic
     * to HTTPS while still answering ACME HTTP-01 challenges.
     */
    public static function renderHttpRedirectServer(string $serverNames, string $indent = '    '): string
    {
        return "server {
{$indent}listen 80;
{$indent}listen [::]:80;
{$indent}server_name {$serverNames};

{$indent}location ^~ /.well-known/acme-challenge/ {
{$indent}    allow all;
{$indent}    root /var/www/html;
{$indent}    try_files \$uri =404;
{$indent}}

{$indent}return 301 https://\$server_name\$request_uri;
}";
    }

    /**
     * Render the port-80 DIRECT-PROXY server for api.* vhosts: plain HTTP
     * reaches the backend without a 301 (443 may be blocked by the cloud
     * security group), while the ACME HTTP-01 location stays local for
     * renewals. Mirror of the shell end's http_mode=proxy block
     * (nginx_render_proxy_vhost in nginx_common.sh).
     */
    public static function renderHttpProxyServer(string $serverNames, string $upstream, string $indent = '    '): string
    {
        return "server {
{$indent}listen 80;
{$indent}listen [::]:80;
{$indent}server_name {$serverNames};

{$indent}location / {
" . self::proxyLocationBody($upstream, false) . "
{$indent}}

{$indent}location /ws {
" . self::proxyWsLocationBody($upstream) . "
{$indent}}

" . self::acmeLocation($indent) . "
{$indent}location /health {
{$indent}    access_log off;
{$indent}    return 200 \"healthy\\n\";
{$indent}    add_header Content-Type text/plain;
{$indent}}
}";
    }

    /**
     * Resolve certificate paths for a domain. Defaults to the Let's Encrypt
     * live directory; callers managing their own certificate storage pass
     * explicit 'cert'/'key' entries via $certPaths.
     *
     * @param array{cert?: string, key?: string}|null $certPaths
     * @return array{cert: string, key: string}
     */
    public static function resolveCertPaths(string $domain, ?array $certPaths = null): array
    {
        if (isset($certPaths['cert'], $certPaths['key'])) {
            return ['cert' => $certPaths['cert'], 'key' => $certPaths['key']];
        }

        return [
            'cert' => ServerManagerV1PathConfig::getLetsEncryptCertPath($domain),
            'key' => ServerManagerV1PathConfig::getLetsEncryptKeyPath($domain),
        ];
    }

    /**
     * Build a static-site vhost. With certificates present the pair
     * (80 redirect + 443 HTTP/3 server) is emitted, otherwise a single
     * port-80 server. SPA fallback routes missing paths to /index.html.
     *
     * @param array{cert?: string, key?: string}|null $certPaths
     */
    public static function buildStatic(string $domain, string $wwwDir, ?array $certPaths = null, bool $spaFallback = false): string
    {
        $certs = self::resolveCertPaths($domain, $certPaths);

        $header = "# Static website configuration for {$domain}\n"
            . "# Generated by ServerManagerV1NginxConfigBuilder\n\n";

        if ($certs['cert'] !== null && $certs['key'] !== null && self::certFilesExist($certs)) {
            return $header
                . self::renderHttpRedirectServer($domain)
                . "\n\nserver {\n"
                . self::renderTlsStanza($certs['cert'], $certs['key'])
                . "\n    server_name {$domain};\n\n"
                . self::staticLocationBody($wwwDir, $spaFallback)
                . "\n}\n";
        }

        return $header
            . "server {\n"
            . "    listen 80;\n"
            . "    listen [::]:80;\n"
            . "    server_name {$domain};\n\n"
            . self::staticLocationBody($wwwDir, $spaFallback)
            . "\n}\n";
    }

    /**
     * Build a reverse-proxy vhost with WebSocket support and the
     * Early-Data replay guard forwarded to the backend.
     *
     * @param array{cert?: string, key?: string}|null $certPaths
     */
    public static function buildProxy(string $domain, string $proxyTarget, ?array $certPaths = null): string
    {
        $certs = self::resolveCertPaths($domain, $certPaths);
        $primaryDomain = preg_split('/\s+/', trim($domain))[0];
        $upstream = self::upstreamName($primaryDomain);
        $address = self::proxyTargetToAddress($proxyTarget);

        // Fail loud on an unreadable contract: an empty host/port would
        // render "server :;" and break nginx -t for the whole include tree.
        if (!preg_match('/^(\[[0-9a-fA-F:]+\]|[^:\/\s]+):\d+$/', $address)) {
            throw new \InvalidArgumentException("Invalid proxy_target '{$proxyTarget}': expected scheme://host:port");
        }

        $header = "# Reverse proxy configuration for {$domain}\n"
            . "# Generated by ServerManagerV1NginxConfigBuilder\n\n"
            . "upstream {$upstream} {\n"
            . "    server {$address};\n"
            . "    keepalive 32;\n}\n\n";

        $body = "    location / {\n"
            . self::proxyLocationBody($upstream, true)
            . "\n    }\n\n    location /ws {\n"
            . self::proxyWsLocationBody($upstream)
            . "\n    }\n"
            . self::acmeLocation('    ')
            . "\n    location /health {\n"
            . "        access_log off;\n"
            . "        return 200 \"healthy\\n\";\n"
            . "        add_header Content-Type text/plain;\n"
            . "    }\n";

        // api.* vhosts proxy directly on :80 (no 301) so plain HTTP reaches
        // the backend even while 443 is blocked; apex keeps the 301 pair.
        $httpServer = self::isApiDomain($primaryDomain)
            ? self::renderHttpProxyServer($domain, $upstream)
            : self::renderHttpRedirectServer($domain);

        if ($certs['cert'] !== null && $certs['key'] !== null && self::certFilesExist($certs)) {
            return $header
                . $httpServer
                . "\n\nserver {\n"
                . self::renderTlsStanza($certs['cert'], $certs['key'])
                . "\n    server_name {$domain};\n\n"
                . $body
                . "\n}\n";
        }

        return $header
            . "server {\n"
            . "    listen 80;\n"
            . "    listen [::]:80;\n"
            . "    server_name {$domain};\n\n"
            . $body
            . "\n}\n";
    }

    /**
     * Build a Laravel (PHP-FPM) vhost.
     *
     * @param array{cert?: string, key?: string}|null $certPaths
     */
    public static function buildLaravel(string $domain, string $publicDir, string $phpVersion, ?array $certPaths = null): string
    {
        return self::buildPhp($domain, $publicDir, $phpVersion, $certPaths, true);
    }

    /**
     * Build a generic PHP vhost (Laravel flavor adds SPA fallback and
     * deny rules for framework-sensitive paths).
     *
     * @param array{cert?: string, key?: string}|null $certPaths
     */
    public static function buildPhp(string $domain, string $wwwDir, string $phpVersion, ?array $certPaths = null, bool $laravel = false): string
    {
        $certs = self::resolveCertPaths($domain, $certPaths);

        $header = "# PHP application configuration for {$domain}\n"
            . "# Generated by ServerManagerV1NginxConfigBuilder\n\n";

        $phpBody = "    root {$wwwDir};\n"
            . "    index index.php index.html index.htm;\n\n"
            . "    location / {\n"
            . "        try_files \$uri \$uri/ " . ($laravel ? '/index.php?$query_string;' : '=404;') . "\n"
            . "    }\n\n"
            . "    location ~ \\.php\$ {\n"
            . "        fastcgi_pass unix:/run/php/php{$phpVersion}-fpm.sock;\n"
            . "        fastcgi_index index.php;\n"
            . "        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;\n"
            . "        include fastcgi_params;\n"
            . "        fastcgi_read_timeout 240;\n"
            . "    }\n\n"
            . "    location ~ /\\.(?!well-known).* {\n"
            . "        deny all;\n"
            . "    }\n"
            . self::acmeLocation('    ');

        if ($laravel) {
            $phpBody .= "\n    location ~ /(^|/)(storage|bootstrap/cache) {\n"
                . "        deny all;\n"
                . "    }\n";
        }

        if ($certs['cert'] !== null && $certs['key'] !== null && self::certFilesExist($certs)) {
            return $header
                . self::renderHttpRedirectServer($domain)
                . "\n\nserver {\n"
                . self::renderTlsStanza($certs['cert'], $certs['key'])
                . "\n    server_name {$domain};\n\n"
                . $phpBody
                . "\n}\n";
        }

        return $header
            . "server {\n"
            . "    listen 80;\n"
            . "    listen [::]:80;\n"
            . "    server_name {$domain};\n\n"
            . $phpBody
            . "\n}\n";
    }

    /**
     * Dispatcher matching the site types used by the controllers and the
     * domain manager. Throws for unknown types so callers surface the error.
     *
     * @param array{www_dir?: string, php_version?: string, proxy_target?: string, cert_paths?: array{cert?: string, key?: string}} $config
     */
    public static function build(string $domain, string $siteType, array $config, bool $sslEnabled = false): string
    {
        $wwwRoot = \App\Providers\PathMapper::mapWebPath('wwwroot');
        $wwwDir = $config['www_dir'] ?? "{$wwwRoot}/{$domain}";
        $phpVersion = $config['php_version'] ?? '8.4';
        $proxyTarget = $config['proxy_target'] ?? null;
        $certPaths = $sslEnabled ? ($config['cert_paths'] ?? null) : null;

        switch ($siteType) {
            case 'laravel':
                return self::buildLaravel($domain, $wwwDir . '/public', $phpVersion, $certPaths);
            case 'static':
            case 'html':
                return self::buildStatic($domain, $wwwDir, $certPaths);
            case 'proxy':
                if (!$proxyTarget) {
                    throw new \InvalidArgumentException('proxy_target is required for proxy site type');
                }
                return self::buildProxy($domain, $proxyTarget, $certPaths);
            case 'php':
                return self::buildPhp($domain, $wwwDir, $phpVersion, $certPaths);
            default:
                throw new \InvalidArgumentException("Unsupported site type: {$siteType}");
        }
    }

    /**
     * Shared static-content body (root, headers, caching, deny rules).
     */
    private static function staticLocationBody(string $wwwDir, bool $spaFallback): string
    {
        $fallback = $spaFallback ? '/index.html;' : '=404;';

        return "    root {$wwwDir};\n"
            . "    index index.html index.htm;\n\n"
            . "    add_header X-Frame-Options \"SAMEORIGIN\" always;\n"
            . "    add_header X-Content-Type-Options \"nosniff\" always;\n"
            . "    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n\n"
            . "    location / {\n"
            . "        try_files \$uri \$uri/ {$fallback}\n"
            . "    }\n\n"
            . "    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {\n"
            . "        expires 1y;\n"
            . "        add_header Cache-Control \"public, immutable\";\n"
            . "        access_log off;\n"
            . "    }\n\n"
            . "    location ~ /\\.(?!well-known).* {\n"
            . "        deny all;\n"
            . "    }\n"
            . self::acmeLocation('    ');
    }

    /**
     * Shared proxy location body. Early-Data header is only meaningful on
     * TLS listeners (RFC 8470 replay protection), hence $withEarlyData.
     */
    private static function proxyLocationBody(string $upstream, bool $withEarlyData): string
    {
        $earlyData = $withEarlyData
            ? "        proxy_set_header Early-Data \$ssl_early_data;\n"
            : '';

        return "        {$earlyData}proxy_pass http://{$upstream};\n"
            . "        proxy_http_version 1.1;\n"
            . "        proxy_set_header Upgrade \$http_upgrade;\n"
            . "        proxy_set_header Connection 'upgrade';\n"
            . "        proxy_set_header Host \$host;\n"
            . "        proxy_set_header X-Real-IP \$remote_addr;\n"
            . "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n"
            . "        proxy_set_header X-Forwarded-Proto \$scheme;\n"
            . "        proxy_set_header X-Forwarded-Host \$server_name;\n"
            . "        proxy_connect_timeout 60s;\n"
            . "        proxy_send_timeout 60s;\n"
            . "        proxy_read_timeout 60s;";
    }

    /**
     * WebSocket location body: long-lived connections (86400s read timeout),
     * no Early-Data guard. Mirrors the /ws leg of the shell end's
     * nginx_render_proxy_locations.
     */
    private static function proxyWsLocationBody(string $upstream): string
    {
        return "        proxy_pass http://{$upstream};\n"
            . "        proxy_http_version 1.1;\n"
            . "        proxy_set_header Upgrade \$http_upgrade;\n"
            . "        proxy_set_header Connection \"upgrade\";\n"
            . "        proxy_set_header Host \$host;\n"
            . "        proxy_set_header X-Real-IP \$remote_addr;\n"
            . "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n"
            . "        proxy_set_header X-Forwarded-Proto \$scheme;\n"
            . "        proxy_read_timeout 86400;";
    }

    /**
     * ACME HTTP-01 challenge location reused by every vhost flavor.
     */
    private static function acmeLocation(string $indent): string
    {
        return "{$indent}location ^~ /.well-known/acme-challenge/ {\n"
            . "{$indent}    allow all;\n"
            . "{$indent}    root /var/www/html;\n"
            . "{$indent}    try_files \$uri =404;\n"
            . "{$indent}}\n";
    }

    /**
     * Deterministic, nginx-safe upstream name for a domain.
     */
    private static function upstreamName(string $domain): string
    {
        return preg_replace('/[^a-zA-Z0-9_]/', '_', $domain) . '_backend';
    }

    /**
     * Strip the scheme and trailing slash from a proxy target URL so it can
     * be used inside an upstream server directive.
     */
    private static function proxyTargetToAddress(string $proxyTarget): string
    {
        $address = preg_replace('#^[a-zA-Z][a-zA-Z0-9+.-]*://#', '', $proxyTarget);

        return rtrim((string) $address, '/');
    }

    /**
     * Certificates must exist on disk before HTTPS listeners reference them
     * (nginx -t fails otherwise).
     *
     * @param array{cert: string, key: string} $certs
     */
    private static function certFilesExist(array $certs): bool
    {
        return is_file($certs['cert']) && is_file($certs['key']);
    }
}
