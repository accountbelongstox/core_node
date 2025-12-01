ITTools.Tools.Registry.register('online-translation', {
    name: 'Online Translation',
    category: 'ai',
    init() {
        ITTools.Implementations.Translation.init();
    },
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">🌐 AI Translation & Language Learning Tool</div>
                <div class="ittools-card-body">
                    <div class="ittools-tabs" style="margin-bottom: 20px;">
                        <button class="ittools-tab active" onclick="ITTools.Implementations.Translation.switchMode('learning')">Language Learning</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.Translation.switchMode('simple')">Simple Translation</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.Translation.switchMode('tts')">🔊 Text to Speech</button>
                    </div>
                    
                    <div id="translation-learning-mode">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Source Text:</label>
                            <textarea id="learning-source" class="ittools-textarea" placeholder="Enter text to learn..." style="min-height: 120px;"></textarea>
                        </div>
                        
                        <div class="ittools-form-group">
                            <label class="ittools-label">Target Languages (Select Multiple):</label>
                            <div id="learning-languages" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; padding: 10px; background: rgba(248, 249, 250, 0.5); border-radius: 6px;">
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="lo" checked> Lao
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="ja" checked> Japanese
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="vi" checked> Vietnamese
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="en" checked> English
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="zh"> Chinese (Simplified)
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="ko"> Korean
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="th"> Thai
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="es"> Spanish
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="fr"> French
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="de"> German
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" class="learning-lang-checkbox" value="ru"> Russian
                                </label>
                            </div>
                        </div>
                        
                        <div class="ittools-form-group">
                            <label class="ittools-label">Learning Options:</label>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 10px; background: rgba(248, 249, 250, 0.5); border-radius: 6px;">
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="option-phonetics" checked> 📢 Show Phonetics (IPA)
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="option-words" checked> 📝 Show Words Breakdown
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="option-letters" checked> 🔤 Show Letters & Pronunciation
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="option-ambiguity" checked> ⚠️ Show Ambiguous Sentence
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="option-audio" checked> 🔊 Generate Audio (edge-tts)
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="option-skip-cache"> 🔄 Skip Cache (Force Refresh)
                                </label>
                            </div>
                        </div>
                        
                        <div class="ittools-tabs" style="margin-bottom: 20px;">
                            <button class="ittools-tab active" data-method="ai" onclick="ITTools.Implementations.Translation.switchTranslationMethod('ai')">🤖 AI Model</button>
                            <button class="ittools-tab" data-method="google" onclick="ITTools.Implementations.Translation.switchTranslationMethod('google')">🌐 Google Translate</button>
                        </div>
                        
                        <div id="ai-method-panel">
                            <div class="ittools-form-group">
                                <label class="ittools-label">AI Model (Free Only):</label>
                                <select id="ai-model-select" class="ittools-select">
                                    <option value="0">Loading models...</option>
                                </select>
                                <div style="font-size: 12px; color: #666; margin-top: 5px;">* AI mode provides phonetics, word breakdown, and letter pronunciation</div>
                            </div>
                        </div>
                        
                        <div id="google-method-panel" style="display: none;">
                            <div class="ittools-form-group">
                                <div style="padding: 20px; background: rgba(248, 249, 250, 0.5); border-radius: 6px; text-align: center; color: #666;">
                                    <p>Google Translate: Fast translation without additional learning features</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.Translation.translateLearning()">
                                📚 Learn & Translate
                            </button>
                            <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.Translation.clearLearning()">
                                🗑️ Clear
                            </button>
                        </div>
                        
                        <div id="learning-result" class="ittools-result" style="display: none; margin-top: 15px;"></div>
                        <div id="learning-output" style="margin-top: 20px;"></div>
                    </div>
                    
                    <div id="translation-simple-mode" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Source Text:</label>
                            <textarea id="translation-source" class="ittools-textarea" placeholder="Enter text to translate..." style="min-height: 150px;"></textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="ittools-form-group">
                                <label class="ittools-label">Target Language:</label>
                                <select id="translation-target-lang" class="ittools-select">
                                    <option value="lo">Lao</option>
                                    <option value="ja">Japanese</option>
                                    <option value="vi">Vietnamese</option>
                                    <option value="en">English</option>
                                    <option value="zh">Chinese (Simplified)</option>
                                    <option value="zh-TW">Chinese (Traditional)</option>
                                    <option value="ko">Korean</option>
                                    <option value="th">Thai</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                    <option value="ru">Russian</option>
                                    <option value="ar">Arabic</option>
                                    <option value="pt">Portuguese</option>
                                    <option value="it">Italian</option>
                                    <option value="nl">Dutch</option>
                                    <option value="pl">Polish</option>
                                    <option value="tr">Turkish</option>
                                    <option value="id">Indonesian</option>
                                </select>
                            </div>
                            
                            <div class="ittools-form-group">
                                <label class="ittools-label">Translation Type:</label>
                                <select id="translation-type" class="ittools-select">
                                    <option value="general">General</option>
                                    <option value="professional">Professional</option>
                                    <option value="casual">Casual</option>
                                    <option value="technical">Technical</option>
                                    <option value="literary">Literary</option>
                                    <option value="multilingual_detect">Auto-detect Language</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="ittools-form-group">
                            <label class="ittools-label">Translation Provider:</label>
                            <select id="simple-translation-provider" class="ittools-select" onchange="ITTools.Implementations.Translation.onSimpleProviderChange()">
                                <option value="openrouter">🤖 OpenRouter AI</option>
                                <option value="gemini">✨ Gemini AI (TODO)</option>
                                <option value="google" selected>🌐 Google Translate</option>
                            </select>
                        </div>
                        
                        <div id="simple-ai-model-panel" style="display: none;">
                            <div class="ittools-form-group">
                                <label class="ittools-label">AI Model:</label>
                                <select id="simple-ai-model-select" class="ittools-select">
                                    <option value="0">Loading models...</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.Translation.translate()">
                                🌐 Translate
                            </button>
                            <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.Translation.clear()">
                                🗑️ Clear
                            </button>
                            <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.Translation.swap()">
                                ↔️ Swap Source & Result
                            </button>
                        </div>
                        
                        <div id="translation-result" class="ittools-result" style="display: none; margin-top: 15px;"></div>
                        
                        <div id="translation-output" style="margin-top: 15px; display: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <label class="ittools-label" style="margin: 0;">Translation Result:</label>
                                <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.Translation.copyResult()">
                                    📋 Copy
                                </button>
                            </div>
                            <textarea id="translation-result-text" class="ittools-textarea" readonly style="min-height: 150px; background: rgba(248, 249, 250, 0.8);"></textarea>
                        </div>
                    </div>
                    
                    <div id="translation-tts-mode" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Text to Speak:</label>
                            <textarea id="tts-source" class="ittools-textarea" placeholder="Enter text for text-to-speech..." style="min-height: 120px;"></textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="ittools-form-group">
                                <label class="ittools-label">Language:</label>
                                <select id="tts-language-mode" class="ittools-select" onchange="ITTools.Implementations.Translation.onTTSLanguageModeChange()">
                                    <option value="detect">🔍 Auto Detect</option>
                                    <option value="manual">📝 Select Manually</option>
                                </select>
                            </div>
                            
                            <div class="ittools-form-group" id="tts-language-select-group" style="display: none;">
                                <label class="ittools-label">Target Language:</label>
                                <select id="tts-target-lang" class="ittools-select">
                                    <option value="af">Afrikaans</option>
                                    <option value="am">Amharic</option>
                                    <option value="ar">Arabic</option>
                                    <option value="as">Assamese</option>
                                    <option value="az">Azerbaijani</option>
                                    <option value="bg">Bulgarian</option>
                                    <option value="bn">Bengali</option>
                                    <option value="bs">Bosnian</option>
                                    <option value="ca">Catalan</option>
                                    <option value="cs">Czech</option>
                                    <option value="cy">Welsh</option>
                                    <option value="da">Danish</option>
                                    <option value="de">German</option>
                                    <option value="el">Greek</option>
                                    <option value="en" selected>English</option>
                                    <option value="es">Spanish</option>
                                    <option value="et">Estonian</option>
                                    <option value="eu">Basque</option>
                                    <option value="fa">Persian</option>
                                    <option value="fi">Finnish</option>
                                    <option value="fil">Filipino</option>
                                    <option value="fr">French</option>
                                    <option value="ga">Irish</option>
                                    <option value="gl">Galician</option>
                                    <option value="gu">Gujarati</option>
                                    <option value="he">Hebrew</option>
                                    <option value="hi">Hindi</option>
                                    <option value="hr">Croatian</option>
                                    <option value="hu">Hungarian</option>
                                    <option value="hy">Armenian</option>
                                    <option value="id">Indonesian</option>
                                    <option value="is">Icelandic</option>
                                    <option value="it">Italian</option>
                                    <option value="ja">Japanese</option>
                                    <option value="jv">Javanese</option>
                                    <option value="ka">Georgian</option>
                                    <option value="kk">Kazakh</option>
                                    <option value="km">Khmer</option>
                                    <option value="kn">Kannada</option>
                                    <option value="ko">Korean</option>
                                    <option value="lo">Lao</option>
                                    <option value="lt">Lithuanian</option>
                                    <option value="lv">Latvian</option>
                                    <option value="mk">Macedonian</option>
                                    <option value="ml">Malayalam</option>
                                    <option value="mn">Mongolian</option>
                                    <option value="mr">Marathi</option>
                                    <option value="ms">Malay</option>
                                    <option value="mt">Maltese</option>
                                    <option value="my">Burmese</option>
                                    <option value="nb">Norwegian</option>
                                    <option value="ne">Nepali</option>
                                    <option value="nl">Dutch</option>
                                    <option value="or">Odia</option>
                                    <option value="pa">Punjabi</option>
                                    <option value="pl">Polish</option>
                                    <option value="ps">Pashto</option>
                                    <option value="pt">Portuguese</option>
                                    <option value="ro">Romanian</option>
                                    <option value="ru">Russian</option>
                                    <option value="si">Sinhala</option>
                                    <option value="sk">Slovak</option>
                                    <option value="sl">Slovenian</option>
                                    <option value="so">Somali</option>
                                    <option value="sq">Albanian</option>
                                    <option value="sr">Serbian</option>
                                    <option value="su">Sundanese</option>
                                    <option value="sv">Swedish</option>
                                    <option value="sw">Swahili</option>
                                    <option value="ta">Tamil</option>
                                    <option value="te">Telugu</option>
                                    <option value="th">Thai</option>
                                    <option value="tr">Turkish</option>
                                    <option value="uk">Ukrainian</option>
                                    <option value="ur">Urdu</option>
                                    <option value="uz">Uzbek</option>
                                    <option value="vi">Vietnamese</option>
                                    <option value="wuu">Wu Chinese</option>
                                    <option value="yue">Cantonese</option>
                                    <option value="zh">Chinese (Mandarin)</option>
                                    <option value="zu">Zulu</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="ittools-form-group">
                            <label class="ittools-label">Speech Speed:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="range" id="tts-speed" min="0.5" max="2.0" step="0.1" value="0.9" class="ittools-slider" style="flex: 1;" oninput="document.getElementById('tts-speed-value').textContent = this.value">
                                <span id="tts-speed-value" style="min-width: 40px; font-weight: 600; color: #667eea;">0.9</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-top: 5px;">
                                <span>0.5x (Slower)</span>
                                <span>1.0x (Normal)</span>
                                <span>2.0x (Faster)</span>
                            </div>
                        </div>
                        
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.Translation.generateTTS()">
                                🔊 Generate Speech
                            </button>
                            <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.Translation.clearTTS()">
                                🗑️ Clear
                            </button>
                        </div>
                        
                        <div id="tts-result" class="ittools-result" style="display: none; margin-top: 15px;"></div>
                        
                        <div id="tts-output" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.Translation = {
    currentMode: 'learning',
    translationMethod: 'ai',
    storageKey: 'ittools_translation_state',
    freeModels: [],
    languageTemplates: {},
    
    init() {
        this.loadState();
        this.bindEvents();
        this.loadLanguageTemplates();
        
        setTimeout(() => {
            const learningModelSelect = document.getElementById('ai-model-select');
            if (learningModelSelect.innerHTML.includes('Loading models')) {
                this.loadFreeModels(false);
            }
        }, 200);
    },
    
    async loadLanguageTemplates() {
        try {
            const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/templates', {
                method: 'GET'
            });

            if (!response.ok) {
                console.error('Failed to load language templates:', response.status);
                return;
            }
            
            const result = await response.json();
            
            if (result.success && result.templates) {
                this.languageTemplates = result.templates;
                console.log('[Translation] Loaded language templates:', Object.keys(this.languageTemplates));
            } else {
                console.error('Invalid templates response:', result);
            }
        } catch (error) {
            console.error('Failed to load language templates:', error);
        }
    },
    
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const state = JSON.parse(saved);
                
                if (state.mode) {
                    this.currentMode = state.mode;
                }
                
                setTimeout(() => {
                    if (state.selectedLanguages && Array.isArray(state.selectedLanguages)) {
                        document.querySelectorAll('.learning-lang-checkbox').forEach(cb => {
                            cb.checked = state.selectedLanguages.includes(cb.value);
                        });
                    }
                    
                    if (state.options) {
                        if (typeof state.options.phonetics === 'boolean') {
                            const el = document.getElementById('option-phonetics');
                            if (el) el.checked = state.options.phonetics;
                        }
                        if (typeof state.options.words === 'boolean') {
                            const el = document.getElementById('option-words');
                            if (el) el.checked = state.options.words;
                        }
                        if (typeof state.options.letters === 'boolean') {
                            const el = document.getElementById('option-letters');
                            if (el) el.checked = state.options.letters;
                        }
                        if (typeof state.options.ambiguity === 'boolean') {
                            const el = document.getElementById('option-ambiguity');
                            if (el) el.checked = state.options.ambiguity;
                        }
                        if (typeof state.options.audio === 'boolean') {
                            const el = document.getElementById('option-audio');
                            if (el) el.checked = state.options.audio;
                        }
                    }
                    
                    if (state.selectedModel) {
                        const modelSelect = document.getElementById('ai-model-select');
                        if (modelSelect) {
                            modelSelect.value = state.selectedModel;
                        }
                    }
                    
                    if (state.translationMethod) {
                        this.translationMethod = state.translationMethod;
                        this.switchTranslationMethod(state.translationMethod);
                    }
                    
                    this.switchMode(this.currentMode);
                }, 100);
            }
        } catch (e) {
            console.error('Failed to load translation state:', e);
        }
    },
    
    saveState() {
        try {
            const selectedLanguages = Array.from(document.querySelectorAll('.learning-lang-checkbox:checked'))
                .map(cb => cb.value);
            
            const modelSelect = document.getElementById('ai-model-select');
            const selectedModel = modelSelect ? modelSelect.value : '0';
            
            const state = {
                mode: this.currentMode,
                selectedLanguages: selectedLanguages,
                selectedModel: selectedModel,
                translationMethod: this.translationMethod,
                options: {
                    phonetics: document.getElementById('option-phonetics')?.checked ?? true,
                    words: document.getElementById('option-words')?.checked ?? true,
                    letters: document.getElementById('option-letters')?.checked ?? true,
                    ambiguity: document.getElementById('option-ambiguity')?.checked ?? true,
                    audio: document.getElementById('option-audio')?.checked ?? true,
                }
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save translation state:', e);
        }
    },
    
    bindEvents() {
        setTimeout(() => {
            document.querySelectorAll('.learning-lang-checkbox').forEach(cb => {
                cb.addEventListener('change', () => this.saveState());
            });
            
            const modelSelect = document.getElementById('ai-model-select');
            if (modelSelect) {
                modelSelect.addEventListener('change', () => this.saveState());
            }
            
            ['option-phonetics', 'option-words', 'option-letters', 'option-ambiguity', 'option-audio'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', () => this.saveState());
            });
        }, 150);
    },
    
    switchMode(mode) {
        this.currentMode = mode;
        const tabs = document.querySelectorAll('.ittools-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const learningMode = document.getElementById('translation-learning-mode');
        const simpleMode = document.getElementById('translation-simple-mode');
        const ttsMode = document.getElementById('translation-tts-mode');
        
        if (mode === 'learning') {
            tabs[0].classList.add('active');
            learningMode.style.display = 'block';
            simpleMode.style.display = 'none';
            ttsMode.style.display = 'none';
        } else if (mode === 'simple') {
            tabs[1].classList.add('active');
            learningMode.style.display = 'none';
            simpleMode.style.display = 'block';
            ttsMode.style.display = 'none';
            
            setTimeout(() => {
                this.onSimpleProviderChange();
            }, 100);
        } else if (mode === 'tts') {
            tabs[2].classList.add('active');
            learningMode.style.display = 'none';
            simpleMode.style.display = 'none';
            ttsMode.style.display = 'block';
        }
        
        this.saveState();
    },
    
    async loadFreeModels(forSimple = false) {
        const modelSelect = forSimple 
            ? document.getElementById('simple-ai-model-select')
            : document.getElementById('ai-model-select');
            
        if (!modelSelect) {
            console.warn('Model select element not found:', forSimple ? 'simple' : 'learning');
            return;
        }
        
        const savedState = localStorage.getItem(this.storageKey);
        let savedModelIndex = '0';
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                savedModelIndex = state.selectedModel || '0';
            } catch (e) {
                console.error('Failed to parse saved state:', e);
            }
        }
        
        try {
            console.log('Loading models for:', forSimple ? 'simple' : 'learning');

            const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/models', {
                method: 'GET'
            });

            if (!response.ok) {
                console.error('Failed to load models:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Response body:', errorText);
                modelSelect.innerHTML = `<option value="0">Failed (${response.status})</option>`;
                return;
            }
            
            const result = await response.json();
            console.log('Models response:', result);
            
            if (result.success && result.models && result.models.length > 0) {
                const providerIcons = {
                    'deepseek': '🧠',
                    'gemini': '✨',
                    'openrouter': '🔀'
                };
                
                const providerLabels = {
                    'deepseek': 'DeepSeek',
                    'gemini': 'Gemini',
                    'openrouter': 'OpenRouter'
                };
                
                modelSelect.innerHTML = result.models.map((model, index) => {
                    const icon = providerIcons[model.provider] || '🤖';
                    const providerLabel = providerLabels[model.provider] || 'Unknown';
                    return `<option value="${index}">${icon} ${this.escapeHtml(model.name)} [${providerLabel}]</option>`;
                }).join('');
                
                if (savedModelIndex && modelSelect.options[savedModelIndex]) {
                    modelSelect.value = savedModelIndex;
                    console.log('Restored saved model selection:', savedModelIndex);
                } else {
                    modelSelect.value = '0';
                }
                
                this.freeModels = result.models;
                console.log('Loaded', result.models.length, 'models');
            } else {
                console.error('Invalid models response:', result);
                modelSelect.innerHTML = '<option value="0">No models available</option>';
            }
        } catch (error) {
            console.error('Failed to load free models:', error);
            modelSelect.innerHTML = '<option value="0">Error: ' + error.message + '</option>';
        }
    },
    
    switchTranslationMethod(method) {
        this.translationMethod = method;
        
        const tabs = document.querySelectorAll('[data-method]');
        tabs.forEach(tab => {
            if (tab.dataset.method === method) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        const aiPanel = document.getElementById('ai-method-panel');
        const googlePanel = document.getElementById('google-method-panel');
        
        if (method === 'ai') {
            aiPanel.style.display = 'block';
            googlePanel.style.display = 'none';
        } else {
            aiPanel.style.display = 'none';
            googlePanel.style.display = 'block';
        }
        
        this.saveState();
    },
    
    onSimpleProviderChange() {
        const provider = document.getElementById('simple-translation-provider');
        if (!provider) return;
        
        const providerValue = provider.value;
        const aiPanel = document.getElementById('simple-ai-model-panel');
        
        if (!aiPanel) return;
        
        if (providerValue === 'openrouter') {
            aiPanel.style.display = 'block';
            
            const simpleModelSelect = document.getElementById('simple-ai-model-select');
            if (simpleModelSelect.innerHTML.includes('Loading models')) {
                this.loadFreeModels(true);
            } else if (this.freeModels.length > 0) {
                simpleModelSelect.innerHTML = this.freeModels.map((model, index) => 
                    `<option value="${index}">${this.escapeHtml(model.name)}</option>`
                ).join('');
            }
        } else {
            aiPanel.style.display = 'none';
        }
    },
    
    async translate() {
        const sourceText = document.getElementById('translation-source').value.trim();
        const targetLang = document.getElementById('translation-target-lang').value;
        const provider = document.getElementById('simple-translation-provider').value;
        
        if (!sourceText) {
            ITTools.UI.showResult('translation-result', 'Please enter text to translate', false);
            return;
        }
        
        if (provider === 'gemini') {
            ITTools.UI.showResult('translation-result', 'Gemini AI provider is not implemented yet', false);
            return;
        }
        
        ITTools.UI.showLoading('translation-result', 'Translating...');
        document.getElementById('translation-output').style.display = 'none';
        
        try {
            if (provider === 'google') {
                await this.translateWithGoogle(sourceText, targetLang);
            } else if (provider === 'openrouter') {
                await this.translateWithOpenRouter(sourceText, targetLang);
            }
        } catch (error) {
            ITTools.UI.showResult('translation-result', 'Error: ' + error.message, false);
        }
    },
    
    async translateWithGoogle(sourceText, targetLang) {
        const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/simple/google', {
            method: 'POST',
            body: JSON.stringify({
                text: sourceText,
                target_language: targetLang
            })
        });

        const result = await response.json();
        
        if (result.success) {
            document.getElementById('translation-result-text').value = result.translated_text;
            document.getElementById('translation-output').style.display = 'block';
            document.getElementById('translation-result').style.display = 'none';
        } else {
            ITTools.UI.showResult('translation-result', result.error || 'Translation failed', false);
        }
    },
    
    async translateWithOpenRouter(sourceText, targetLang) {
        const modelSelect = document.getElementById('simple-ai-model-select');
        const modelIndex = modelSelect ? parseInt(modelSelect.value) : 0;
        const type = document.getElementById('translation-type').value;

        const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/translate', {
            method: 'POST',
            body: JSON.stringify({
                text: sourceText,
                target_language: targetLang,
                type: type,
                model: modelIndex
            })
        });

        const result = await response.json();
        
        if (result.success) {
            document.getElementById('translation-result-text').value = result.translated_text;
            document.getElementById('translation-output').style.display = 'block';
            document.getElementById('translation-result').style.display = 'none';
        } else {
            ITTools.UI.showResult('translation-result', result.error || 'Translation failed', false);
        }
    },
    
    async translateLearning() {
        const sourceText = document.getElementById('learning-source').value.trim();
        
        const translationMethod = this.translationMethod;
        
        const modelSelect = document.getElementById('ai-model-select');
        const modelIndex = modelSelect ? parseInt(modelSelect.value) : 0;
        
        const selectedLangs = Array.from(document.querySelectorAll('.learning-lang-checkbox:checked'))
            .map(cb => cb.value);
        
        const options = {
            show_phonetics: document.getElementById('option-phonetics').checked,
            show_words: document.getElementById('option-words').checked,
            show_letters: document.getElementById('option-letters').checked,
            show_ambiguity: document.getElementById('option-ambiguity').checked,
        };
        
        const generateAudio = document.getElementById('option-audio').checked;
        const skipCache = document.getElementById('option-skip-cache').checked;
        
        if (translationMethod === 'ai' && this.freeModels.length === 0) {
            ITTools.UI.showResult('learning-result', 'No AI model loaded', false);
            return;
        }
        
        if (!sourceText) {
            ITTools.UI.showResult('learning-result', 'Please enter text to learn', false);
            return;
        }
        
        if (selectedLangs.length === 0) {
            ITTools.UI.showResult('learning-result', 'Please select at least one target language', false);
            return;
        }
        
        ITTools.UI.showLoading('learning-result', 'Submitting task...');
        document.getElementById('learning-output').innerHTML = '';
        
        try {
            const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/learning', {
                method: 'POST',
                body: JSON.stringify({
                    text: sourceText,
                    target_languages: selectedLangs,
                    options: options,
                    model: modelIndex,
                    generate_audio: generateAudio,
                    translation_method: translationMethod,
                    skip_cache: skipCache
                })
            });

            const result = await response.json();
            
            if (result.success) {
                if (result.status === 'completed') {
                    this.renderLearningResults(result.result, selectedLangs, generateAudio);
                    ITTools.UI.showResult('learning-result', `✅ Completed${result.cached ? ' (cached)' : ''} - Processing time: ${result.processing_time}s`, true);
                } else if (result.status === 'pending') {
                    if (translationMethod === 'ai' && result.prompt) {
                        this.showAIPrompt(result.prompt, selectedLangs);
                    }
                    this.pollTaskStatus(result.task_id, selectedLangs, generateAudio, translationMethod);
                }
            } else {
                ITTools.UI.showResult('learning-result', result.error || 'Translation failed', false);
            }
        } catch (error) {
            ITTools.UI.showResult('learning-result', 'Error: ' + error.message, false);
        }
    },
    
    showAIPrompt(prompt, selectedLangs) {
        const outputDiv = document.getElementById('learning-output');
        const langsDisplay = selectedLangs.map(l => l.toUpperCase()).join(', ');
        const promptHtml = `
            <div class="ittools-card" style="margin-bottom: 15px; background: rgba(103,126,234,0.05);">
                <div class="ittools-card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    🤖 AI Prompt (${langsDisplay})
                </div>
                <div class="ittools-card-body">
                    <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f8f9fa; padding: 15px; border-radius: 6px; font-size: 12px; max-height: 400px; overflow-y: auto;">${this.escapeHtml(prompt)}</pre>
                </div>
            </div>
        `;
        
        outputDiv.innerHTML = promptHtml;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    pollTaskStatus(taskId, selectedLangs, generateAudio, translationMethod) {
        const startTime = Date.now();
        let pollCount = 0;
        
        const poll = async () => {
            pollCount++;
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            
            const methodIcon = translationMethod === 'google' ? '🌐' : '🤖';
            ITTools.UI.showLoading('learning-result', `${methodIcon} Processing... ⏱️ ${timeStr} (poll #${pollCount})`);
            
            try {
                const response = await AuthHelper.makeAuthenticatedRequest(`/api/app_qy_v1/ai_tools/translation/task/${taskId}`);
                const result = await response.json();
                
                if (!result.success) {
                    ITTools.UI.showResult('learning-result', result.error || 'Task not found', false);
                    return;
                }
                
                if (result.status === 'completed') {
                    this.renderLearningResults(result.result, selectedLangs, generateAudio);
                    ITTools.UI.showResult('learning-result', `✅ Completed${result.cached ? ' (cached)' : ''} - Total: ${result.processing_time}s (Elapsed: ${timeStr})`, true);
                } else if (result.status === 'failed') {
                    ITTools.UI.showResult('learning-result', `❌ Failed: ${result.error} (after ${timeStr})`, false);
                } else if (result.status === 'processing' || result.status === 'pending') {
                    if (result.status === 'pending' && pollCount === 1) {
                        this.triggerTaskProcessing();
                    }
                    
                    setTimeout(poll, 2000);
                } else {
                    ITTools.UI.showResult('learning-result', `Unknown status: ${result.status}`, false);
                }
            } catch (error) {
                ITTools.UI.showResult('learning-result', 'Polling error: ' + error.message, false);
            }
        };
        
        poll();
    },
    
    async triggerTaskProcessing() {
        try {
            await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/process-next', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Failed to trigger task processing:', error);
        }
    },
    
    parseWordsFromString(wordsStr) {
        const words = [];
        const parts = wordsStr.split(/[,，、;；]+/);
        
        console.log('[parseWordsFromString] Input:', wordsStr);
        console.log('[parseWordsFromString] Split parts:', parts);
        
        for (let part of parts) {
            part = part.trim();
            if (!part) continue;
            
            const match = part.match(/^(.+?)\s*[\[\(（「『【〔]\s*(.+?)\s*[\]\)）」』】〕]\s*$/);
            console.log('[parseWordsFromString] Part:', part, 'Match:', match);
            
            if (match) {
                words.push({
                    word: match[1].trim(),
                    phonetic: match[2].trim()
                });
            } else {
                words.push({
                    word: part,
                    phonetic: ''
                });
            }
        }
        
        console.log('[parseWordsFromString] Result:', words);
        return words;
    },
    
    parseLanguageFromRawResponse(rawResponse, langCode, langTemplates) {
        const lines = rawResponse.split('\n');
        const result = {
            language: langTemplates[langCode]?.name || langCode,
            lang_code: langCode,
            translation: null,
            words: [],
            compatibility_mode: null
        };
        
        const template = langTemplates[langCode];
        if (!template) {
            console.warn('[Parse] No template for language:', langCode);
            return result;
        }
        
        const transLabel = template.translation.split(':')[0].split('：')[0].trim();
        const wordsLabel = template.words.split(':')[0].split('：')[0].trim();
        
        const allLabels = Object.values(langTemplates).map(t => {
            const tLabel = t.translation ? t.translation.split(':')[0].split('：')[0].trim() : null;
            const wLabel = t.words ? t.words.split(':')[0].split('：')[0].trim() : null;
            return [tLabel, wLabel];
        }).flat().filter(Boolean);
        
        console.log('[Parse] Parsing', langCode, 'with labels:', { transLabel, wordsLabel });
        
        let i = 0;
        let wordsLineIndex = -1;
        
        while (i < lines.length) {
            const trimmedLine = lines[i].trim();
            
            if (!trimmedLine) {
                i++;
                continue;
            }
            
            if (trimmedLine.startsWith(transLabel)) {
                result.translation = trimmedLine.substring(transLabel.length).replace(/^[:：]\s*/, '').trim();
                console.log('[Parse] Found translation:', result.translation);
                i++;
                continue;
            }
            
            if (trimmedLine.startsWith(wordsLabel)) {
                wordsLineIndex = i;
                const firstLineContent = trimmedLine.substring(wordsLabel.length).replace(/^[:：]\s*/, '').trim();
                
                if (firstLineContent && firstLineContent.includes(',')) {
                    result.words = this.parseWordsFromString(firstLineContent);
                    result.compatibility_mode = 'single-line';
                    console.log('[Parse] Words format: single-line (comma-separated)');
                } else if (firstLineContent) {
                    result.words = this.parseWordsFromString(firstLineContent);
                    result.compatibility_mode = 'multi-line';
                    
                    let j = i + 1;
                    while (j < lines.length) {
                        const nextLine = lines[j].trim();
                        if (!nextLine) {
                            j++;
                            continue;
                        }
                        
                        const isLabel = allLabels.some(label => nextLine.startsWith(label));
                        if (isLabel) {
                            break;
                        }
                        
                        const wordMatch = nextLine.match(/^(.+?)\s*[\[\(（「『【〔]\s*(.+?)\s*[\]\)）」』】〕]\s*$/);
                        if (wordMatch) {
                            result.words.push({
                                word: wordMatch[1].trim(),
                                phonetic: wordMatch[2].trim()
                            });
                        } else {
                            result.words.push({
                                word: nextLine,
                                phonetic: ''
                            });
                        }
                        
                        j++;
                    }
                    
                    console.log('[Parse] Words format: multi-line (each word on new line)');
                    i = j;
                    continue;
                } else {
                    result.compatibility_mode = 'multi-line';
                    
                    let j = i + 1;
                    while (j < lines.length) {
                        const nextLine = lines[j].trim();
                        if (!nextLine) {
                            j++;
                            continue;
                        }
                        
                        const isLabel = allLabels.some(label => nextLine.startsWith(label));
                        if (isLabel) {
                            break;
                        }
                        
                        const wordMatch = nextLine.match(/^(.+?)\s*[\[\(（「『【〔]\s*(.+?)\s*[\]\)）」』】〕]\s*$/);
                        if (wordMatch) {
                            result.words.push({
                                word: wordMatch[1].trim(),
                                phonetic: wordMatch[2].trim()
                            });
                        } else {
                            result.words.push({
                                word: nextLine,
                                phonetic: ''
                            });
                        }
                        
                        j++;
                    }
                    
                    console.log('[Parse] Words format: multi-line (each word on new line)');
                    i = j;
                    continue;
                }
                
                console.log('[Parse] Found words:', result.words);
                i++;
                continue;
            }
            
            i++;
        }
        
        if (result.compatibility_mode) {
            console.log('[Parse] Compatibility mode:', result.compatibility_mode);
        }
        
        return result;
    },
    
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    renderLearningResults(result, selectedLangs, generateAudio) {
        const outputDiv = document.getElementById('learning-output');
        let html = '';
        
        const rawResponse = result.raw_response || '';
        
        result.translations.forEach((trans, idx) => {
            const langCode = selectedLangs[idx];
            
            const parsed = this.parseLanguageFromRawResponse(rawResponse, langCode, this.languageTemplates);
            trans = { ...trans, ...parsed };
            
            if (trans.error) {
                html += `
                    <div class="ittools-card" style="margin-bottom: 20px; background: rgba(255,107,107,0.05);">
                        <div class="ittools-card-header" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white;">
                            ❌ ${trans.language || 'Language ' + (idx + 1)} - Error
                        </div>
                        <div class="ittools-card-body">
                            <div style="padding: 10px; background: rgba(255,107,107,0.1); border-left: 4px solid #ff6b6b; border-radius: 6px; color: #d63031;">
                                ${this.escapeHtml(trans.error)}
                            </div>
                            ${trans.parse_note ? `<div style="margin-top: 10px; font-size: 12px; color: #666;">${this.escapeHtml(trans.parse_note)}</div>` : ''}
                            ${trans.raw_response ? `
                                <details style="margin-top: 10px;">
                                    <summary style="cursor: pointer; color: #666; font-size: 13px;">📄 Raw Response</summary>
                                    <pre style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;">${this.escapeHtml(trans.raw_response)}</pre>
                                </details>
                            ` : ''}
                        </div>
                    </div>
                `;
                return;
            }
            
            html += `
                <div class="ittools-card" style="margin-bottom: 20px; background: linear-gradient(135deg, rgba(103,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%);">
                    <div class="ittools-card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; justify-content: space-between; align-items: center;">
                        <span>${trans.language || 'Language ' + (idx + 1)}</span>
                        ${trans.compatibility_mode ? `<span style="font-size: 11px; opacity: 0.8; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;" title="Parse mode: ${trans.compatibility_mode === 'single-line' ? 'Words in one line (comma-separated)' : 'Words on separate lines'}">\u{1F4DD} ${trans.compatibility_mode === 'single-line' ? 'Single-line' : 'Multi-line'}</span>` : ''}
                    </div>
                    <div class="ittools-card-body">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea;">📝 Translation:</strong>
                            <div style="padding: 10px; background: white; border-radius: 6px; margin-top: 5px; font-size: 16px; line-height: 1.6; display: flex; justify-content: space-between; align-items: center;">
                                <span>${trans.translation || 'N/A'}</span>
                                ${generateAudio ? '<span class="audio-btn-container" data-text="' + (trans.translation || '') + '" data-lang="' + langCode + '" data-type="sentence"></span>' : ''}
                            </div>
                        </div>
                        
                        ${trans.words && trans.words.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea;">📝 Words Breakdown:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                                ${trans.words.map(w => `
                                    <div style="padding: 8px 12px; background: white; border: 2px solid #667eea; border-radius: 6px; display: inline-block;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <span style="font-weight: 600;">${this.escapeHtml(w.word)}</span>
                                            ${generateAudio ? '<span class="audio-btn-container" data-text="' + this.escapeHtml(w.word) + '" data-lang="' + langCode + '" data-type="word"></span>' : ''}
                                        </div>
                                        <div style="font-size: 12px; color: #666; font-family: monospace;">${this.escapeHtml(w.phonetic || '')}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${trans.letters && trans.letters.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea;">🔤 Letters & Pronunciation:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                                ${trans.letters.map(l => `
                                    <div style="padding: 6px 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 4px; text-align: center; min-width: 50px; position: relative;">
                                        <div style="font-size: 18px; font-weight: bold;">${l.letter}</div>
                                        <div style="font-size: 10px; font-family: monospace;">${l.phonetic || ''}</div>
                                        ${generateAudio ? '<div class="audio-btn-container" data-text="' + l.letter + '" data-lang="' + langCode + '" data-type="letter" style="position: absolute; top: 2px; right: 2px;"></div>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${trans.ambiguous_sentence ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #ff6b6b;">⚠️ Ambiguous Example:</strong>
                            <div style="padding: 10px; background: rgba(255,107,107,0.1); border-left: 4px solid #ff6b6b; border-radius: 6px; margin-top: 5px;">
                                ${trans.ambiguous_sentence}
                            </div>
                            ${trans.ambiguity_explanation ? `
                                <div style="padding: 8px; background: rgba(255,107,107,0.05); border-radius: 6px; margin-top: 5px; font-size: 13px; color: #666;">
                                    💡 ${trans.ambiguity_explanation}
                                </div>
                            ` : ''}
                        </div>
                        ` : ''}
                        
                        ${trans.parse_note ? `
                        <div style="margin-top: 10px; padding: 8px; background: rgba(255,193,7,0.1); border-left: 3px solid #ffc107; border-radius: 4px; font-size: 12px; color: #856404;">
                            ⚠️ ${this.escapeHtml(trans.parse_note)}
                            ${trans.debug_patterns ? `<br><small>Expected: ${this.escapeHtml(JSON.stringify(trans.debug_patterns))}</small>` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        if (result.raw_response) {
            html += `
                <div class="ittools-card" style="margin-bottom: 20px; background: rgba(108,117,125,0.05);">
                    <div class="ittools-card-header" style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white;">
                        🔍 Debug - Raw AI Response
                    </div>
                    <div class="ittools-card-body">
                        <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f8f9fa; padding: 15px; border-radius: 6px; font-size: 12px; max-height: 400px; overflow-y: auto; font-family: monospace;">${this.escapeHtml(result.raw_response)}</pre>
                    </div>
                </div>
            `;
        }
        
        outputDiv.innerHTML = html;
        
        if (generateAudio && typeof ITTools.TTS !== 'undefined') {
            setTimeout(() => {
                const containers = outputDiv.querySelectorAll('.audio-btn-container');
                containers.forEach(container => {
                    const text = container.getAttribute('data-text');
                    const lang = container.getAttribute('data-lang');
                    const type = container.getAttribute('data-type');
                    
                    if (text && lang && type) {
                        const btn = ITTools.TTS.createAudioButton(text, lang, type);
                        container.appendChild(btn);
                    }
                });
            }, 100);
        }
    },
    
    clear() {
        document.getElementById('translation-source').value = '';
        document.getElementById('translation-result-text').value = '';
        document.getElementById('translation-result').style.display = 'none';
        document.getElementById('translation-output').style.display = 'none';
    },
    
    clearLearning() {
        document.getElementById('learning-source').value = '';
        document.getElementById('learning-result').style.display = 'none';
        document.getElementById('learning-output').innerHTML = '';
    },
    
    swap() {
        const source = document.getElementById('translation-source').value;
        const result = document.getElementById('translation-result-text').value;
        
        if (result) {
            document.getElementById('translation-source').value = result;
            document.getElementById('translation-result-text').value = source;
        }
    },
    
    copyResult() {
        const resultText = document.getElementById('translation-result-text').value;
        if (resultText) {
            ITTools.UI.copyToClipboard(resultText);
        }
    },
    
    onTTSLanguageModeChange() {
        const mode = document.getElementById('tts-language-mode').value;
        const selectGroup = document.getElementById('tts-language-select-group');
        
        if (mode === 'manual') {
            selectGroup.style.display = 'block';
        } else {
            selectGroup.style.display = 'none';
        }
    },
    
    async generateTTS() {
        const text = document.getElementById('tts-source').value.trim();
        const languageMode = document.getElementById('tts-language-mode').value;
        const targetLang = document.getElementById('tts-target-lang').value;
        const speed = parseFloat(document.getElementById('tts-speed').value);
        
        if (!text) {
            ITTools.UI.showResult('tts-result', 'Please enter text to speak', false);
            return;
        }
        
        const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
        
        if (paragraphs.length === 0) {
            ITTools.UI.showResult('tts-result', 'No valid text found', false);
            return;
        }
        
        ITTools.UI.showLoading('tts-result', `Generating speech for ${paragraphs.length} paragraph(s)...`);
        document.getElementById('tts-output').innerHTML = '';
        
        try {
            const results = [];
            
            for (let i = 0; i < paragraphs.length; i++) {
                const paragraph = paragraphs[i];
                let language = targetLang;
                
                if (languageMode === 'detect') {
                    const detectResult = await this.detectLanguageForTTS(paragraph);
                    if (detectResult && detectResult.lang) {
                        language = detectResult.lang;
                    }
                }
                
                const result = await this.generateSingleTTS(paragraph, language, speed, i + 1);
                results.push(result);
            }
            
            document.getElementById('tts-result').style.display = 'none';
            this.displayTTSResults(results);
            
        } catch (error) {
            ITTools.UI.showResult('tts-result', 'Error: ' + error.message, false);
        }
    },
    
    async detectLanguageForTTS(text) {
        try {
            const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/translation/simple/google', {
                method: 'POST',
                body: JSON.stringify({
                    text: text.substring(0, 100),
                    target_language: 'en'
                })
            });

            const result = await response.json();
            
            if (result.success && result.src_lang) {
                let lang = result.src_lang.toLowerCase();
                if (lang.startsWith('zh-')) lang = 'zh';
                return { lang: lang };
            }
        } catch (error) {
            console.error('Language detection failed:', error);
        }
        
        return { lang: 'en' };
    },
    
    async generateSingleTTS(text, language, speed, index) {
        try {
            const rateValue = Math.round((speed - 1.0) * 100);
            const ratePercent = (rateValue >= 0 ? '+' : '') + rateValue + '%';
            
            const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/tts/generate', {
                method: 'POST',
                body: JSON.stringify({
                    text: text,
                    language: language,
                    type: 'sentence',
                    options: {
                        rate: ratePercent
                    }
                })
            });

            const result = await response.json();
            
            return {
                success: result.success,
                text: text,
                language: language,
                audioUrl: result.audio_url,
                error: result.error,
                index: index,
                fromCache: result.cached || result.from_cache
            };
        } catch (error) {
            return {
                success: false,
                text: text,
                language: language,
                error: error.message,
                index: index
            };
        }
    },
    
    displayTTSResults(results) {
        const output = document.getElementById('tts-output');
        
        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        
        results.forEach((result, idx) => {
            if (result.success) {
                html += `
                    <div class="ittools-card" style="background: linear-gradient(135deg, rgba(103,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%);">
                        <div class="ittools-card-header" style="background: linear-gradient(135deg, #677eea 0%, #764ba2 100%); color: white;">
                            🔊 Paragraph ${result.index} (${result.language.toUpperCase()}) ${result.fromCache ? '💾 Cached' : ''}
                        </div>
                        <div class="ittools-card-body">
                            <p style="margin-bottom: 15px; padding: 10px; background: rgba(248, 249, 250, 0.5); border-radius: 6px; line-height: 1.6;">
                                ${this.escapeHtml(result.text)}
                            </p>
                            <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                                <label style="font-size: 13px; font-weight: 600; color: #667eea;">Playback Speed:</label>
                                <select onchange="this.closest('.ittools-card-body').querySelector('audio').playbackRate = this.value" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd;">
                                    <option value="0.5">0.5x</option>
                                    <option value="0.6">0.6x</option>
                                    <option value="0.75">0.75x</option>
                                    <option value="1" selected>1.0x</option>
                                    <option value="1.25">1.25x</option>
                                    <option value="1.5">1.5x</option>
                                    <option value="1.75">1.75x</option>
                                    <option value="2">2.0x</option>
                                </select>
                            </div>
                            <audio controls style="width: 100%; border-radius: 6px;">
                                <source src="${result.audioUrl}" type="audio/mpeg">
                                Your browser does not support audio playback.
                            </audio>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="ittools-card" style="background: rgba(255,107,107,0.05);">
                        <div class="ittools-card-header" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white;">
                            ❌ Paragraph ${result.index} - Error
                        </div>
                        <div class="ittools-card-body">
                            <p style="margin-bottom: 10px;">${this.escapeHtml(result.text.substring(0, 100))}...</p>
                            <div style="padding: 10px; background: rgba(255,107,107,0.1); border-left: 4px solid #ff6b6b; border-radius: 6px; color: #d63031;">
                                ${this.escapeHtml(result.error)}
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        output.innerHTML = html;
    },
    
    clearTTS() {
        document.getElementById('tts-source').value = '';
        document.getElementById('tts-output').innerHTML = '';
        document.getElementById('tts-result').style.display = 'none';
        document.getElementById('tts-speed').value = '0.9';
        document.getElementById('tts-speed-value').textContent = '0.9';
        document.getElementById('tts-language-mode').value = 'detect';
        this.onTTSLanguageModeChange();
    }
};

if (!ITTools.TTS) {
    ITTools.TTS = {
        cache: {},
        
        createAudioButton(text, lang, type) {
            const btn = document.createElement('button');
            btn.className = 'audio-play-btn';
            btn.innerHTML = '🔊';
            btn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 5px; opacity: 0.6; transition: opacity 0.2s;';
            btn.title = 'Play audio';
            
            btn.addEventListener('mouseenter', () => {
                btn.style.opacity = '1';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.opacity = '0.6';
            });
            
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '⏳';
                btn.disabled = true;
                
                try {
                    const cacheKey = `${lang}_${type}_${text}`;
                    let audioUrl = this.cache[cacheKey];
                    
                    if (!audioUrl) {
                        const response = await AuthHelper.makeAuthenticatedRequest('/api/app_qy_v1/ai_tools/tts/generate', {
                            method: 'POST',
                            body: JSON.stringify({
                                text: text,
                                language: lang,
                                type: type,
                                options: {}
                            })
                        });

                        const result = await response.json();
                        
                        if (result.success) {
                            audioUrl = result.audio_url;
                            this.cache[cacheKey] = audioUrl;
                        } else {
                            throw new Error(result.error || 'TTS generation failed');
                        }
                    }
                    
                    const audio = new Audio(audioUrl);
                    audio.play();
                    
                    btn.innerHTML = '▶️';
                    
                    audio.addEventListener('ended', () => {
                        btn.innerHTML = originalHtml;
                    });
                    
                } catch (error) {
                    console.error('[TTS] Error:', error);
                    alert('Failed to generate audio: ' + error.message);
                    btn.innerHTML = originalHtml;
                } finally {
                    btn.disabled = false;
                }
            });
            
            return btn;
        }
    };
}

console.log('ITTools Translation implementation loaded');
