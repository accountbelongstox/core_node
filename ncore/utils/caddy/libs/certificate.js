const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../gvar/basic/logger');
const { CADDY_PATHS } = require('../provider/constants');
const { execCmdResultText } = require('#@commander');

class CaddyCertificate {
    /**
     * Get certificate information for a domain
     * @param {string} domain Domain name
     * @returns {Promise<Object>} Certificate information
     */
    static async getCertInfo(domain) {
        try {
            // Caddy stores certificates in its data directory
            const certPath = path.join(CADDY_PATHS.DATA_DIR, 'caddy', 'certificates');
            const output = await execCmdResultText(
                `${CADDY_PATHS.BIN} certificate list --json`
            );

            const certs = JSON.parse(output);
            const domainCert = certs.find(cert => 
                cert.subjects && cert.subjects.includes(domain)
            );

            if (!domainCert) {
                return {
                    exists: false,
                    message: 'No certificate found for domain'
                };
            }

            return {
                exists: true,
                subject: domainCert.subjects[0],
                issuer: domainCert.issuer,
                expiration: new Date(domainCert.expiration),
                isValid: new Date() < new Date(domainCert.expiration),
                autoRenew: true
            };
        } catch (error) {
            logger.error('Failed to get certificate info:', error.message);
            return null;
        }
    }

    /**
     * Force certificate renewal for a domain
     * @param {string} domain Domain name
     * @returns {Promise<boolean>} Success status
     */
    static async renewCertificate(domain) {
        try {
            await execCmdResultText(
                `${CADDY_PATHS.BIN} certificate renew --domain ${domain}`
            );
            logger.success(`Renewed certificate for ${domain}`);
            return true;
        } catch (error) {
            logger.error('Failed to renew certificate:', error.message);
            return false;
        }
    }

    /**
     * Obtain new certificate for a domain
     * @param {string} domain Domain name
     * @param {Object} options Certificate options
     * @returns {Promise<boolean>} Success status
     */
    static async obtainCertificate(domain, options = {}) {
        const {
            email = null,
            staging = false,
            forceHttps = true
        } = options;

        try {
            let command = `${CADDY_PATHS.BIN} certificate obtain`;
            if (email) command += ` --email ${email}`;
            if (staging) command += ' --staging';
            if (forceHttps) command += ' --force';
            command += ` --domain ${domain}`;

            await execCmdResultText(command);
            logger.success(`Obtained certificate for ${domain}`);
            return true;
        } catch (error) {
            logger.error('Failed to obtain certificate:', error.message);
            return false;
        }
    }

    /**
     * Get certificates status for multiple domains
     * @param {string[]} domains Array of domain names
     * @returns {Promise<Object>} Certificates status
     */
    static async getBulkCertInfo(domains) {
        const results = {};
        for (const domain of domains) {
            results[domain] = await this.getCertInfo(domain);
        }
        return results;
    }

    /**
     * Load SSL certificate from files
     * @param {string} domain Domain name
     * @param {string} certPath Path to certificate file
     * @param {string} keyPath Path to private key file
     * @returns {Promise<boolean>} Success status
     */
    static async loadCustomCertificate(domain, certPath, keyPath) {
        try {
            // Verify files exist
            await fs.access(certPath);
            await fs.access(keyPath);

            const command = `${CADDY_PATHS.BIN} certificate load` +
                ` --domain ${domain}` +
                ` --cert ${certPath}` +
                ` --key ${keyPath}`;

            await execCmdResultText(command);
            logger.success(`Loaded custom certificate for ${domain}`);
            return true;
        } catch (error) {
            logger.error('Failed to load custom certificate:', error.message);
            return false;
        }
    }

    /**
     * Check if automatic HTTPS is enabled for a domain
     * @param {string} domain Domain name
     * @returns {Promise<boolean>} HTTPS status
     */
    static async isHttpsEnabled(domain) {
        try {
            const config = await fs.readFile(CADDY_PATHS.CONFIG, 'utf8');
            const domainConfig = config.match(new RegExp(`${domain}[^}]*}`, 's'));
            
            if (!domainConfig) return true; // Default is enabled
            return !domainConfig[0].includes('tls off');
        } catch (error) {
            logger.error('Failed to check HTTPS status:', error.message);
            return null;
        }
    }

    /**
     * Auto renew certificates for domains that are about to expire
     * @param {number} daysBeforeExpiry Days before expiry to trigger renewal
     * @returns {Promise<Object>} Renewal results
     */
    static async autoRenewCertificates(daysBeforeExpiry = 30) {
        try {
            // Get current active domains from Caddy config
            const activeDomains = await this.getActiveDomainsFromConfig();
            if (!activeDomains.length) {
                return {
                    success: true,
                    message: 'No active domains found',
                    renewed: [],
                    skipped: []
                };
            }

            // Get all certificates info
            const allCerts = await this.getBulkCertInfo(activeDomains);
            const now = new Date();
            const renewalThreshold = daysBeforeExpiry * 24 * 60 * 60 * 1000; // Convert days to milliseconds

            const renewalResults = {
                success: true,
                renewed: [],
                skipped: [],
                failed: []
            };

            // Check each certificate
            for (const [domain, certInfo] of Object.entries(allCerts)) {
                try {
                    // Skip if domain is not in active config
                    if (!activeDomains.includes(domain)) {
                        renewalResults.skipped.push({
                            domain,
                            reason: 'Domain not in active configuration'
                        });
                        continue;
                    }

                    // Skip if no certificate info
                    if (!certInfo || !certInfo.exists) {
                        renewalResults.skipped.push({
                            domain,
                            reason: 'No certificate found'
                        });
                        continue;
                    }

                    const expiryDate = new Date(certInfo.expiration);
                    const timeUntilExpiry = expiryDate.getTime() - now.getTime();

                    // Check if certificate needs renewal
                    if (timeUntilExpiry <= renewalThreshold) {
                        const renewed = await this.renewCertificate(domain);
                        if (renewed) {
                            renewalResults.renewed.push({
                                domain,
                                oldExpiry: certInfo.expiration,
                                newExpiry: (await this.getCertInfo(domain)).expiration
                            });
                        } else {
                            renewalResults.failed.push({
                                domain,
                                reason: 'Renewal failed'
                            });
                            renewalResults.success = false;
                        }
                    } else {
                        renewalResults.skipped.push({
                            domain,
                            reason: 'Not yet due for renewal',
                            daysUntilExpiry: Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000))
                        });
                    }
                } catch (error) {
                    renewalResults.failed.push({
                        domain,
                        reason: error.message
                    });
                    renewalResults.success = false;
                }
            }

            // Log results
            logger.info('Certificate renewal results:', {
                renewed: renewalResults.renewed.length,
                skipped: renewalResults.skipped.length,
                failed: renewalResults.failed.length
            });

            return renewalResults;
        } catch (error) {
            logger.error('Auto renewal failed:', error.message);
            return {
                success: false,
                error: error.message,
                renewed: [],
                skipped: [],
                failed: []
            };
        }
    }

    /**
     * Get active domains from Caddy configuration
     * @private
     * @returns {Promise<string[]>} List of active domains
     */
    static async getActiveDomainsFromConfig() {
        try {
            const config = await fs.readFile(CADDY_PATHS.CONFIG, 'utf8');
            const domains = config.match(/^[^#\s{]+/gm) || [];
            return domains
                .map(domain => domain.trim())
                .filter(domain => 
                    domain && 
                    !domain.startsWith('http://') && 
                    !domain.startsWith('https://')
                );
        } catch (error) {
            logger.error('Failed to get active domains:', error.message);
            return [];
        }
    }
}

module.exports = CaddyCertificate; 