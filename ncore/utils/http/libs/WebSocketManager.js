import logger from './logger.js';

export class WebSocketManager {
    #clients = new Map();

    /**
     * Add a new WebSocket client
     * @param {string} clientId 
     * @param {WebSocket} ws 
     */
    addClient(clientId, ws) {
        this.#clients.set(clientId, ws);
    }

    /**
     * Remove a WebSocket client
     * @param {string} clientId 
     */
    removeClient(clientId) {
        this.#clients.delete(clientId);
    }

    /**
     * Send message to a specific client
     * @param {string} clientId 
     * @param {string} type 
     * @param {*} data 
     * @param {boolean} [success=true] 
     */
    sendToClient(clientId, type, data, success = true) {
        const ws = this.#clients.get(clientId);
        if (ws) {
            try {
                ws.send(JSON.stringify({
                    type,
                    success,
                    data
                }));
            } catch (error) {
                logger.error(`Failed to send to client ${clientId}:`, error);
            }
        } else {
            logger.warning(`Client ${clientId} not found`);
        }
    }

    /**
     * Broadcast message to all clients
     * @param {string} type 
     * @param {*} data 
     * @param {boolean} [success=true] 
     */
    broadcast(type, data, success = true) {
        const message = JSON.stringify({
            type,
            success,
            data
        });

        this.#clients.forEach((ws, clientId) => {
            try {
                ws.send(message);
            } catch (error) {
                logger.error(`Failed to broadcast to client ${clientId}:`, error);
                this.removeClient(clientId);
            }
        });
    }

    /**
     * Get number of connected clients
     * @returns {number}
     */
    getClientCount() {
        return this.#clients.size;
    }

    /**
     * Check if a client is connected
     * @param {string} clientId 
     * @returns {boolean}
     */
    hasClient(clientId) {
        return this.#clients.has(clientId);
    }
} 