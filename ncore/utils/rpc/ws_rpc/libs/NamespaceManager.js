// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');

class NamespaceManager {
    constructor() {
        this.namespaces = new Map();
        this.clientNamespaces = new Map();
        this.rooms = new Map();
        this.clientRooms = new Map();
    }

    createNamespace(name) {
        if (!this.namespaces.has(name)) {
            this.namespaces.set(name, new Set());
            logger.debug(`Namespace created: ${name}`);
        }
        return this;
    }

    joinNamespace(clientId, namespace) {
        if (!this.namespaces.has(namespace)) {
            this.createNamespace(namespace);
        }

        this.namespaces.get(namespace).add(clientId);

        if (!this.clientNamespaces.has(clientId)) {
            this.clientNamespaces.set(clientId, new Set());
        }
        this.clientNamespaces.get(clientId).add(namespace);

        logger.debug(`Client ${clientId} joined namespace ${namespace}`);
        return true;
    }

    leaveNamespace(clientId, namespace) {
        const ns = this.namespaces.get(namespace);
        if (ns) {
            ns.delete(clientId);
            if (ns.size === 0) {
                this.namespaces.delete(namespace);
            }
        }

        const clientNs = this.clientNamespaces.get(clientId);
        if (clientNs) {
            clientNs.delete(namespace);
            if (clientNs.size === 0) {
                this.clientNamespaces.delete(clientId);
            }
        }

        logger.debug(`Client ${clientId} left namespace ${namespace}`);
        return true;
    }

    getNamespaceClients(namespace) {
        const ns = this.namespaces.get(namespace);
        return ns ? Array.from(ns) : [];
    }

    getClientNamespaces(clientId) {
        const clientNs = this.clientNamespaces.get(clientId);
        return clientNs ? Array.from(clientNs) : [];
    }

    joinRoom(clientId, room, namespace = 'default') {
        const roomKey = `${namespace}:${room}`;

        if (!this.rooms.has(roomKey)) {
            this.rooms.set(roomKey, new Set());
        }

        this.rooms.get(roomKey).add(clientId);

        if (!this.clientRooms.has(clientId)) {
            this.clientRooms.set(clientId, new Set());
        }
        this.clientRooms.get(clientId).add(roomKey);

        logger.debug(`Client ${clientId} joined room ${room} in namespace ${namespace}`);
        return true;
    }

    leaveRoom(clientId, room, namespace = 'default') {
        const roomKey = `${namespace}:${room}`;
        const roomSet = this.rooms.get(roomKey);

        if (roomSet) {
            roomSet.delete(clientId);
            if (roomSet.size === 0) {
                this.rooms.delete(roomKey);
            }
        }

        const clientRoomSet = this.clientRooms.get(clientId);
        if (clientRoomSet) {
            clientRoomSet.delete(roomKey);
            if (clientRoomSet.size === 0) {
                this.clientRooms.delete(clientId);
            }
        }

        logger.debug(`Client ${clientId} left room ${room} in namespace ${namespace}`);
        return true;
    }

    getRoomClients(room, namespace = 'default') {
        const roomKey = `${namespace}:${room}`;
        const roomSet = this.rooms.get(roomKey);
        return roomSet ? Array.from(roomSet) : [];
    }

    getClientRooms(clientId) {
        const clientRoomSet = this.clientRooms.get(clientId);
        return clientRoomSet ? Array.from(clientRoomSet) : [];
    }

    removeClient(clientId) {
        const clientNs = this.clientNamespaces.get(clientId);
        if (clientNs) {
            for (const namespace of clientNs) {
                this.leaveNamespace(clientId, namespace);
            }
        }

        const clientRoomSet = this.clientRooms.get(clientId);
        if (clientRoomSet) {
            for (const roomKey of clientRoomSet) {
                const [namespace, room] = roomKey.split(':');
                this.leaveRoom(clientId, room, namespace);
            }
        }

        logger.debug(`Client ${clientId} removed from all namespaces and rooms`);
    }

    getStats() {
        return {
            namespaces: this.namespaces.size,
            rooms: this.rooms.size,
            clients: this.clientNamespaces.size
        };
    }

    getAllNamespaces() {
        return Array.from(this.namespaces.keys());
    }

    getAllRooms(namespace = null) {
        const rooms = Array.from(this.rooms.keys());
        if (namespace) {
            return rooms
                .filter(key => key.startsWith(`${namespace}:`))
                .map(key => key.split(':')[1]);
        }
        return rooms;
    }

    clear() {
        this.namespaces.clear();
        this.clientNamespaces.clear();
        this.rooms.clear();
        this.clientRooms.clear();
        logger.debug('Namespace manager cleared');
    }
}

module.exports = NamespaceManager;
