// Tool Implementations
// Each tool has a render function that returns the HTML template

// ==================== HASH TEXT ====================
window.render_hash_text = function() {
    return `
        <div x-data="hashTextTool()" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Text to Hash</label>
                <textarea
                    x-model="input"
                    @input="debounceHash()"
                    rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter text to hash..."
                ></textarea>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Algorithm</label>
                <select x-model="algorithm" @change="hash()" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="sha256">SHA-256</option>
                    <option value="sha512">SHA-512</option>
                    <option value="sha1">SHA-1</option>
                    <option value="md5">MD5</option>
                </select>
            </div>

            <div x-show="loading" class="flex justify-center">
                <div class="spinner"></div>
            </div>

            <div x-show="result && !loading" class="bg-gray-50 p-4 rounded-md">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Hash Result</label>
                    <button @click="copy()" class="text-sm text-blue-600 hover:text-blue-800">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <code class="block bg-gray-800 text-green-400 px-3 py-2 rounded break-all" x-text="result"></code>
            </div>
        </div>

        <script>
            function hashTextTool() {
                return {
                    input: '',
                    algorithm: 'sha256',
                    result: '',
                    loading: false,
                    timeout: null,

                    debounceHash() {
                        clearTimeout(this.timeout);
                        this.timeout = setTimeout(() => this.hash(), 500);
                    },

                    async hash() {
                        if (!this.input) {
                            this.result = '';
                            return;
                        }

                        this.loading = true;
                        try {
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}/crypto/hash', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    text: this.input,
                                    algorithm: this.algorithm
                                })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.result = data.data.hash;
                            } else {
                                throw new Error(data.error?.message || 'Hash failed');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        } finally {
                            this.loading = false;
                        }
                    },

                    copy() {
                        navigator.clipboard.writeText(this.result);
                        alert('Copied to clipboard!');
                    }
                };
            }
        </script>
    `;
};

// ==================== BASE64 ENCODER/DECODER ====================
window.render_base64_string = function() {
    return `
        <div x-data="base64Tool()" class="space-y-4">
            <div class="flex space-x-2 mb-4">
                <button
                    @click="mode = 'encode'"
                    :class="mode === 'encode' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
                    class="px-4 py-2 rounded-md"
                >
                    Encode
                </button>
                <button
                    @click="mode = 'decode'"
                    :class="mode === 'decode' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
                    class="px-4 py-2 rounded-md"
                >
                    Decode
                </button>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2" x-text="mode === 'encode' ? 'Plain Text' : 'Base64 Encoded'"></label>
                <textarea
                    x-model="input"
                    rows="6"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    :placeholder="mode === 'encode' ? 'Enter text to encode...' : 'Enter base64 to decode...'"
                ></textarea>
            </div>

            <button @click="convert()" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                <i class="fas fa-exchange-alt mr-2"></i>
                <span x-text="mode === 'encode' ? 'Encode' : 'Decode'"></span>
            </button>

            <div x-show="result" class="bg-gray-50 p-4 rounded-md">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700" x-text="mode === 'encode' ? 'Base64 Encoded' : 'Plain Text'"></label>
                    <button @click="copy()" class="text-sm text-blue-600 hover:text-blue-800">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <pre class="bg-gray-800 text-green-400 px-3 py-2 rounded overflow-x-auto" x-text="result"></pre>
            </div>
        </div>

        <script>
            function base64Tool() {
                return {
                    mode: 'encode',
                    input: '',
                    result: '',

                    async convert() {
                        if (!this.input) return;

                        try {
                            const endpoint = this.mode === 'encode' ? '/converter/base64/encode' : '/converter/base64/decode';
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}' + endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(this.mode === 'encode' ? { text: this.input } : { encoded: this.input })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.result = this.mode === 'encode' ? data.data.encoded : data.data.decoded;
                            } else {
                                throw new Error(data.error?.message || 'Conversion failed');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    },

                    copy() {
                        navigator.clipboard.writeText(this.result);
                        alert('Copied to clipboard!');
                    }
                };
            }
        </script>
    `;
};

// ==================== UUID GENERATOR ====================
window.render_uuid_generator = function() {
    return `
        <div x-data="uuidTool()" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Number of UUIDs</label>
                <input
                    type="number"
                    x-model.number="count"
                    min="1"
                    max="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
            </div>

            <div class="flex items-center space-x-2">
                <input type="checkbox" x-model="uppercase" id="uppercase" class="rounded">
                <label for="uppercase" class="text-sm text-gray-700">Uppercase</label>
            </div>

            <button @click="generate()" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                <i class="fas fa-fingerprint mr-2"></i>
                Generate UUIDs
            </button>

            <div x-show="uuids.length > 0" class="bg-gray-50 p-4 rounded-md">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Generated UUIDs (<span x-text="uuids.length"></span>)</label>
                    <button @click="copyAll()" class="text-sm text-blue-600 hover:text-blue-800">
                        <i class="fas fa-copy"></i> Copy All
                    </button>
                </div>
                <div class="space-y-1 max-h-64 overflow-y-auto">
                    <template x-for="(uuid, index) in uuids" :key="index">
                        <div class="flex items-center justify-between bg-white px-3 py-2 rounded border">
                            <code class="text-sm" x-text="uuid"></code>
                            <button @click="copyOne(uuid)" class="text-blue-600 hover:text-blue-800 text-xs">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <script>
            function uuidTool() {
                return {
                    count: 10,
                    uppercase: false,
                    uuids: [],

                    async generate() {
                        try {
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}/crypto/uuid/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    count: this.count,
                                    version: 4,
                                    uppercase: this.uppercase
                                })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.uuids = data.data.uuids;
                            } else {
                                throw new Error(data.error?.message || 'Generation failed');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    },

                    copyOne(uuid) {
                        navigator.clipboard.writeText(uuid);
                        alert('UUID copied!');
                    },

                    copyAll() {
                        navigator.clipboard.writeText(this.uuids.join('\\n'));
                        alert('All UUIDs copied!');
                    }
                };
            }
        </script>
    `;
};

// ==================== JSON FORMATTER ====================
window.render_json_viewer = function() {
    return `
        <div x-data="jsonViewerTool()" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">JSON Input</label>
                <textarea
                    x-model="input"
                    rows="8"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder='{"name": "John", "age": 30}'
                ></textarea>
            </div>

            <div class="flex space-x-2">
                <button @click="prettify()" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <i class="fas fa-align-left mr-2"></i>
                    Prettify
                </button>
                <button @click="minify()" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                    <i class="fas fa-compress mr-2"></i>
                    Minify
                </button>
                <button @click="validate()" class="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
                    <i class="fas fa-check mr-2"></i>
                    Validate
                </button>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Indentation</label>
                <select x-model.number="indent" class="px-3 py-2 border border-gray-300 rounded-md">
                    <option :value="2">2 spaces</option>
                    <option :value="4">4 spaces</option>
                    <option :value="8">8 spaces</option>
                </select>
            </div>

            <div x-show="error" class="bg-red-50 border-l-4 border-red-500 p-4">
                <p class="text-sm text-red-700" x-text="error"></p>
            </div>

            <div x-show="result" class="bg-gray-50 p-4 rounded-md">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Result</label>
                    <button @click="copy()" class="text-sm text-blue-600 hover:text-blue-800">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <pre class="bg-gray-800 text-green-400 px-3 py-2 rounded overflow-x-auto font-mono text-sm max-h-96" x-text="result"></pre>
            </div>
        </div>

        <script>
            function jsonViewerTool() {
                return {
                    input: '',
                    result: '',
                    error: '',
                    indent: 2,

                    async prettify() {
                        this.error = '';
                        try {
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}/web/json/prettify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    json: this.input,
                                    indent: this.indent
                                })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.result = data.data.prettified;
                            } else {
                                throw new Error(data.error?.message || 'Prettify failed');
                            }
                        } catch (error) {
                            this.error = error.message;
                        }
                    },

                    async minify() {
                        this.error = '';
                        try {
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}/web/json/minify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ json: this.input })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.result = data.data.minified;
                            } else {
                                throw new Error(data.error?.message || 'Minify failed');
                            }
                        } catch (error) {
                            this.error = error.message;
                        }
                    },

                    validate() {
                        this.error = '';
                        this.result = '';
                        try {
                            JSON.parse(this.input);
                            this.result = '✓ Valid JSON';
                        } catch (error) {
                            this.error = 'Invalid JSON: ' + error.message;
                        }
                    },

                    copy() {
                        navigator.clipboard.writeText(this.result);
                        alert('Copied to clipboard!');
                    }
                };
            }
        </script>
    `;
};

// ==================== COLOR CONVERTER ====================
window.render_color_converter = function() {
    return `
        <div x-data="colorConverterTool()" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Color Input</label>
                <div class="flex space-x-2">
                    <input
                        type="text"
                        x-model="input"
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="#FF5733 or rgb(255, 87, 51)"
                    >
                    <input
                        type="color"
                        x-model="colorPicker"
                        @change="input = colorPicker"
                        class="w-16 h-10 border border-gray-300 rounded-md cursor-pointer"
                    >
                </div>
            </div>

            <button @click="convert()" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                <i class="fas fa-palette mr-2"></i>
                Convert
            </button>

            <div x-show="result" class="space-y-3">
                <div class="h-24 rounded-md border-2 border-gray-300" :style="'background-color: ' + result?.hex"></div>

                <div class="grid grid-cols-1 gap-2">
                    <div class="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                        <div>
                            <span class="text-xs text-gray-500">HEX</span>
                            <p class="font-mono" x-text="result?.hex"></p>
                        </div>
                        <button @click="copy(result?.hex)" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                        <div>
                            <span class="text-xs text-gray-500">RGB</span>
                            <p class="font-mono" x-text="result?.rgb"></p>
                        </div>
                        <button @click="copy(result?.rgb)" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                        <div>
                            <span class="text-xs text-gray-500">HSL</span>
                            <p class="font-mono" x-text="result?.hsl"></p>
                        </div>
                        <button @click="copy(result?.hsl)" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                        <div>
                            <span class="text-xs text-gray-500">HSV</span>
                            <p class="font-mono" x-text="result?.hsv"></p>
                        </div>
                        <button @click="copy(result?.hsv)" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                        <div>
                            <span class="text-xs text-gray-500">CMYK</span>
                            <p class="font-mono" x-text="result?.cmyk"></p>
                        </div>
                        <button @click="copy(result?.cmyk)" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script>
            function colorConverterTool() {
                return {
                    input: '#FF5733',
                    colorPicker: '#FF5733',
                    result: null,

                    async convert() {
                        try {
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}/converter/color', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ color: this.input })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.result = data.data;
                                this.colorPicker = data.data.hex;
                            } else {
                                throw new Error(data.error?.message || 'Conversion failed');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    },

                    copy(value) {
                        navigator.clipboard.writeText(value);
                        alert('Copied: ' + value);
                    }
                };
            }
        </script>
    `;
};

// ==================== JWT PARSER ====================
window.render_jwt_parser = function() {
    return `
        <div x-data="jwtParserTool()" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">JWT Token</label>
                <textarea
                    x-model="token"
                    rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                ></textarea>
            </div>

            <button @click="parse()" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                <i class="fas fa-search mr-2"></i>
                Parse JWT
            </button>

            <div x-show="result" class="space-y-4">
                <div class="bg-gray-50 p-4 rounded-md">
                    <h3 class="font-semibold mb-2 text-purple-700">Header</h3>
                    <pre class="bg-gray-800 text-green-400 px-3 py-2 rounded overflow-x-auto text-xs" x-text="JSON.stringify(result?.header, null, 2)"></pre>
                </div>

                <div class="bg-gray-50 p-4 rounded-md">
                    <h3 class="font-semibold mb-2 text-blue-700">Payload</h3>
                    <pre class="bg-gray-800 text-green-400 px-3 py-2 rounded overflow-x-auto text-xs" x-text="JSON.stringify(result?.payload, null, 2)"></pre>
                </div>

                <div class="bg-gray-50 p-4 rounded-md">
                    <h3 class="font-semibold mb-2 text-red-700">Signature</h3>
                    <code class="block bg-gray-800 text-green-400 px-3 py-2 rounded break-all text-xs" x-text="result?.signature"></code>
                </div>
            </div>
        </div>

        <script>
            function jwtParserTool() {
                return {
                    token: '',
                    result: null,

                    async parse() {
                        if (!this.token) return;

                        try {
                            const response = await fetch('${Alpine.store('app')?.apiBaseUrl || 'https://api.si.12gm.com/it-tools/v1'}/web/jwt/parse', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token: this.token })
                            });

                            const data = await response.json();
                            if (data.success) {
                                this.result = data.data;
                            } else {
                                throw new Error(data.error?.message || 'Parse failed');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }
                };
            }
        </script>
    `;
};

// Add more tool implementations as needed...
