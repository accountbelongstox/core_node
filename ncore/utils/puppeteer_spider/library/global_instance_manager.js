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

// Global instance manager - all instances in a common object
const GLOBAL_INSTANCES = {
    instances: new Map(),
    defaultInstanceId: null,
    instanceCounter: 0,
    
    // Add instance
    addInstance(instance) {
        this.instances.set(instance.id, instance);
        if (!this.defaultInstanceId) {
            this.defaultInstanceId = instance.id;
        }
        logger.info(`Global instance added: ${instance.id}`);
    },
    
    // Remove instance
    removeInstance(id) {
        const instance = this.instances.get(id);
        if (instance) {
            this.instances.delete(id);
            if (this.defaultInstanceId === id) {
                const remainingInstances = Array.from(this.instances.keys());
                this.defaultInstanceId = remainingInstances.length > 0 ? remainingInstances[0] : null;
            }
            logger.info(`Global instance removed: ${id}`);
        }
    },
    
    // Get instance by ID
    getInstance(id = null) {
        const instanceId = id || this.defaultInstanceId;
        if (!instanceId) {
            throw new Error('No instances available. Create an instance first.');
        }
        
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error(`Instance ${instanceId} not found`);
        }
        
        return instance;
    },
    
    // Get all instances
    getAllInstances() {
        return Array.from(this.instances.values());
    },
    
    // Get instance IDs
    getInstanceIds() {
        return Array.from(this.instances.keys());
    },
    
    // Get default instance
    getDefaultInstance() {
        return this.getInstance();
    },
    
    // Generate new instance ID
    generateInstanceId() {
        this.instanceCounter++;
        return `instance_${this.instanceCounter}`;
    },
    
    // Clear all instances
    clearAll() {
        this.instances.clear();
        this.defaultInstanceId = null;
        this.instanceCounter = 0;
        logger.info('All global instances cleared');
    }
};

module.exports = GLOBAL_INSTANCES;
