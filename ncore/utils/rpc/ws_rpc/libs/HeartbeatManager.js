const logger = require('#@logger');
const { WS_RPC_CONSTANTS } = require('#@global_vars');

const MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES;
const DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS;

class HeartbeatManager {
    constructor(options = {}) {
        this.interval = options.interval || DEFAULTS.HEARTBEAT_INTERVAL;
        this.timeout = options.timeout || DEFAULTS.HEARTBEAT_TIMEOUT;
        this.onTimeout = options.onTimeout || (() => {});
        this.onPong = options.onPong || (() => {});
        this.debug = options.debug || false;

        this.timers = new Map();
        this.lastPongTime = new Map();
        this.missedPongs = new Map();
        this.maxMissedPongs = 3;
    }

    start(clientId, sendFunction) {
        if (this.timers.has(clientId)) {
            logger.debug(`Heartbeat already running for ${clientId}`);
            return;
        }

        this.lastPongTime.set(clientId, Date.now());
        this.missedPongs.set(clientId, 0);

        const intervalTimer = setInterval(() => {
            this._sendPing(clientId, sendFunction);
        }, this.interval);

        this.timers.set(clientId, {
            interval: intervalTimer,
            timeout: null
        });

        logger.debug(`Heartbeat started for ${clientId}`);
    }

    stop(clientId) {
        const timers = this.timers.get(clientId);
        if (timers) {
            clearInterval(timers.interval);
            if (timers.timeout) {
                clearTimeout(timers.timeout);
            }
            this.timers.delete(clientId);
            this.lastPongTime.delete(clientId);
            this.missedPongs.delete(clientId);
            logger.debug(`Heartbeat stopped for ${clientId}`);
        }
    }

    receivedPong(clientId, data = {}) {
        const timers = this.timers.get(clientId);
        if (!timers) {
            return;
        }

        if (timers.timeout) {
            clearTimeout(timers.timeout);
            timers.timeout = null;
        }

        const now = Date.now();
        const lastPong = this.lastPongTime.get(clientId) || now;
        const latency = now - (data.timestamp || lastPong);

        this.lastPongTime.set(clientId, now);
        this.missedPongs.set(clientId, 0);

        logger.debug(`Pong received from ${clientId}, latency: ${latency}ms`);
        this.onPong(clientId, latency);
    }

    getLatency(clientId) {
        const lastPong = this.lastPongTime.get(clientId);
        if (!lastPong) {
            return null;
        }
        return Date.now() - lastPong;
    }

    getStats(clientId) {
        return {
            lastPongTime: this.lastPongTime.get(clientId),
            missedPongs: this.missedPongs.get(clientId) || 0,
            latency: this.getLatency(clientId)
        };
    }

    stopAll() {
        this.timers.forEach((timers, clientId) => {
            this.stop(clientId);
        });
    }

    _sendPing(clientId, sendFunction) {
        const timers = this.timers.get(clientId);
        if (!timers) {
            return;
        }

        const message = {
            type: MSG_TYPES.PING,
            timestamp: Date.now()
        };

        try {
            sendFunction(message);
            logger.debug(`Ping sent to ${clientId}`);

            timers.timeout = setTimeout(() => {
                this._handleTimeout(clientId);
            }, this.timeout);

        } catch (error) {
            logger.error(`Failed to send ping to ${clientId}:`, error);
        }
    }

    _handleTimeout(clientId) {
        const missed = (this.missedPongs.get(clientId) || 0) + 1;
        this.missedPongs.set(clientId, missed);

        logger.warn(`Heartbeat timeout for ${clientId}, missed pongs: ${missed}`);

        if (missed >= this.maxMissedPongs) {
            logger.error(`Client ${clientId} exceeded max missed pongs, disconnecting`);
            this.stop(clientId);
            this.onTimeout(clientId);
        }
    }
}

module.exports = HeartbeatManager;
