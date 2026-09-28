import crypto from 'crypto';
import { format } from 'date-fns';
import { encode, decode } from 'html-entities';
// import { parse } from 'json5';
import Template from 'lodash/template';
import platform from 'os';

class Strtool {
    byteToStr(astr) {
        try {
            return Buffer.from(astr).toString('utf-8');
        } catch {
            let str = astr.toString();
            const bytePattern = /^b'?|\'?$/g;
            if (bytePattern.test(str)) {
                str = str.replace(bytePattern, '');
            }
            return str;
        }
    }

    isNull(data) {
        if (typeof data === 'boolean') return data;
        if (typeof data === 'string') data = data.trim();
        if ([null, '', 'Null', 'null', 'false', 0, '0', '0.0', 0.0].includes(data)) return true;
        if (this.isNumber(data) && Number(data) <= 0) return true;
        if (Array.isArray(data) || data instanceof Set) return data.length === 0;
        if (data instanceof Object) return Object.keys(data).length === 0;
        return false;
    }

    toValue(s) {
        if (typeof s === 'string') {
            const lowerStr = s.toLowerCase();
            if (['null', 'none'].includes(lowerStr)) return null;
            if (lowerStr === 'true') return true;
            if (lowerStr === 'false') return false;
            if (this.isNumber(lowerStr)) return Number(lowerStr);
            if (this.isFloat(lowerStr)) return parseFloat(lowerStr);
            const dateString = this.isTimeString(lowerStr);
            if (dateString) return this.toDateTime(lowerStr);
            return this.toJson(s);
        }
        return s;
    }

    isNotNull(obj) {
        return !this.isNull(obj);
    }

    toUnicode(a) {
        let result = Buffer.from('');
        for (const x of a) {
            result = Buffer.concat([result, Buffer.from(x === 'u' ? '\u' : x)]);
        }
        return result.toString();
    }

    createStringId(s) {
        const symbol = '-';
        const parts = s.split(symbol);
        return parts.map(part => this.randomString(part, /^[A-Z]/.test(part))).join(symbol);
    }

    createString(length = 10) {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return Array.from({ length }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    }

    jsonStr(s) {
        return JSON.stringify(s, (key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
    }

    parseTimeTokenString(timeString) {
        timeString = timeString.trim();
        const add = timeString[0];
        const sign = add === '+' || add === '-' ? add : '-';
        timeString = timeString.slice(1);

        const timeDict = { add: sign, h: 0, m: 0, s: 0 };
        const matches = timeString.match(/(-?\d+)([hms])/g) || [];

        let seconds = 0;
        matches.forEach(match => {
            const [_, amount, unit] = match.match(/(-?\d+)([hms])/);
            const num = parseInt(amount, 10);
            timeDict[unit] = num;
            seconds += unit === 's' ? num : unit === 'm' ? num * 60 : num * 3600;
        });

        timeDict.seconds = seconds;
        return timeDict;
    }

    parseExecTime(execTime) {
        const timeParts = execTime.split(':').map(Number);
        return [timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0];
    }

    stringToRegexPattern(s) {
        return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&').replace(/\*/g, '.*');
    }

    findSeparateValue(segments, key, defaultValue = null, separator = '-', keyValueSeparator = ':') {
        const parts = segments.split(keyValueSeparator);
        if (typeof parts === 'string') parts = [parts];
        for (const part of parts) {
            if (part.startsWith(`${key}${separator}`)) {
                return part.slice(key.length + 1);
            }
        }
        return defaultValue;
    }

    secondaryDivisionString(s, separator = ':', addSeparator = '->') {
        const [firstPart, secondPart] = s.split(separator);
        if (secondPart) {
            return secondPart.split(addSeparator);
        }
        return '';
    }

    scaleNumber(number, percentage) {
        if (typeof number === 'string') number = parseFloat(number);
        const scaleFactor = parseFloat(percentage.replace('%', '')) / 100;
        return number * scaleFactor;
    }

    createFernetKey() {
        return crypto.randomBytes(32).toString('base64');
    }

    encrypt(s, key) {
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.alloc(16, 0));
        let encrypted = cipher.update(s, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decrypt(s, key) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.alloc(16, 0));
        let decrypted = decipher.update(s, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    convertToString(value) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value.toString();
        }
        if (value && typeof value.__html__ === 'function') {
            return value.__html__();
        }
        return JSON.stringify(value);
    }

    reverseHtmlEscape(value) {
        if (typeof value === 'string') {
            return decode(value);
        }
        if (Array.isArray(value)) {
            return value.map(item => this.reverseHtmlEscape(item));
        }
        if (value instanceof Object) {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.reverseHtmlEscape(v)]));
        }
        return value;
    }

    toInt(data) {
        if (typeof data === 'number') return Math.floor(data);
        if ([null, '', 'null', false].includes(data)) return 0;
        if (typeof data === 'string') {
            const numStr = data.replace(/\D/g, '');
            return this.isNumber(numStr) ? parseInt(numStr, 10) : 0;
        }
        if (data === true) return 1;
        return 0;
    }

    toFloat(data) {
        if (typeof data === 'number') return data;
        if ([null, '', 'null', false].includes(data)) return 0.0;
        if (typeof data === 'string') {
            const numStr = data.replace(/[^0-9.]/g, '');
            return this.isNumber(numStr) ? parseFloat(numStr) : 0.0;
        }
        if (data === true) return 1.0;
        return 0.0;
    }

    toDate(data) {
        if (data instanceof Date) return data;
        if (typeof data === 'string') {
            const parsedDate = this.isTimeString(data);
            return parsedDate ? new Date(parsedDate) : new Date(1000000000000);
        }
        return new Date(1000000000000);
    }

    toDateTime(data) {
        if (data instanceof Date) return data;
        if (typeof data === 'string') {
            const parsedDate = this.isTimeString(data);
            return parsedDate ? new Date(parsedDate) : new Date(1000000000000);
        }
        return new Date(1000000000000);
    }

    toStr(data) {
        if (typeof data === 'string') return data;
        if ([null, 'Null', 'null', 0, 0.0, false].includes(data)) return '';
        if (Buffer.isBuffer(data)) return this.byteToStr(data);
        return this.convertToString(data);
    }

    toBytes(data) {
        if (Buffer.isBuffer(data)) return data;
        if (typeof data === 'string') return Buffer.from(data, 'utf-8');
        return Buffer.from(String(data), 'utf-8');
    }

    toBool(data) {
        return !this.isNull(data);
    }

    isRealNone(s) {
        return [null, ''].includes(s);
    }

    isRealNones(s) {
        return s.every(item => this.isRealNone(item));
    }

    isWordBetween(string1, includeStr) {
        const pattern = new RegExp(`^[a-zA-Z]{1,}(${includeStr})[a-zA-Z]{1,}$`);
        return pattern.test(string1);
    }

    isFullPath(path) {
        return path.includes('\\') || path.includes('/');
    }

    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    isFloat(value) {
        return Number(value) === value && value % 1 !== 0;
    }

    isTimeString(timeString) {
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timeString);
    }

    isJsonString(s) {
        try {
            JSON.parse(s);
            return true;
        } catch {
            return false;
        }
    }

    toJson(s) {
        try {
            return JSON.parse(s);
        } catch {
            return s;
        }
    }

    htmlToText(html) {
        return html.replace(/<\/?[^>]+(>|$)/g, '');
    }

    capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    getUUID() {
        return crypto.randomUUID();
    }

    formatDate(date, formatStr) {
        return format(date, formatStr);
    }

    getPlatform() {
        return platform.platform();
    }

    templateString(templateStr, data) {
        return Template(templateStr)(data);
    }

    isJSON(s) {
        return this.isJsonString(s);
    }
}
const strtool = new Strtool()
export default strtool;
