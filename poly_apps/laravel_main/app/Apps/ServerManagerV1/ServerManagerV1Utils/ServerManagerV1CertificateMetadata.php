<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

/**
 * Shared metadata used by certificate management flow.
 */
final class ServerManagerV1CertificateMetadata
{
    public const DEFAULT_PROVIDER = 'dnspod';
    public const CERTBOT_BINARY_CANDIDATES = [
        '/usr/bin/certbot',
        '/usr/local/bin/certbot',
        '/usr/sbin/certbot',
        '/sbin/certbot',
    ];

    public const DNSPOD_AUTHENTICATOR = 'certbot-dnspod';
    public const DNSPOD_PROPAGATION_SECONDS = 60;
    public const DNSPOD_CREDENTIALS_FILE = 'certbot-dnspod.ini';
    public const DNSPOD_CREDENTIALS_EMAIL_KEY = 'DNSPOD_EMAILS';
    public const DNSPOD_CREDENTIALS_EMAIL_LEGACY_KEY = 'DNS_DNSPOD_EMAILS';
    public const DNSPOD_CREDENTIALS_TOKEN_KEY = 'DNS_DNSPOD_API_TOKENS';
    public const DNSPOD_CREDENTIALS_TOKEN_LEGACY_KEY = 'DNSPOD_API_TOKENS';
    public const DNSPOD_KEEP_UNTIL_EXPIRING_ARG = '--keep-until-expiring';

    public const CERTBOT_INSTALL_SCRIPT_NAME = '35_install_certbot.sh';
    public const DNSPOD_AUTHENTICATOR_PREFIX = 'certbot';
}

