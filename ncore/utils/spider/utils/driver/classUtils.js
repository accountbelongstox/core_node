// Helper functions for getting method names from classes and objects
export function getMethodNames(prototype, print = false, className = '') {
    const methods = Object.getOwnPropertyNames(prototype)
        .filter(name => typeof prototype[name] === 'function' && name !== 'constructor');
    if (print) {
        console.log(`Total ${className} methods:`, methods.length);
    }
    return methods;
}

export function getObjectMethodNames(obj, print = false, className = '') {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
        .filter(name => typeof obj[name] === 'function' && name !== 'constructor');
    if (print) {
        console.log(`Total ${className || obj.constructor.name} methods:`, methods.length);
    }
    return methods;
}

// Export both functions as named exports and default export
export default {
    getMethodNames,
    getObjectMethodNames
};