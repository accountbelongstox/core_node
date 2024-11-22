function getMethodNames(prototype, print = false, className = '') {
    const methods = Object.getOwnPropertyNames(prototype)
        .filter(name => typeof prototype[name] === 'function' && name !== 'constructor');
    if (print) {
        console.log(`Total ${className} methods:`, methods.length);
    }
    return methods;
}

function getObjectMethodNames(obj, print = false, className = '') {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
        .filter(name => typeof obj[name] === 'function' && name !== 'constructor');
    if (print) {
        console.log(`Total ${className || obj.constructor.name} methods:`, methods.length);
    }
    return methods;
}

module.exports = {
    getMethodNames,
    getObjectMethodNames
};