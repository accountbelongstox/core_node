const crypto = require('crypto');
    const random = require('random');
    const string = require('string');
    const secrets = require('secrets');
    const re = require('re');

    class StrTool {
        byteToStr(astr) {
            try {
                astr = Buffer.from(astr, 'utf-8').toString();
                return astr;
            } catch (e) {
                astr = String(astr);
                const isByte = /^b'{0,1}/;
                if (isByte.test(astr)) {
                    astr = astr.replace(/^b'{0,1}/, '').replace(/'{0,1}$/, '');
                }
                return astr;
            }
        }

        isNull(data) {
            if (typeof data === 'boolean') return data;
            if (typeof data === 'string') data = data.trim();
            if (data === null || data === "" || data === 'Null' || data === 'null' || data === 'false' || data === 0 || data === "0" || data === "0.0" || data === 0.0) {
                return true;
            } else if (this.isNumber(data)) {
                if (parseInt(data) <= 0) return true;
            } else if (Array.isArray(data) && data.length === 0) return true;
            else if (typeof data === 'object' && Object.keys(data).length === 0) return true;
            return false;
        }

        isNumber(data) {
            return !isNaN(data);
        }

        toValue(s) {
            if (typeof s === 'string') {
                const sLower = s.toLowerCase();
                if (sLower === "null" || sLower === "none") return null;
                else if (sLower === "true") return true;
                else if (sLower === "false") return false;
                else if (this.isNumber(sLower)) return parseInt(sLower);
                else if (this.isFloat(sLower)) return parseFloat(sLower);
                const dateString = this.isTimeString(sLower);
                if (dateString !== null) return this.toDateTime(sLower);
                return this.toJSON(s);
            }
            return s;
        }

        createPassword(length = 12) {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            return Array.from(crypto.randomFillSync(new Uint8Array(length))).map(n => charset[n % charset.length]).join('');
        }

        toYellow(text) {
            return `\x1b[33m${text}\x1b[0m`; // Yellow
        }

        toBlue(text) {
            return `\x1b[34m${text}\x1b[0m`; // Blue
        }

        toRed(text) {
            return `\x1b[31m${text}\x1b[0m`; // Red
        }

        toGreen(text) {
            return `\x1b[32m${text}\x1b[0m`; // Green
        }

        // Implement other methods similarly as needed...
    }

    module.exports = StrTool;