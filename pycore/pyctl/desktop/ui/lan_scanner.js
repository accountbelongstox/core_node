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
        // Method 1: Try WebRTC
        try {
            const ip = await this.getLocalIPViaWebRTC();
            if (ip) return ip;
        } catch (e) {
            console.warn('[LAN Scanner] WebRTC method failed:', e);
        }

        // Method 2: Try to extract from known local addresses
        // Since we're in browser, we can't directly get it, so we provide common subnets
        console.log('[LAN Scanner] Using common subnet detection');

        // Return null to trigger manual subnet selection
        return null;
    }

    async getLocalIPViaWebRTC() {
        return new Promise((resolve, reject) => {
            try {
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
                    reject(new Error('WebRTC timeout'));
                }, 2000);
            } catch (e) {
                reject(e);
            }
        });
    }

    async scanSubnet(manualSubnet = null) {
        console.log('[LAN Scanner] Starting subnet scan...');

        let subnet;

        if (manualSubnet) {
            // Use manually provided subnet
            subnet = manualSubnet;
            console.log('[LAN Scanner] Using manual subnet:', subnet);
        } else {
            const localIP = await this.getLocalIP();
            if (!localIP) {
                console.warn('[LAN Scanner] Could not determine local IP, using common subnets');

                // Scan common subnets: 192.168.0.x, 192.168.1.x, 192.168.50.x
                await this.scanCommonSubnets();
                return [];
            }

            subnet = localIP.substring(0, localIP.lastIndexOf('.'));
            console.log('[LAN Scanner] Local IP:', localIP);
        }

        const discovered = [];

        console.log(`[LAN Scanner] Scanning subnet: ${subnet}.1-255`);

        // Update UI with subnet info
        if (this.onScanProgress) {
            this.onScanProgress({ subnet: `${subnet}.1-255`, progress: 0, found: 0 });
        }

        // Scan all IPs in parallel with smaller batches for faster results
        const batchSize = 50;  // Increased from 20 for faster scanning

        for (let batch = 0; batch < 255; batch += batchSize) {
            if (!this.scanning) break;

            const promises = [];

            for (let i = batch; i < Math.min(batch + batchSize, 255); i++) {
                const ip = `${subnet}.${i + 1}`;
                promises.push(this.pingHost(ip));
            }

            const results = await Promise.all(promises);

            for (const result of results) {
                if (result) {
                    discovered.push(result);
                    console.log('[LAN Scanner] Found server:', result.url);

                    // Immediately notify on discovery
                    if (this.onDiscoveryCallback) {
                        this.onDiscoveryCallback([...discovered]);
                    }
                }
            }

            // Update progress
            const progress = Math.min(100, Math.floor(((batch + batchSize) / 255) * 100));
            if (this.onScanProgress) {
                this.onScanProgress({ subnet: `${subnet}.1-255`, progress, found: discovered.length });
            }

            // No delay between batches - scan as fast as possible
        }

        console.log('[LAN Scanner] Scan complete. Found', discovered.length, 'servers');

        if (this.onScanProgress) {
            this.onScanProgress({ subnet: `${subnet}.1-255`, progress: 100, found: discovered.length });
        }

        return discovered;
    }

    async scanCommonSubnets() {
        console.log('[LAN Scanner] Scanning common subnets...');

        const commonSubnets = ['192.168.0', '192.168.1', '192.168.50', '10.0.0'];

        for (const subnet of commonSubnets) {
            if (!this.scanning) break;

            console.log(`[LAN Scanner] Trying subnet: ${subnet}.x`);

            if (this.onScanProgress) {
                this.onScanProgress({ subnet: `${subnet}.1-255`, progress: 0, found: 0 });
            }

            const discovered = await this.quickScanSubnet(subnet);

            if (discovered.length > 0) {
                console.log(`[LAN Scanner] Found ${discovered.length} server(s) in ${subnet}.x`);
                if (this.onDiscoveryCallback) {
                    this.onDiscoveryCallback(discovered);
                }
                return; // Stop after finding servers in one subnet
            }
        }

        console.log('[LAN Scanner] No servers found in common subnets');
        if (this.onScanProgress) {
            this.onScanProgress({ subnet: 'No servers found', progress: 100, found: 0 });
        }
    }

    async quickScanSubnet(subnet) {
        const discovered = [];
        const promises = [];

        // Only scan first 50 IPs for quick check
        for (let i = 1; i <= 50; i++) {
            const ip = `${subnet}.${i}`;
            promises.push(this.pingHost(ip));
        }

        const results = await Promise.all(promises);

        for (const result of results) {
            if (result) {
                discovered.push(result);
            }
        }

        return discovered;
    }

    async pingHost(ip) {
        const port = this.config.REMOTE_API.SCAN_PORT;
        const timeout = this.config.REMOTE_API.SCAN_TIMEOUT;

        // 简单检测：只要端口9000有HTTP服务就行
        const url = `http://${ip}:${port}/`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                signal: controller.signal,
                method: 'GET'
            });

            clearTimeout(timeoutId);

            // 只要能连接上（任何HTTP响应），就认为找到了服务器
            // 不管返回200, 404, 还是其他，只要不是网络错误就行
            return {
                success: true,
                ip,
                port,
                url: `http://${ip}:${port}`
            };
        } catch (e) {
            // 网络错误（连接超时、拒绝连接等）才认为没有服务
            return null;
        }
    }

    async startScanning(onDiscovery) {
        if (this.scanning) {
            console.warn('[LAN Scanner] Already scanning');
            return;
        }

        this.scanning = true;
        this.onDiscoveryCallback = onDiscovery;
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

    setScanProgressCallback(callback) {
        this.onScanProgress = callback;
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
