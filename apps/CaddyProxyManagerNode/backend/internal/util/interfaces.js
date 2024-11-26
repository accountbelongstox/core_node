export class Validator {
    static isString(value) {
        return typeof value === 'string';
    }

    static isNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    static isBoolean(value) {
        return typeof value === 'boolean';
    }

    static isObject(value) {
        return typeof value === 'object' && value !== null;
    }

    static isArray(value) {
        return Array.isArray(value);
    }

    static isFunction(value) {
        return typeof value === 'function';
    }

    static isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }
}

export class TypeConverter {
    static toString(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    }

    static toNumber(value) {
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    }

    static toBoolean(value) {
        if (typeof value === 'string') {
            return ['true', '1', 'yes'].includes(value.toLowerCase());
        }
        return Boolean(value);
    }

    static toArray(value) {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') return value.split(',').map(v => v.trim());
        return [];
    }
} 