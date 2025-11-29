// LAN Scanner for Voice Subtitle Service Discovery
// Scans local network for voice-subtitle servers on port 9000

class LANScanner {
    constructor(config) {
        this.config = config;
        this.scanning = false;
        this.scanInterval = null;
        this.discoveredServers = [];
    }

    async getLocalIP() {
        // Use WebRTC to get local IP
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({iceServers: []});
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));

            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) return;

                const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
                const match = ipRegex.exec(ice.candidate.candidate);

                if (match) {
                    pc.close();
                    resolve(match[0]);
                }
            };

            // Timeout after 2 seconds
            setTimeout(() => {
                pc.close();
                resolve(null);
            }, 2000);
        });
    }

    async pingHost(ip) {
        const port = this.config.REMOTE_API.SCAN_PORT;
        const timeout = this.config.REMOTE_API.SCAN_TIMEOUT;
        const apiPrefix = this.config.REMOTE_API.API_PREFIX;

        const url = `http://${ip}:${port}${apiPrefix}/ping`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                signal: controller.signal,
                method: 'GET'
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.service === 'voice-subtitle' || data.success) {
                    return {
                        success: true,
                        ip,
                        port,
                        url: `http://${ip}:${port}`,
                        data
                    };
                }
            }
        } catch (e) {
            // Host not reachable or timeout
        }

        return null;
    }

    async scanSubnet() {
        console.log('[LAN Scanner] Starting subnet scan...');

        const localIP = await this.getLocalIP();
        if (!localIP) {
            console.warn('[LAN Scanner] Could not determine local IP');
            return [];
        }

        console.log('[LAN Scanner] Local IP:', localIP);

        const subnet = localIP.substring(0, localIP.lastIndexOf('.'));
        const discovered = [];

        // Scan common IPs in batches to avoid overwhelming the browser
        const batchSize = 20;

        for (let batch = 0; batch < 255; batch += batchSize) {
            if (!this.scanning) break;

            const promises = [];

            for (let i = batch; i < Math.min(batch + batchSize, 255); i++) {
                const ip = `${subnet}.${i + 1}`;

                // Skip local IP
                if (ip === localIP) continue;

                promises.push(this.pingHost(ip));
            }

            const results = await Promise.all(promises);

            for (const result of results) {
                if (result) {
                    discovered.push(result);
                    console.log('[LAN Scanner] Found server:', result.url);
                }
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('[LAN Scanner] Scan complete. Found', discovered.length, 'servers');
        return discovered;
    }

    async startScanning(onDiscovery) {
        if (this.scanning) {
            console.warn('[LAN Scanner] Already scanning');
            return;
        }

        this.scanning = true;
        console.log('[LAN Scanner] Starting periodic scan...');

        // Initial scan
        this.discoveredServers = await this.scanSubnet();
        if (onDiscovery) {
            onDiscovery(this.discoveredServers);
        }

        // Periodic scan
        const scanInterval = this.config.REMOTE_API.SCAN_INTERVAL;
        this.scanInterval = setInterval(async () => {
            if (!this.scanning) return;

            this.discoveredServers = await this.scanSubnet();
            if (onDiscovery) {
                onDiscovery(this.discoveredServers);
            }
        }, scanInterval);
    }

    stopScanning() {
        console.log('[LAN Scanner] Stopping scan...');
        this.scanning = false;

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
    }

    getDiscoveredServers() {
        return this.discoveredServers;
    }
}
