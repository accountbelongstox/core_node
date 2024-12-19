const crypto = require('crypto');
    const pako = require('pako');

    class StrTool {
        convertStyleValue(value) {
            return value.trim().replace(';', '');
        }

        convertStyleString(styleString) {
            const properties = styleString.split(':').map(s => s.trim(';'));
            properties[0] = this.convertToCamelCase(properties[0]);
            properties[1] = this.convertStyleValue(properties[1]);
            return properties;
        }

        convertToCamelCase(string) {
            const components = string.split("-");
            return components[0] + components.slice(1).map(component => component.charAt(0).toUpperCase() + component.slice(1)).join("");
        }

        convertString(str) {
            if (str === "true") {
                return true;
            } else if (str === "false") {
                return false;
            } else if (!isNaN(str)) {
                return Number(str);
            } else {
                return str;
            }
        }

        createString(length = 10) {
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += letters.charAt(Math.floor(Math.random() * letters.length));
            }
            return result;
        }

        get_id(value, pre) {
            value = `${value}`;
            const md5 = this.get_md5(value);
            let _id = `id${md5}`;
            if (pre) _id = pre + _id;
            return _id;
        }

        create_id(value) {
            if (!value) value = this.createString(128);
            return this.get_id(value);
        }

        get_md5(value) {
            return crypto.createHash('md5').update(value).digest('hex');
        }

        createTime() {
            return new Date().toISOString().substr(0, 19).replace('T', ' ');
        }

        createTimestamp() {
            return Date.now();
        }

        createPhone() {
            const operators = [
                '134', '135', '136', '137', '138', '139', '147', '150', '151', '152',
                '157', '158', '159', '178', '182', '183', '184', '187', '188'
            ];
            const operator = operators[Math.floor(Math.random() * operators.length)];
            return operator + this.createNumber(8);
        }

        createNumber(length = 8) {
            const digits = '0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += digits.charAt(Math.floor(Math.random() * digits.length));
            }
            return result;
        }

        unpress(compressedString) {
            return pako.inflate(atob(compressedString), { to: 'string' });
        }

        isJsonString(jsonStr) {
            if (typeof jsonStr !== 'string') {
                return false;
            }
            jsonStr = jsonStr.trim();
            if (jsonStr.length === 0) {
                return false;
            }
            const firstChar = jsonStr[0];
            if (!['{', '"'].includes(firstChar)) {
                return false;
            }
            try {
                JSON.parse(jsonStr);
                return true;
            } catch {
                return false;
            }
        }

        toJSON(str) {
            if (!this.isJsonString(str)) {
                return str;
            }
            try {
                return JSON.parse(str);
            } catch (e) {
                console.log('toJSON Error:', e);
                return {};
            }
        }

        toString(data, indent = 2) {
            if (Buffer.isBuffer(data)) {
                return data.toString('utf-8');
            }
            if (typeof data === 'string' || typeof data === 'number') {
                return data.toString().replace(/\\/g, '/').replace(/`/g, '"').replace(/\x00/g, '');
            } else if (data === null) {
                return 'null';
            } else if (data === true) {
                return 'true';
            } else if (data === false) {
                return 'false';
            } else if (data instanceof Date) {
                return data.toISOString().replace('T', ' ').replace(/\..*$/, '');
            } else if (Array.isArray(data)) {
                return `[${data.map(item => this.toString(item, indent)).join(', ')}]`;
            } else if (typeof data === 'object') {
                try {
                    return JSON.stringify(data, null, indent);
                } catch (error) {
                    return data.toString ? data.toString() : String(data);
                }
            } else {
                return String(data);
            }
        }

        to_boolean(value) {
            if (!value) return false;
            if (typeof value === 'string') {
                value = value.trim().toLowerCase();
                if (['', 'false', 'null', '0'].includes(value)) return false;
            } else if (Array.isArray(value) && value.length === 0) {
                return false;
            } else if (typeof value === 'object' && Object.keys(value).length === 0) {
                return false;
            }
            return true;
        }

        getDefault(str, default_str) {
            if ((!str || typeof str !== 'string') && default_str) {
                return default_str;
            } else {
                return this.toString(str);
            }
        }

        containsUniqueElement(a, b) {
            return a.some(element => !b.some(bElement => bElement.toLowerCase() === element.toLowerCase()));
        }

        to_windowspath(path) {
            return path.replace(/\//g, '\\');
        }

        to_linuxpath(path) {
            return path.replace(/\\/g, '/');
        }

        trimLeft(str) {
            return str.replace(/^[^a-zA-Z0-9]+/, '');
        }

        trim(str) {
            return str.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        }

        findFirstNumberInString(str) {
            const parts = str.split(/\s+/);
            for (const part of parts) {
                const match = part.match(/\d/);
                if (match) {
                    return part;
                }
            }
            return '0';
        }

        toBinary(data) {
            if (Buffer.isBuffer(data)) {
                return data;
            } else if (typeof data === 'object') {
                try {
                    return Buffer.from(JSON.stringify(data));
                } catch {
                    return Buffer.from(String(data));
                }
            } else {
                return Buffer.from(String(data));
            }
        }

        toText(data) {
            return this.toString(data);
        }

        toNumber(data) {
            if (Buffer.isBuffer(data)) {
                return this.extractNumber(data.toString('utf8'));
            } else if (typeof data === 'object') {
                return 1;
            } else if (typeof data === 'boolean') {
                return data ? 1 : 0;
            } else if (typeof data === 'string') {
                return this.extractNumber(data);
            } else if (data instanceof Date) {
                return data.getTime();
            } else {
                return Number(data);
            }
        }

        extractNumber(str) {
            const result = str.match(/[+-]?([0-9]*[.])?[0-9]+/);
            return result ? (result[0].includes('.') ? parseFloat(result[0]) : parseInt(result[0])) : NaN;
        }

        isStr(value) {
            return typeof value === 'string' || value instanceof String;
        }

        extractHttpUrl(str) {
            const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
            const match = regex.exec(str);
            return match ? match[0] : '';
        }

        truncate(result, maxLength = 100, truncateLength = 50) {
            let resultStr = this.toString(result);
            if (resultStr.length > maxLength) {
                const startStr = resultStr.substring(0, truncateLength);
                const endStr = resultStr.substring(resultStr.length - truncateLength);
                resultStr = `${startStr}...${endStr}`;
            }
            return resultStr;
        }
    }

    module.exports = new StrTool();