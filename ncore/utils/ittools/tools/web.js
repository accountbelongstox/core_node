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

class WebTools {
    constructor() {
        this.tools = [
            {
                id: 'json_prettify',
                name: 'JSON Prettify',
                description: 'Format and prettify JSON with proper indentation',
                category: 'web',
                icon: 'align-left',
                endpoint: '/web/json/prettify',
                method: 'POST',
                keywords: ['json', 'format', 'prettify', 'indent', 'beautify']
            },
            {
                id: 'json_minify',
                name: 'JSON Minify',
                description: 'Minify JSON by removing all whitespace',
                category: 'web',
                icon: 'compress',
                endpoint: '/web/json/minify',
                method: 'POST',
                keywords: ['json', 'minify', 'compress', 'reduce', 'optimize']
            },
            {
                id: 'json_diff',
                name: 'JSON Diff',
                description: 'Compare two JSON objects and highlight differences',
                category: 'web',
                icon: 'code-compare',
                endpoint: '/web/json/diff',
                method: 'POST',
                keywords: ['json', 'diff', 'compare', 'difference', 'merge']
            },
            {
                id: 'html_entities',
                name: 'HTML Entities',
                description: 'Encode and decode HTML entities',
                category: 'web',
                icon: 'code',
                endpoint: '/web/html/entities',
                method: 'POST',
                keywords: ['html', 'entities', 'encode', 'decode', 'escape']
            },
            {
                id: 'url_parser',
                name: 'URL Parser',
                description: 'Parse and analyze URL components',
                category: 'web',
                icon: 'link',
                endpoint: '/web/url/parse',
                method: 'POST',
                keywords: ['url', 'parse', 'analyze', 'query', 'parameters']
            },
            {
                id: 'jwt_parser',
                name: 'JWT Parser',
                description: 'Decode and inspect JSON Web Tokens',
                category: 'web',
                icon: 'key',
                endpoint: '/web/jwt/parse',
                method: 'POST',
                keywords: ['jwt', 'token', 'parse', 'decode', 'auth']
            },
            {
                id: 'sql_prettify',
                name: 'SQL Prettify',
                description: 'Format and beautify SQL queries',
                category: 'web',
                icon: 'database',
                endpoint: '/web/sql/prettify',
                method: 'POST',
                keywords: ['sql', 'format', 'prettify', 'query', 'database']
            },
            {
                id: 'xml_formatter',
                name: 'XML Formatter',
                description: 'Format and prettify XML documents',
                category: 'web',
                icon: 'code',
                endpoint: '/web/xml/format',
                method: 'POST',
                keywords: ['xml', 'format', 'prettify', 'indent', 'beautify']
            },
            {
                id: 'yaml_viewer',
                name: 'YAML Viewer',
                description: 'View and validate YAML files',
                category: 'web',
                icon: 'file-code',
                endpoint: '/web/yaml/view',
                method: 'POST',
                keywords: ['yaml', 'view', 'validate', 'format', 'parse']
            },
            {
                id: 'qr_code_generator',
                name: 'QR Code Generator',
                description: 'Generate QR codes from text or URLs',
                category: 'web',
                icon: 'qrcode',
                endpoint: '/web/qr/generate',
                method: 'POST',
                keywords: ['qr', 'qrcode', 'generate', 'barcode', 'scan']
            },
            {
                id: 'wifi_qr_code_generator',
                name: 'WiFi QR Code Generator',
                description: 'Generate WiFi QR codes for easy connection',
                category: 'web',
                icon: 'wifi',
                endpoint: '/web/qr/wifi',
                method: 'POST',
                keywords: ['wifi', 'qr', 'network', 'connect', 'wireless']
            },
            {
                id: 'meta_tag_generator',
                name: 'Meta Tag Generator',
                description: 'Generate HTML meta tags for SEO',
                category: 'web',
                icon: 'tags',
                endpoint: '/web/meta/generate',
                method: 'POST',
                keywords: ['meta', 'tags', 'seo', 'html', 'social']
            },
            {
                id: 'mime_types',
                name: 'MIME Types',
                description: 'Lookup MIME types for file extensions',
                category: 'web',
                icon: 'file',
                endpoint: '/web/mime/lookup',
                method: 'POST',
                keywords: ['mime', 'type', 'lookup', 'file', 'extension']
            },
            {
                id: 'http_status_codes',
                name: 'HTTP Status Codes',
                description: 'Lookup HTTP status code meanings',
                category: 'web',
                icon: 'server',
                endpoint: '/web/http/status',
                method: 'POST',
                keywords: ['http', 'status', 'code', 'error', 'response']
            },
            {
                id: 'html_wysiwyg_editor',
                name: 'HTML WYSIWYG Editor',
                description: 'What You See Is What You Get HTML editor',
                category: 'web',
                icon: 'edit',
                endpoint: '/web/html/editor',
                method: 'POST',
                keywords: ['html', 'editor', 'wysiwyg', 'rich-text']
            },
            {
                id: 'user_agent_parser',
                name: 'User Agent Parser',
                description: 'Parse and analyze HTTP User-Agent strings',
                category: 'web',
                icon: 'browser',
                endpoint: '/web/useragent/parse',
                method: 'POST',
                keywords: ['useragent', 'parse', 'browser', 'device', 'platform']
            },
            {
                id: 'css_minifier',
                name: 'CSS Minifier',
                description: 'Minify CSS to reduce file size',
                category: 'web',
                icon: 'compress',
                endpoint: '/web/css/minify',
                method: 'POST',
                keywords: ['css', 'minify', 'compress', 'optimize']
            },
            {
                id: 'js_minifier',
                name: 'JavaScript Minifier',
                description: 'Minify JavaScript code',
                category: 'web',
                icon: 'compress',
                endpoint: '/web/js/minify',
                method: 'POST',
                keywords: ['javascript', 'minify', 'compress', 'uglify']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'json_prettify':
                return this.jsonPrettify(params.json, params.indent);
            case 'json_minify':
                return this.jsonMinify(params.json);
            case 'json_diff':
                return this.jsonDiff(params.json1, params.json2);
            case 'html_entities':
                return this.htmlEntities(params.text, params.operation);
            case 'url_parser':
                return this.urlParser(params.url);
            case 'jwt_parser':
                return this.jwtParser(params.token);
            case 'sql_prettify':
                return this.sqlPrettify(params.sql);
            case 'xml_formatter':
                return this.xmlFormatter(params.xml, params.indent);
            case 'yaml_viewer':
                return this.yamlViewer(params.yaml);
            case 'qr_code_generator':
                return this.qrCodeGenerator(params.text, params.size);
            case 'wifi_qr_code_generator':
                return this.wifiQRCodeGenerator(params.ssid, params.password, params.encryption);
            case 'meta_tag_generator':
                return this.metaTagGenerator(params.title, params.description, params.keywords, params.image);
            case 'mime_types':
                return this.mimeTypes(params.extension);
            case 'http_status_codes':
                return this.httpStatusCodes(params.code);
            case 'html_wysiwyg_editor':
                return this.htmlWysiwygEditor(params.html);
            case 'user_agent_parser':
                return this.userAgentParser(params.useragent);
            case 'css_minifier':
                return this.cssMinifier(params.css);
            case 'js_minifier':
                return this.jsMinifier(params.js);
            default:
                throw new Error(`Unknown web tool: ${toolId}`);
        }
    }

    jsonPrettify(jsonString, indent = 2) {
        if (!jsonString) {
            throw new Error('JSON string is required');
        }

        const indentValue = parseInt(indent) || 2;

        if (indentValue < 1 || indentValue > 8) {
            throw new Error('Indent must be between 1 and 8');
        }

        try {
            const parsed = JSON.parse(jsonString);
            const formatted = JSON.stringify(parsed, null, indentValue);

            return {
                formatted: formatted,
                originalLength: jsonString.length,
                formattedLength: formatted.length,
                indent: indentValue
            };
        } catch (error) {
            logger.error(`JSON prettify error: ${error.message}`);
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }

    jsonMinify(jsonString) {
        if (!jsonString) {
            throw new Error('JSON string is required');
        }

        try {
            const parsed = JSON.parse(jsonString);
            const minified = JSON.stringify(parsed);

            return {
                minified: minified,
                originalLength: jsonString.length,
                minifiedLength: minified.length,
                saved: jsonString.length - minified.length
            };
        } catch (error) {
            logger.error(`JSON minify error: ${error.message}`);
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }

    jsonDiff(json1, json2) {
        if (!json1 || !json2) {
            throw new Error('Both JSON strings are required');
        }

        try {
            const obj1 = JSON.parse(json1);
            const obj2 = JSON.parse(json2);

            const differences = this.compareObjects(obj1, obj2);

            return {
                differences: differences,
                count: differences.length,
                identical: differences.length === 0
            };
        } catch (error) {
            logger.error(`JSON diff error: ${error.message}`);
            throw new Error(`Failed to compare JSON: ${error.message}`);
        }
    }

    compareObjects(obj1, obj2, path = '') {
        const diffs = [];
        const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

        for (const key of allKeys) {
            const newPath = path ? `${path}.${key}` : key;

            if (!(key in obj1)) {
                diffs.push({ path: newPath, type: 'added', value: obj2[key] });
            } else if (!(key in obj2)) {
                diffs.push({ path: newPath, type: 'removed', value: obj1[key] });
            } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
                diffs.push(...this.compareObjects(obj1[key], obj2[key], newPath));
            } else if (obj1[key] !== obj2[key]) {
                diffs.push({ path: newPath, type: 'changed', from: obj1[key], to: obj2[key] });
            }
        }

        return diffs;
    }

    htmlEntities(text, operation = 'encode') {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
                '/': '&#x2F;'
            };

            let result;
            if (operation === 'encode') {
                result = text.replace(/[&<>"'\/]/g, char => entities[char]);
            } else if (operation === 'decode') {
                const reverseEntities = Object.fromEntries(
                    Object.entries(entities).map(([key, value]) => [value, key])
                );
                result = text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x2F;/g, entity => reverseEntities[entity]);
            } else {
                throw new Error('Operation must be either "encode" or "decode"');
            }

            return {
                result: result,
                operation: operation,
                originalLength: text.length,
                resultLength: result.length
            };
        } catch (error) {
            logger.error(`HTML entities error: ${error.message}`);
            throw new Error(`Failed to process HTML entities: ${error.message}`);
        }
    }

    urlParser(url) {
        if (!url) {
            throw new Error('URL is required');
        }

        try {
            const parsed = new URL(url);

            const params = {};
            parsed.searchParams.forEach((value, key) => {
                params[key] = value;
            });

            return {
                href: parsed.href,
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port,
                pathname: parsed.pathname,
                search: parsed.search,
                hash: parsed.hash,
                host: parsed.host,
                origin: parsed.origin,
                params: params
            };
        } catch (error) {
            logger.error(`URL parser error: ${error.message}`);
            throw new Error(`Invalid URL: ${error.message}`);
        }
    }

    jwtParser(token) {
        if (!token) {
            throw new Error('Token is required');
        }

        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }

            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

            return {
                header: header,
                payload: payload,
                signature: parts[2],
                isExpired: payload.exp ? Date.now() / 1000 > payload.exp : null,
                expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
                issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null
            };
        } catch (error) {
            logger.error(`JWT parser error: ${error.message}`);
            throw new Error(`Failed to parse JWT: ${error.message}`);
        }
    }

    sqlPrettify(sql) {
        if (!sql) {
            throw new Error('SQL is required');
        }

        try {
            const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
                            'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'UPDATE',
                            'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE'];

            let formatted = sql.toUpperCase();
            for (const keyword of keywords) {
                formatted = formatted.replace(new RegExp(keyword, 'gi'), `\n${keyword}`);
            }

            formatted = formatted.trim();

            return {
                formatted: formatted,
                originalLength: sql.length,
                formattedLength: formatted.length
            };
        } catch (error) {
            logger.error(`SQL prettify error: ${error.message}`);
            throw new Error(`Failed to prettify SQL: ${error.message}`);
        }
    }

    xmlFormatter(xml, indent = 2) {
        if (!xml) {
            throw new Error('XML is required');
        }

        const indentValue = parseInt(indent) || 2;

        try {
            const formatted = xml.replace(/></g, '>\n<')
                               .split('\n')
                               .map((line, index) => {
                                   const depth = (line.match(/\//g) || []).length;
                                   return ' '.repeat(indentValue * depth) + line.trim();
                               })
                               .join('\n');

            return {
                formatted: formatted,
                originalLength: xml.length,
                formattedLength: formatted.length,
                indent: indentValue
            };
        } catch (error) {
            logger.error(`XML formatter error: ${error.message}`);
            throw new Error(`Failed to format XML: ${error.message}`);
        }
    }

    yamlViewer(yaml) {
        if (!yaml) {
            throw new Error('YAML is required');
        }

        try {
            const jsYaml = require('js-yaml');
            const obj = jsYaml.load(yaml);

            return {
                object: obj,
                json: JSON.stringify(obj, null, 2),
                valid: true,
                type: typeof obj
            };
        } catch (error) {
            logger.error(`YAML viewer error: ${error.message}`);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    qrCodeGenerator(text, size = 256) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            return {
                success: true,
                text: text,
                size: size,
                message: 'QR code generation requires qrcode library and image output',
                dataUrl: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>QR:${text}</text></svg>`
            };
        } catch (error) {
            logger.error(`QR code generation error: ${error.message}`);
            throw new Error(`Failed to generate QR code: ${error.message}`);
        }
    }

    wifiQRCodeGenerator(ssid, password, encryption = 'WPA') {
        if (!ssid) {
            throw new Error('SSID is required');
        }

        try {
            const wifiString = `WIFI:T:${encryption};S:${ssid};P:${password || ''};;`;

            return {
                wifiString: wifiString,
                ssid: ssid,
                encryption: encryption,
                message: 'WiFi QR code generation requires qrcode library'
            };
        } catch (error) {
            logger.error(`WiFi QR code generation error: ${error.message}`);
            throw new Error(`Failed to generate WiFi QR code: ${error.message}`);
        }
    }

    metaTagGenerator(title, description, keywords, image) {
        const tags = [];

        if (title) {
            tags.push(`<title>${title}</title>`);
            tags.push(`<meta property="og:title" content="${title}">`);
            tags.push(`<meta name="twitter:title" content="${title}">`);
        }

        if (description) {
            tags.push(`<meta name="description" content="${description}">`);
            tags.push(`<meta property="og:description" content="${description}">`);
            tags.push(`<meta name="twitter:description" content="${description}">`);
        }

        if (keywords) {
            tags.push(`<meta name="keywords" content="${keywords}">`);
        }

        if (image) {
            tags.push(`<meta property="og:image" content="${image}">`);
            tags.push(`<meta name="twitter:image" content="${image}">`);
        }

        tags.push(`<meta property="og:type" content="website">`);
        tags.push(`<meta name="twitter:card" content="summary_large_image">`);

        return {
            tags: tags,
            html: tags.join('\n')
        };
    }

    mimeTypes(extension) {
        const mimeMap = {
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'xml': 'application/xml',
            'pdf': 'application/pdf',
            'zip': 'application/zip',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            'txt': 'text/plain'
        };

        const ext = extension.replace('.', '').toLowerCase();
        const mime = mimeMap[ext] || 'application/octet-stream';

        return {
            extension: ext,
            mimeType: mime
        };
    }

    httpStatusCodes(code) {
        const statusMap = {
            200: 'OK',
            201: 'Created',
            204: 'No Content',
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable'
        };

        const statusCode = parseInt(code);
        const message = statusMap[statusCode] || 'Unknown';

        return {
            code: statusCode,
            message: message,
            category: Math.floor(statusCode / 100) * 100
        };
    }

    htmlWysiwygEditor(html) {
        return {
            html: html || '',
            message: 'WYSIWYG editor requires frontend implementation'
        };
    }

    userAgentParser(useragent) {
        if (!useragent) {
            throw new Error('User agent is required');
        }

        try {
            const browser = useragent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
            const os = useragent.match(/(Windows|Mac OS X|Linux|Android|iOS)/);
            const mobile = /Mobile|Android|iPhone/i.test(useragent);

            return {
                useragent: useragent,
                browser: browser ? browser[1] : 'Unknown',
                version: browser ? browser[2] : 'Unknown',
                os: os ? os[1] : 'Unknown',
                mobile: mobile,
                raw: useragent
            };
        } catch (error) {
            logger.error(`User agent parser error: ${error.message}`);
            throw new Error(`Failed to parse user agent: ${error.message}`);
        }
    }

    cssMinifier(css) {
        if (!css) {
            throw new Error('CSS is required');
        }

        try {
            const minified = css
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\s+/g, ' ')
                .replace(/\s*([{}:;,])\s*/g, '$1')
                .trim();

            return {
                minified: minified,
                originalLength: css.length,
                minifiedLength: minified.length,
                saved: css.length - minified.length
            };
        } catch (error) {
            logger.error(`CSS minifier error: ${error.message}`);
            throw new Error(`Failed to minify CSS: ${error.message}`);
        }
    }

    jsMinifier(js) {
        if (!js) {
            throw new Error('JavaScript is required');
        }

        try {
            const minified = js
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            return {
                minified: minified,
                originalLength: js.length,
                minifiedLength: minified.length,
                saved: js.length - minified.length,
                note: 'For production use, consider using a proper minifier like UglifyJS or Terser'
            };
        } catch (error) {
            logger.error(`JS minifier error: ${error.message}`);
            throw new Error(`Failed to minify JavaScript: ${error.message}`);
        }
    }
}

module.exports = WebTools;
