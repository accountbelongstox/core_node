/**
 * Event Bus - Cross-Application Communication
 *
 * Global event bus enabling communication between different apps
 * without tight coupling. Singleton pattern ensures single instance.
 *
 * Features:
 * - Subscribe/emit events
 * - Async/sync callback support
 * - Event history tracking
 * - Pre-defined event types
 *
 * Usage:
 *   const { EventBus, EventTypes } = require('#@foundation/event_bus');
 *   const bus = EventBus.instance();
 *
 *   bus.subscribe(EventTypes.DEVICE_CONNECTED, (event) => {
 *       console.log('Device:', event.data);
 *   });
 *
 *   await bus.emit(EventTypes.DEVICE_CONNECTED, 'myApp', { serial: '123' });
 */

const EventEmitter = require('events');

class Event {
    constructor(type, source, data, metadata = null) {
        this.type = type;
        this.source = source;
        this.timestamp = new Date();
        this.data = data;
        this.metadata = metadata;
    }
}

class EventBus extends EventEmitter {
    constructor() {
        if (EventBus._instance) {
            return EventBus._instance;
        }

        super();

        this._subscribers = new Map();
        this._history = [];
        this._maxHistory = 1000;

        EventBus._instance = this;
    }

    static instance() {
        if (!EventBus._instance) {
            EventBus._instance = new EventBus();
        }
        return EventBus._instance;
    }

    subscribe(eventType, callback) {
        if (!this._subscribers.has(eventType)) {
            this._subscribers.set(eventType, new Set());
        }

        this._subscribers.get(eventType).add(callback);
    }

    unsubscribe(eventType, callback) {
        if (this._subscribers.has(eventType)) {
            this._subscribers.get(eventType).delete(callback);
        }
    }

    async emit(eventType, source, data, metadata = null) {
        const event = new Event(eventType, source, data, metadata);

        this._history.push(event);
        if (this._history.length > this._maxHistory) {
            this._history.shift();
        }

        if (this._subscribers.has(eventType)) {
            const subscribers = Array.from(this._subscribers.get(eventType));

            for (const callback of subscribers) {
                if (typeof callback !== 'function') {
                    continue;
                }

                try {
                    if (callback.constructor.name === 'AsyncFunction') {
                        await callback(event);
                    } else {
                        callback(event);
                    }
                } catch (error) {
                    console.error(`EventBus error in callback for ${eventType}:`, error);
                }
            }
        }
    }

    getHistory(eventType = null, limit = 100) {
        let events = eventType
            ? this._history.filter(e => e.type === eventType)
            : [...this._history];

        return events.slice(-limit);
    }

    clearHistory() {
        this._history = [];
    }

    getSubscribersCount(eventType) {
        return this._subscribers.has(eventType)
            ? this._subscribers.get(eventType).size
            : 0;
    }
}

const EventTypes = {
    DEVICE_CONNECTED: 'device.connected',
    DEVICE_DISCONNECTED: 'device.disconnected',
    DEVICE_ERROR: 'device.error',
    VIDEO_STARTED: 'video.started',
    VIDEO_STOPPED: 'video.stopped',
    VIDEO_FRAME: 'video.frame',
    CONTROL_TOUCH: 'control.touch',
    CONTROL_KEY: 'control.key',
    CONTROL_TEXT: 'control.text',
    GROUP_CREATED: 'group.created',
    GROUP_DESTROYED: 'group.destroyed',
    GROUP_ENABLED: 'group.enabled',
    GROUP_DISABLED: 'group.disabled',
    GROUP_SLAVE_ADDED: 'group.slave_added',
    GROUP_SLAVE_REMOVED: 'group.slave_removed',
    APP_STARTED: 'app.started',
    APP_STOPPED: 'app.stopped'
};

module.exports = {
    EventBus,
    Event,
    EventTypes
};
