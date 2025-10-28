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

function getMethodNames(obj) {
    if (typeof obj === 'function') {
        return Object.getOwnPropertyNames(obj.prototype)
            .filter(name => typeof obj.prototype[name] === 'function' && name !== 'constructor');
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.getOwnPropertyNames(obj)
            .filter(name => typeof obj[name] === 'function' && name !== 'constructor');
    }
    return [];
}

function getAllMethodNames(obj) {
    const methods = new Set();
    
    let current = obj;
    while (current && current !== Object.prototype) {
        const names = Object.getOwnPropertyNames(current)
            .filter(name => typeof current[name] === 'function' && name !== 'constructor');
        names.forEach(name => methods.add(name));
        current = Object.getPrototypeOf(current);
    }
    
    return Array.from(methods);
}

function hasMethod(obj, methodName) {
    return typeof obj[methodName] === 'function';
}

function callMethod(obj, methodName, ...args) {
    if (hasMethod(obj, methodName)) {
        return obj[methodName](...args);
    }
    throw new Error(`Method ${methodName} not found on object`);
}

function bindMethod(obj, methodName) {
    if (hasMethod(obj, methodName)) {
        return obj[methodName].bind(obj);
    }
    throw new Error(`Method ${methodName} not found on object`);
}

module.exports = {
    getMethodNames,
    getAllMethodNames,
    hasMethod,
    callMethod,
    bindMethod
};
