// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');

class ConverterTools {
    constructor() {
        this.tools = [
            {
                id: 'base64_string_converter',
                name: 'Base64 String Converter',
                description: 'Encode and decode strings to/from Base64',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/base64/string',
                method: 'POST',
                keywords: ['base64', 'encode', 'decode', 'string', 'conversion']
            },
            {
                id: 'base64_file_converter',
                name: 'Base64 File Converter',
                description: 'Encode and decode files to/from Base64',
                category: 'converter',
                icon: 'file',
                endpoint: '/converter/base64/file',
                method: 'POST',
                keywords: ['base64', 'file', 'encode', 'decode', 'upload']
            },
            {
                id: 'url_encoder',
                name: 'URL Encoder/Decoder',
                description: 'Encode and decode URLs for safe transmission',
                category: 'converter',
                icon: 'link',
                endpoint: '/converter/url',
                method: 'POST',
                keywords: ['url', 'encode', 'decode', 'percent-encoding']
            },
            {
                id: 'color_converter',
                name: 'Color Converter',
                description: 'Convert between different color formats (HEX, RGB, HSL, etc.)',
                category: 'converter',
                icon: 'palette',
                endpoint: '/converter/color',
                method: 'POST',
                keywords: ['color', 'convert', 'hex', 'rgb', 'hsl', 'hsv', 'cmyk']
            },
            {
                id: 'case_converter',
                name: 'Case Converter',
                description: 'Convert text between different cases (camelCase, snake_case, etc.)',
                category: 'converter',
                icon: 'text-height',
                endpoint: '/converter/case',
                method: 'POST',
                keywords: ['case', 'convert', 'camelcase', 'snakecase', 'kebabcase', 'pascalcase']
            },
            {
                id: 'date_time_converter',
                name: 'Date Time Converter',
                description: 'Convert between different date and time formats',
                category: 'converter',
                icon: 'calendar',
                endpoint: '/converter/datetime',
                method: 'POST',
                keywords: ['date', 'time', 'convert', 'format', 'timestamp', 'timezone']
            },
            {
                id: 'roman_numeral_converter',
                name: 'Roman Numeral Converter',
                description: 'Convert between Arabic numbers and Roman numerals',
                category: 'converter',
                icon: 'sort-numeric-up',
                endpoint: '/converter/roman',
                method: 'POST',
                keywords: ['roman', 'numeral', 'convert', 'number', 'history']
            },
            {
                id: 'integer_base_converter',
                name: 'Integer Base Converter',
                description: 'Convert integers between different number bases',
                category: 'converter',
                icon: 'calculator',
                endpoint: '/converter/base',
                method: 'POST',
                keywords: ['base', 'convert', 'binary', 'decimal', 'hexadecimal', 'octal']
            },
            {
                id: 'text_to_nato_alphabet',
                name: 'Text to NATO Alphabet',
                description: 'Convert text to NATO phonetic alphabet',
                category: 'converter',
                icon: 'microphone',
                endpoint: '/converter/nato',
                method: 'POST',
                keywords: ['nato', 'phonetic', 'alphabet', 'spelling', 'aviation']
            },
            {
                id: 'text_to_binary',
                name: 'Text to Binary',
                description: 'Convert text to binary representation',
                category: 'converter',
                icon: 'memory',
                endpoint: '/converter/binary',
                method: 'POST',
                keywords: ['binary', 'convert', 'text', 'bits', 'ascii']
            },
            {
                id: 'text_to_unicode',
                name: 'Text to Unicode',
                description: 'Convert text to Unicode escape sequences',
                category: 'converter',
                icon: 'globe',
                endpoint: '/converter/unicode',
                method: 'POST',
                keywords: ['unicode', 'convert', 'text', 'escape', 'encoding']
            },
            {
                id: 'yaml_to_json_converter',
                name: 'YAML to JSON Converter',
                description: 'Convert YAML to JSON format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/yaml-to-json',
                method: 'POST',
                keywords: ['yaml', 'json', 'convert', 'format', 'data']
            },
            {
                id: 'json_to_yaml_converter',
                name: 'JSON to YAML Converter',
                description: 'Convert JSON to YAML format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/json-to-yaml',
                method: 'POST',
                keywords: ['json', 'yaml', 'convert', 'format', 'data']
            },
            {
                id: 'yaml_to_toml_converter',
                name: 'YAML to TOML Converter',
                description: 'Convert YAML to TOML format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/yaml-to-toml',
                method: 'POST',
                keywords: ['yaml', 'toml', 'convert', 'format', 'config']
            },
            {
                id: 'json_to_toml_converter',
                name: 'JSON to TOML Converter',
                description: 'Convert JSON to TOML format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/json-to-toml',
                method: 'POST',
                keywords: ['json', 'toml', 'convert', 'format', 'config']
            },
            {
                id: 'toml_to_yaml_converter',
                name: 'TOML to YAML Converter',
                description: 'Convert TOML to YAML format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/toml-to-yaml',
                method: 'POST',
                keywords: ['toml', 'yaml', 'convert', 'format', 'config']
            },
            {
                id: 'toml_to_json_converter',
                name: 'TOML to JSON Converter',
                description: 'Convert TOML to JSON format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/toml-to-json',
                method: 'POST',
                keywords: ['toml', 'json', 'convert', 'format', 'config']
            },
            {
                id: 'xml_to_json_converter',
                name: 'XML to JSON Converter',
                description: 'Convert XML to JSON format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/xml-to-json',
                method: 'POST',
                keywords: ['xml', 'json', 'convert', 'format', 'data']
            },
            {
                id: 'json_to_xml_converter',
                name: 'JSON to XML Converter',
                description: 'Convert JSON to XML format',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/json-to-xml',
                method: 'POST',
                keywords: ['json', 'xml', 'convert', 'format', 'data']
            },
            {
                id: 'markdown_to_html_converter',
                name: 'Markdown to HTML Converter',
                description: 'Convert Markdown to HTML',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/markdown-to-html',
                method: 'POST',
                keywords: ['markdown', 'html', 'convert', 'format', 'documentation']
            },
            {
                id: 'list_converter',
                name: 'List Converter',
                description: 'Convert between different list formats',
                category: 'converter',
                icon: 'list',
                endpoint: '/converter/list',
                method: 'POST',
                keywords: ['list', 'convert', 'format', 'array', 'delimiter']
            },
            {
                id: 'temperature_converter',
                name: 'Temperature Converter',
                description: 'Convert between Celsius, Fahrenheit, Kelvin',
                category: 'converter',
                icon: 'temperature-high',
                endpoint: '/converter/temperature',
                method: 'POST',
                keywords: ['temperature', 'convert', 'celsius', 'fahrenheit', 'kelvin']
            },
            {
                id: 'slugify_string',
                name: 'Slugify String',
                description: 'Convert text to URL-friendly slugs',
                category: 'converter',
                icon: 'link',
                endpoint: '/converter/slugify',
                method: 'POST',
                keywords: ['slugify', 'url', 'slug', 'friendly', 'convert']
            },
            {
                id: 'json_to_csv_converter',
                name: 'JSON to CSV Converter',
                description: 'Convert JSON data to CSV format',
                category: 'converter',
                icon: 'file-csv',
                endpoint: '/converter/json-to-csv',
                method: 'POST',
                keywords: ['json', 'csv', 'convert', 'export', 'data']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'base64_string_converter':
                return this.base64StringConverter(params.text, params.operation);
            case 'base64_file_converter':
                return this.base64FileConverter(params.file, params.operation);
            case 'url_encoder':
                return this.urlConverter(params.text, params.operation);
            case 'color_converter':
                return this.colorConverter(params.color, params.input_format);
            case 'case_converter':
                return this.caseConverter(params.text);
            case 'date_time_converter':
                return this.dateTimeConverter(params.datetime, params.input_format, params.output_format, params.timezone);
            case 'roman_numeral_converter':
                return this.romanNumeralConverter(params.number);
            case 'integer_base_converter':
                return this.integerBaseConverter(params.number, params.from_base, params.to_base);
            case 'text_to_nato_alphabet':
                return this.textToNatoAlphabet(params.text);
            case 'text_to_binary':
                return this.textToBinary(params.text, params.separator);
            case 'text_to_unicode':
                return this.textToUnicode(params.text);
            case 'yaml_to_json_converter':
                return this.yamlToJson(params.yaml);
            case 'json_to_yaml_converter':
                return this.jsonToYaml(params.json);
            case 'yaml_to_toml_converter':
                return this.yamlToToml(params.yaml);
            case 'json_to_toml_converter':
                return this.jsonToToml(params.json);
            case 'toml_to_yaml_converter':
                return this.tomlToYaml(params.toml);
            case 'toml_to_json_converter':
                return this.tomlToJson(params.toml);
            case 'xml_to_json_converter':
                return this.xmlToJson(params.xml);
            case 'json_to_xml_converter':
                return this.jsonToXml(params.json, params.root_element);
            case 'markdown_to_html_converter':
                return this.markdownToHtml(params.markdown);
            case 'list_converter':
                return this.listConverter(params.list, params.input_format, params.output_format);
            case 'temperature_converter':
                return this.temperatureConverter(params.temperature, params.from_unit, params.to_unit);
            case 'slugify_string':
                return this.slugifyString(params.text, params.separator);
            case 'json_to_csv_converter':
                return this.jsonToCsv(params.json, params.delimiter);
            default:
                throw new Error(`Unknown converter tool: ${toolId}`);
        }
    }

    base64StringConverter(text, operation = 'encode') {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            if (operation === 'encode') {
                const buffer = Buffer.from(text, 'utf-8');
                const encoded = buffer.toString('base64');
                return {
                    result: encoded,
                    operation: 'encode',
                    originalLength: text.length,
                    resultLength: encoded.length
                };
            } else if (operation === 'decode') {
                const buffer = Buffer.from(text, 'base64');
                const decoded = buffer.toString('utf-8');
                return {
                    result: decoded,
                    operation: 'decode',
                    originalLength: text.length,
                    resultLength: decoded.length
                };
            } else {
                throw new Error('Operation must be either "encode" or "decode"');
            }
        } catch (error) {
            logger.error(`Base64 conversion error: ${error.message}`);
            throw new Error(`Failed to convert Base64: ${error.message}`);
        }
    }

    base64FileConverter(file, operation = 'encode') {
        try {
            return {
                success: false,
                error: 'File conversion requires file upload mechanism',
                message: 'This feature requires multipart/form-data handling'
            };
        } catch (error) {
            logger.error(`Base64 file conversion error: ${error.message}`);
            throw new Error(`Failed to convert file: ${error.message}`);
        }
    }

    urlConverter(text, operation = 'encode') {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            if (operation === 'encode') {
                const encoded = encodeURIComponent(text);
                return {
                    result: encoded,
                    operation: 'encode',
                    originalLength: text.length,
                    resultLength: encoded.length
                };
            } else if (operation === 'decode') {
                const decoded = decodeURIComponent(text);
                return {
                    result: decoded,
                    operation: 'decode',
                    originalLength: text.length,
                    resultLength: decoded.length
                };
            } else {
                throw new Error('Operation must be either "encode" or "decode"');
            }
        } catch (error) {
            logger.error(`URL conversion error: ${error.message}`);
            throw new Error(`Failed to convert URL: ${error.message}`);
        }
    }

    colorConverter(color, inputFormat = 'hex') {
        if (!color) {
            throw new Error('Color is required');
        }

        try {
            let r, g, b;

            if (inputFormat === 'hex') {
                const hex = color.replace('#', '');
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            } else if (inputFormat === 'rgb') {
                const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (match) {
                    r = parseInt(match[1]);
                    g = parseInt(match[2]);
                    b = parseInt(match[3]);
                }
            }

            const hsl = this.rgbToHsl(r, g, b);
            const hsv = this.rgbToHsv(r, g, b);

            return {
                hex: `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`,
                rgb: `rgb(${r}, ${g}, ${b})`,
                hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
                hsv: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`,
                values: { r, g, b, hsl, hsv }
            };
        } catch (error) {
            logger.error(`Color conversion error: ${error.message}`);
            throw new Error(`Failed to convert color: ${error.message}`);
        }
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h, s = max === 0 ? 0 : d / max;
        const v = max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }

    caseConverter(text) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            return {
                lowercase: text.toLowerCase(),
                uppercase: text.toUpperCase(),
                camelCase: text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                    index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, ''),
                pascalCase: text.replace(/(?:^\w|[A-Z]|\b\w)/g, word =>
                    word.toUpperCase()).replace(/\s+/g, ''),
                snakeCase: text.toLowerCase().replace(/\s+/g, '_'),
                kebabCase: text.toLowerCase().replace(/\s+/g, '-'),
                constantCase: text.toUpperCase().replace(/\s+/g, '_'),
                dotCase: text.toLowerCase().replace(/\s+/g, '.'),
                pathCase: text.toLowerCase().replace(/\s+/g, '/'),
                titleCase: text.replace(/\w\S*/g, txt =>
                    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
            };
        } catch (error) {
            logger.error(`Case conversion error: ${error.message}`);
            throw new Error(`Failed to convert case: ${error.message}`);
        }
    }

    dateTimeConverter(datetime, inputFormat, outputFormat = 'iso', timezone = 'utc') {
        if (!datetime) {
            throw new Error('Datetime is required');
        }

        try {
            const date = new Date(datetime);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid datetime format');
            }

            const formats = {
                iso: date.toISOString(),
                unix: Math.floor(date.getTime() / 1000),
                readable: date.toLocaleString('en-US'),
                utc: date.toUTCString(),
                local: date.toLocaleString(),
                date: date.toLocaleDateString(),
                time: date.toLocaleTimeString()
            };

            return {
                input: datetime,
                output: formats[outputFormat] || formats.iso,
                formats: formats,
                timezone: timezone
            };
        } catch (error) {
            logger.error(`Date time conversion error: ${error.message}`);
            throw new Error(`Failed to convert datetime: ${error.message}`);
        }
    }

    romanNumeralConverter(number) {
        if (!number) {
            throw new Error('Number is required');
        }

        try {
            if (/^[IVXLCDM]+$/i.test(number)) {
                return { result: this.romanToArabic(number.toUpperCase()), type: 'arabic', original: number };
            } else {
                const num = parseInt(number);
                if (num < 1 || num > 3999) {
                    throw new Error('Number must be between 1 and 3999');
                }
                return { result: this.arabicToRoman(num), type: 'roman', original: number };
            }
        } catch (error) {
            logger.error(`Roman numeral conversion error: ${error.message}`);
            throw new Error(`Failed to convert roman numeral: ${error.message}`);
        }
    }

    arabicToRoman(num) {
        const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
        let result = '';

        for (let i = 0; i < values.length; i++) {
            while (num >= values[i]) {
                result += symbols[i];
                num -= values[i];
            }
        }
        return result;
    }

    romanToArabic(roman) {
        const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let result = 0;

        for (let i = 0; i < roman.length; i++) {
            const current = values[roman[i]];
            const next = values[roman[i + 1]];

            if (next && current < next) {
                result -= current;
            } else {
                result += current;
            }
        }
        return result;
    }

    integerBaseConverter(number, fromBase = 10, toBase = 2) {
        if (!number) {
            throw new Error('Number is required');
        }

        const from = parseInt(fromBase) || 10;
        const to = parseInt(toBase) || 2;

        if (from < 2 || from > 36 || to < 2 || to > 36) {
            throw new Error('Base must be between 2 and 36');
        }

        try {
            const decimal = parseInt(number, from);
            const result = decimal.toString(to).toUpperCase();

            return {
                result: result,
                decimal: decimal,
                fromBase: from,
                toBase: to,
                original: number
            };
        } catch (error) {
            logger.error(`Base conversion error: ${error.message}`);
            throw new Error(`Failed to convert base: ${error.message}`);
        }
    }

    textToNatoAlphabet(text) {
        if (!text) {
            throw new Error('Text is required');
        }

        const nato = {
            'A': 'Alfa', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo',
            'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel', 'I': 'India', 'J': 'Juliett',
            'K': 'Kilo', 'L': 'Lima', 'M': 'Mike', 'N': 'November', 'O': 'Oscar',
            'P': 'Papa', 'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
            'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray', 'Y': 'Yankee',
            'Z': 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
            '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
        };

        try {
            const result = text.toUpperCase().split('').map(char => {
                return nato[char] || char;
            });

            return {
                result: result.join(' '),
                words: result,
                original: text
            };
        } catch (error) {
            logger.error(`NATO alphabet conversion error: ${error.message}`);
            throw new Error(`Failed to convert to NATO alphabet: ${error.message}`);
        }
    }

    textToBinary(text, separator = ' ') {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const binary = text.split('').map(char => {
                return char.charCodeAt(0).toString(2).padStart(8, '0');
            });

            return {
                result: binary.join(separator || ' '),
                bytes: binary,
                length: binary.length
            };
        } catch (error) {
            logger.error(`Binary conversion error: ${error.message}`);
            throw new Error(`Failed to convert to binary: ${error.message}`);
        }
    }

    textToUnicode(text) {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const unicode = text.split('').map(char => {
                return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
            });

            return {
                result: unicode.join(''),
                codes: unicode,
                length: unicode.length
            };
        } catch (error) {
            logger.error(`Unicode conversion error: ${error.message}`);
            throw new Error(`Failed to convert to unicode: ${error.message}`);
        }
    }

    yamlToJson(yaml) {
        if (!yaml) {
            throw new Error('YAML is required');
        }

        try {
            const jsYaml = require('js-yaml');
            const obj = jsYaml.load(yaml);
            const json = JSON.stringify(obj, null, 2);

            return {
                result: json,
                object: obj
            };
        } catch (error) {
            logger.error(`YAML to JSON conversion error: ${error.message}`);
            throw new Error(`Failed to convert YAML to JSON: ${error.message}`);
        }
    }

    jsonToYaml(json) {
        if (!json) {
            throw new Error('JSON is required');
        }

        try {
            const jsYaml = require('js-yaml');
            const obj = JSON.parse(json);
            const yaml = jsYaml.dump(obj);

            return {
                result: yaml,
                object: obj
            };
        } catch (error) {
            logger.error(`JSON to YAML conversion error: ${error.message}`);
            throw new Error(`Failed to convert JSON to YAML: ${error.message}`);
        }
    }

    yamlToToml(yaml) {
        if (!yaml) {
            throw new Error('YAML is required');
        }

        try {
            const jsYaml = require('js-yaml');
            const toml = require('@iarna/toml');
            const obj = jsYaml.load(yaml);
            const result = toml.stringify(obj);

            return {
                result: result,
                object: obj
            };
        } catch (error) {
            logger.error(`YAML to TOML conversion error: ${error.message}`);
            throw new Error(`Failed to convert YAML to TOML: ${error.message}`);
        }
    }

    jsonToToml(json) {
        if (!json) {
            throw new Error('JSON is required');
        }

        try {
            const toml = require('@iarna/toml');
            const obj = JSON.parse(json);
            const result = toml.stringify(obj);

            return {
                result: result,
                object: obj
            };
        } catch (error) {
            logger.error(`JSON to TOML conversion error: ${error.message}`);
            throw new Error(`Failed to convert JSON to TOML: ${error.message}`);
        }
    }

    tomlToYaml(tomlStr) {
        if (!tomlStr) {
            throw new Error('TOML is required');
        }

        try {
            const toml = require('@iarna/toml');
            const jsYaml = require('js-yaml');
            const obj = toml.parse(tomlStr);
            const result = jsYaml.dump(obj);

            return {
                result: result,
                object: obj
            };
        } catch (error) {
            logger.error(`TOML to YAML conversion error: ${error.message}`);
            throw new Error(`Failed to convert TOML to YAML: ${error.message}`);
        }
    }

    tomlToJson(tomlStr) {
        if (!tomlStr) {
            throw new Error('TOML is required');
        }

        try {
            const toml = require('@iarna/toml');
            const obj = toml.parse(tomlStr);
            const result = JSON.stringify(obj, null, 2);

            return {
                result: result,
                object: obj
            };
        } catch (error) {
            logger.error(`TOML to JSON conversion error: ${error.message}`);
            throw new Error(`Failed to convert TOML to JSON: ${error.message}`);
        }
    }

    xmlToJson(xml) {
        if (!xml) {
            throw new Error('XML is required');
        }

        try {
            const xml2js = require('xml2js');
            const parser = new xml2js.Parser();
            let result;

            parser.parseString(xml, (err, obj) => {
                if (err) throw err;
                result = JSON.stringify(obj, null, 2);
            });

            return {
                result: result
            };
        } catch (error) {
            logger.error(`XML to JSON conversion error: ${error.message}`);
            throw new Error(`Failed to convert XML to JSON: ${error.message}`);
        }
    }

    jsonToXml(json, rootElement = 'root') {
        if (!json) {
            throw new Error('JSON is required');
        }

        try {
            const xml2js = require('xml2js');
            const obj = JSON.parse(json);
            const builder = new xml2js.Builder({ rootName: rootElement });
            const result = builder.buildObject(obj);

            return {
                result: result,
                rootElement: rootElement
            };
        } catch (error) {
            logger.error(`JSON to XML conversion error: ${error.message}`);
            throw new Error(`Failed to convert JSON to XML: ${error.message}`);
        }
    }

    markdownToHtml(markdown) {
        if (!markdown) {
            throw new Error('Markdown is required');
        }

        try {
            const marked = require('marked');
            const html = marked.parse(markdown);

            return {
                result: html,
                length: html.length
            };
        } catch (error) {
            logger.error(`Markdown to HTML conversion error: ${error.message}`);
            throw new Error(`Failed to convert Markdown to HTML: ${error.message}`);
        }
    }

    listConverter(list, inputFormat = 'comma', outputFormat = 'newline') {
        if (!list) {
            throw new Error('List is required');
        }

        try {
            let items = [];

            switch (inputFormat) {
                case 'comma':
                    items = list.split(',').map(item => item.trim());
                    break;
                case 'newline':
                    items = list.split('\n').map(item => item.trim());
                    break;
                case 'semicolon':
                    items = list.split(';').map(item => item.trim());
                    break;
                case 'space':
                    items = list.split(' ').map(item => item.trim());
                    break;
                case 'json-array':
                    items = JSON.parse(list);
                    break;
                default:
                    items = list.split(',').map(item => item.trim());
            }

            let result;
            switch (outputFormat) {
                case 'comma':
                    result = items.join(', ');
                    break;
                case 'newline':
                    result = items.join('\n');
                    break;
                case 'semicolon':
                    result = items.join('; ');
                    break;
                case 'space':
                    result = items.join(' ');
                    break;
                case 'json-array':
                    result = JSON.stringify(items, null, 2);
                    break;
                case 'bullet-points':
                    result = items.map(item => `• ${item}`).join('\n');
                    break;
                default:
                    result = items.join('\n');
            }

            return {
                result: result,
                items: items,
                count: items.length,
                inputFormat: inputFormat,
                outputFormat: outputFormat
            };
        } catch (error) {
            logger.error(`List conversion error: ${error.message}`);
            throw new Error(`Failed to convert list: ${error.message}`);
        }
    }

    temperatureConverter(temperature, fromUnit = 'celsius', toUnit = 'fahrenheit') {
        const temp = parseFloat(temperature);
        if (isNaN(temp)) {
            throw new Error('Invalid temperature value');
        }

        try {
            let celsius;

            switch (fromUnit.toLowerCase()) {
                case 'celsius':
                    celsius = temp;
                    break;
                case 'fahrenheit':
                    celsius = (temp - 32) * 5/9;
                    break;
                case 'kelvin':
                    celsius = temp - 273.15;
                    break;
                case 'rankine':
                    celsius = (temp - 491.67) * 5/9;
                    break;
                default:
                    throw new Error('Invalid from unit');
            }

            let result;
            switch (toUnit.toLowerCase()) {
                case 'celsius':
                    result = celsius;
                    break;
                case 'fahrenheit':
                    result = celsius * 9/5 + 32;
                    break;
                case 'kelvin':
                    result = celsius + 273.15;
                    break;
                case 'rankine':
                    result = celsius * 9/5 + 491.67;
                    break;
                default:
                    throw new Error('Invalid to unit');
            }

            return {
                result: Math.round(result * 100) / 100,
                fromUnit: fromUnit,
                toUnit: toUnit,
                original: temperature,
                allUnits: {
                    celsius: Math.round(celsius * 100) / 100,
                    fahrenheit: Math.round((celsius * 9/5 + 32) * 100) / 100,
                    kelvin: Math.round((celsius + 273.15) * 100) / 100,
                    rankine: Math.round((celsius * 9/5 + 491.67) * 100) / 100
                }
            };
        } catch (error) {
            logger.error(`Temperature conversion error: ${error.message}`);
            throw new Error(`Failed to convert temperature: ${error.message}`);
        }
    }

    slugifyString(text, separator = '-') {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const slug = text
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, separator)
                .replace(/^-+|-+$/g, '');

            return {
                result: slug,
                original: text,
                separator: separator
            };
        } catch (error) {
            logger.error(`Slugify error: ${error.message}`);
            throw new Error(`Failed to slugify string: ${error.message}`);
        }
    }

    jsonToCsv(json, delimiter = ',') {
        if (!json) {
            throw new Error('JSON is required');
        }

        try {
            const data = JSON.parse(json);

            if (!Array.isArray(data)) {
                throw new Error('JSON must be an array of objects');
            }

            if (data.length === 0) {
                return { result: '', rows: 0 };
            }

            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(delimiter)];

            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header];
                    const escaped = ('' + value).replace(/"/g, '\\"');
                    return `"${escaped}"`;
                });
                csvRows.push(values.join(delimiter));
            }

            return {
                result: csvRows.join('\n'),
                rows: data.length,
                columns: headers.length,
                headers: headers
            };
        } catch (error) {
            logger.error(`JSON to CSV conversion error: ${error.message}`);
            throw new Error(`Failed to convert JSON to CSV: ${error.message}`);
        }
    }
}

module.exports = ConverterTools;
