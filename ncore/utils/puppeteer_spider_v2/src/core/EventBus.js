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

'use strict';

const logger = require('#@logger');

class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 100;
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        const listeners = this.events.get(event);
        if (listeners.length >= this.maxListeners) {
            logger.warn(`Event ${event} has reached maximum listeners (${this.maxListeners})`);
            return;
        }
        
        listeners.push(callback);
        logger.debug(`Listener added for event: ${event}`);
    }

    off(event, callback) {
        if (!this.events.has(event)) {
            return;
        }
        
        const listeners = this.events.get(event);
        const index = listeners.indexOf(callback);
        
        if (index > -1) {
            listeners.splice(index, 1);
            logger.debug(`Listener removed for event: ${event}`);
        }
    }

    emit(event, data) {
        if (!this.events.has(event)) {
            return;
        }
        
        const listeners = this.events.get(event);
        logger.debug(`Emitting event: ${event} to ${listeners.length} listeners`);
        
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                logger.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    async emitAsync(event, data) {
        if (!this.events.has(event)) {
            return;
        }
        
        const listeners = this.events.get(event);
        logger.debug(`Emitting async event: ${event} to ${listeners.length} listeners`);
        
        const promises = listeners.map(callback => {
            try {
                return Promise.resolve(callback(data));
            } catch (error) {
                logger.error(`Error in async event listener for ${event}:`, error);
                return Promise.resolve();
            }
        });
        
        await Promise.all(promises);
    }

    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };
        
        this.on(event, onceCallback);
    }

    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
            logger.debug(`All listeners removed for event: ${event}`);
        } else {
            this.events.clear();
            logger.debug('All listeners removed');
        }
    }

    getEventNames() {
        return Array.from(this.events.keys());
    }

    getListenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    getInfo() {
        const eventInfo = {};
        for (const [event, listeners] of this.events) {
            eventInfo[event] = listeners.length;
        }
        
        return {
            totalEvents: this.events.size,
            maxListeners: this.maxListeners,
            events: eventInfo
        };
    }
}

module.exports = EventBus;
