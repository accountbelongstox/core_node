const crypto = require('crypto');
const path = require('path');

class StrTool {

    convertStyleValue(value) {
        value = value.trim().replace(';', '');
        return value
    }

    convertStyleString(styleString) {
        const propertys = styleString.split(':').map(s => s.trim(';'));
        propertys[0] = this.convertToCamelCase(propertys[0])
        propertys[1] = this.convertStyleValue(propertys[1]);
        return propertys
    }

    uuid() {
        return crypto.randomUUID(); 
    }

    dirNormal(dir) {
        let normalizedDir = path.normalize(dir);
        const invalidChars = /[<>:"\/\\|?*]/g;
        normalizedDir = normalizedDir.replace(invalidChars, '_');
        normalizedDir = normalizedDir.replace(/[\x00-\x1f\x80-\x9f]/g, '_');
        return normalizedDir.trim();
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
        value = `` + value
        const md5 = this.get_md5(value);
        let _id = `id${md5}`
        if (pre) _id = pre + _id
        return _id;
    }

    create_id(value) {
        if (!value) value = this.createString(128)
        const _id = this.get_id(value);
        return _id;
    }

    get_md5(value) {
        const hash = crypto.createHash('md5');
        hash.update(value);
        return hash.digest('hex');
    }

    createTime() {
        const currentDate = new Date();
        const dateString = currentDate.toISOString().substr(0, 19).replace('T', ' ');
        return dateString
    }

    createTimestamp() {
        const timestamp = new Date().getTime();
        return timestamp;
    }

    createPhone() {
        const operators = [
            '134', '135', '136', '137', '138', '139', '147', '150', '151', '152',
            '157', '158', '159', '178', '182', '183', '184', '187', '188'
        ];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        const mobileNumber = operator + this.createNumber(8);
        return mobileNumber;
    }

    createNumber(length = 8) {
        const digits = '0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        return result;
    }

    unpress(compressedString){
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
        } catch (error) {
            return false;
        }
    }

    toJSON(str) {
        if (!this.isJsonString(str)) {
            return str
        }
        try {
            str = JSON.parse(str)
        } catch (e) {
            console.log('toJSON Error:', e)
        }
        return str
    }

    toString(data, indent = 2) {
        if (Buffer.isBuffer(data)) {
            return data.toString('utf-8');
        }
        if (typeof data === 'string' || typeof data === 'number') {
            let str = "" + data;
            str = str.replace(/\\/g, '/');
            str = str.replace(/`/g, '"');
            str = str.replace(/\x00/g, '');
            return str;
        } else if (data === null) {
            return 'null';
        } else if (data === true) {
            return 'true';
        } else if (data === false) {
            return 'false';
        } else if (data instanceof Date) {
            return data.toISOString().replace('T', ' ').replace(/\..*$/, '');
        } else if (Array.isArray(data)) {
            const formattedArray = data.map(item => this.toString(item, indent));
            return `[${formattedArray.join(', ')}]`;
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

        if (typeof value == 'string') {
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
        if ((!str || typeof str != 'string') && default_str) {
            return default_str
        } else {
            str = this.toString(str)
            return str
        }
    }

    containsUniqueElement(a, b) {
        return a.some(element =>
            !b.some(bElement => bElement.toLowerCase() == element.toLowerCase())
        );
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
        return str.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
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
            } catch (e) {
                return Buffer.from(String(data));
            }
        } else {
            return Buffer.from(String(data));
        }
    }

    toText(data) {
        return this.toString(data)
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
        let result = str.match(/[+-]?([0-9]*[.])?[0-9]+/);
        return result ? (result[0].includes('.') ? parseFloat(result[0]) : parseInt(result[0])) : NaN;
    }
    
    isStr(value) {
        return typeof value === 'string' || value instanceof String;
    }

    extractHttpUrl(str) {
        const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
        const match = regex.exec(str);
        return match ? match[0] : ``;
    }

}

module.exports = new StrTool();
