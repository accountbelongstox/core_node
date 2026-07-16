<?php

namespace App\Services\TimerTasks;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;

/**
 * SSL Certificate Auto-Renewal
 *
 * Daily timer that runs `certbot renew` so certs near expiry are refreshed
 * automatically. `certbot renew` only acts on certificates that are close to
 * expiry (Certbot 4.0: less than 1/3 of lifetime remaining; earlier: <30 days),
 * so running it daily is the documented, safe cadence - it is a no-op when
 * nothing is due. nginx is reloaded only when a cert was actually renewed.
 *
 * Reuses the certbot binary detection + nginx-reload pattern from
 * ServerManagerV1CertificateManagerCtl::renewCertificates(). No-op on hosts
 * where certbot is not installed (Windows dev, no-certbox servers) so it is
 * safe to auto-register everywhere.
 *
 * Auto-discovered by OctaneTimerServiceProvider::autoDiscoverAndRegisterTasks()
 * - dropping this file in app/Services/TimerTasks/ is enough; no manual
 * registration.
 */
class SslCertAutoRenewTask extends OctaneTimerTaskAbstract
{
    /** Once a day (seconds). certbot renew skips non-expiring certs on its own. */
    public function getInterval(): int
    {
        return 86400;
    }

    public function exec(): void
    {
        $certbot = $this->findCertbot();
        if ($certbot === null) {
            return; // Not a certbot host - nothing to renew.
        }

        // --non-interactive: never block on a prompt.
        // --no-random-sleep-on-renew: don't pause the timer.
        // certbot renew only renews certs near expiry, so this is safe daily.
        $result = ServerManagerV1Utils::executeCommand($certbot, [
            'renew', '--non-interactive', '--no-random-sleep-on-renew',
        ]);

        $output = $result['output'] ?? '';
        $noAction = (strpos($output, 'No renewals were attempted') !== false)
            || (strpos($output, 'not yet due for renewal') !== false);

        if (!$result['success'] && !$noAction) {
            $this->logWarning('certbot renew failed', [
                'exit_code' => $result['exit_code'] ?? null,
                'error' => $result['error'] ?? $output,
            ]);
            return;
        }

        if ($noAction) {
            $this->logDebug('no certificates due for renewal');
            return;
        }

        // A cert was renewed - reload nginx so it picks up the new files.
        $reload = ServerManagerV1Utils::executeCommand('sudo', ['nginx', '-s', 'reload']);
        $this->logInfo('certificate(s) renewed; nginx reloaded', [
            'nginx_reloaded' => $reload['success'] ?? false,
            'output' => $output,
        ]);
    }

    /**
     * Locate the certbot binary (absolute paths first, then `which`). Mirrors
     * ServerManagerV1CertificateManagerCtl's detection so behavior matches the
     * manual renew endpoint.
     */
    private function findCertbot(): ?string
    {
        foreach (['/usr/bin/certbot', '/usr/local/bin/certbot', '/usr/sbin/certbot', '/sbin/certbot'] as $p) {
            if (file_exists($p) && is_executable($p)) {
                return $p;
            }
        }
        $which = ServerManagerV1Utils::executeCommand('which', ['certbot']);
        if (!empty($which['success']) && trim($which['output'] ?? '') !== '') {
            return trim($which['output']);
        }
        return null;
    }
}
