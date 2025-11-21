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
                    <div class="ittools-form-group">
                        <label class="ittools-label">Passcode (Required):</label>
                        <input type="password" id="translation-passcode" class="ittools-input" placeholder="Enter passcode" value="12345678">
                    </div>
                    
                    <div class="ittools-tabs" style="margin-bottom: 20px;">
                        <button class="ittools-tab active" onclick="ITTools.Implementations.Translation.switchMode('learning')">Language Learning</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.Translation.switchMode('simple')">Simple Translation</button>
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
                            <label class="ittools-label">AI Model:</label>
                            <select id="translation-model" class="ittools-select">
                                <option value="free">Free (DeepSeek R1T2 Chimera)</option>
                            </select>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">* TODO: Simple translation - use learning mode for now</div>
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
    
    init() {
        this.loadState();
        this.bindEvents();
        this.loadFreeModels();
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
        
        if (mode === 'learning') {
            tabs[0].classList.add('active');
            document.getElementById('translation-learning-mode').style.display = 'block';
            document.getElementById('translation-simple-mode').style.display = 'none';
        } else {
            tabs[1].classList.add('active');
            document.getElementById('translation-learning-mode').style.display = 'none';
            document.getElementById('translation-simple-mode').style.display = 'block';
        }
        
        this.saveState();
    },
    
    async loadFreeModels() {
        try {
            const response = await fetch('/translation/models', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (result.success && result.models && result.models.length > 0) {
                const modelSelect = document.getElementById('ai-model-select');
                if (modelSelect) {
                    const savedIndex = modelSelect.value;
                    
                    modelSelect.innerHTML = result.models.map((model, index) => 
                        `<option value="${index}">${this.escapeHtml(model.name)}</option>`
                    ).join('');
                    
                    if (savedIndex && modelSelect.options[savedIndex]) {
                        modelSelect.value = savedIndex;
                    } else {
                        modelSelect.value = '0';
                    }
                    
                    this.freeModels = result.models;
                }
            }
        } catch (error) {
            console.error('Failed to load free models:', error);
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
    
    async translate() {
        const passcode = document.getElementById('translation-passcode').value.trim();
        const sourceText = document.getElementById('translation-source').value.trim();
        const targetLang = document.getElementById('translation-target-lang').value;
        const type = document.getElementById('translation-type').value;
        const model = document.getElementById('translation-model').value;
        
        if (!passcode) {
            ITTools.UI.showResult('translation-result', 'Please enter passcode', false);
            return;
        }
        
        if (!sourceText) {
            ITTools.UI.showResult('translation-result', 'Please enter text to translate', false);
            return;
        }
        
        ITTools.UI.showLoading('translation-result', 'Translating...');
        document.getElementById('translation-output').style.display = 'none';
        
        try {
            const response = await fetch('/translation/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Translation-Passcode': passcode,
                },
                body: JSON.stringify({
                    text: sourceText,
                    target_language: targetLang,
                    type: type,
                    model: model,
                    passcode: passcode,
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
        } catch (error) {
            ITTools.UI.showResult('translation-result', 'Error: ' + error.message, false);
        }
    },
    
    async translateLearning() {
        const passcode = document.getElementById('translation-passcode').value.trim();
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
        
        if (!passcode) {
            ITTools.UI.showResult('learning-result', 'Please enter passcode', false);
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
            const response = await fetch('/translation/learning', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Translation-Passcode': passcode,
                },
                body: JSON.stringify({
                    text: sourceText,
                    target_languages: selectedLangs,
                    options: options,
                    model: modelIndex,
                    passcode: passcode,
                    generate_audio: generateAudio,
                    translation_method: translationMethod,
                    skip_cache: skipCache,
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                if (result.status === 'completed') {
                    this.renderLearningResults(result.result, selectedLangs, generateAudio);
                    ITTools.UI.showResult('learning-result', `✅ Completed${result.cached ? ' (cached)' : ''} - Processing time: ${result.processing_time}s`, true);
                } else if (result.status === 'pending') {
                    if (translationMethod === 'ai' && result.prompts) {
                        this.showAIPrompts(result.prompts, selectedLangs);
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
    
    showAIPrompts(prompts, selectedLangs) {
        const outputDiv = document.getElementById('learning-output');
        const promptsHtml = selectedLangs.map(langCode => {
            const prompt = prompts[langCode];
            if (!prompt) return '';
            return `
                <div class="ittools-card" style="margin-bottom: 15px; background: rgba(103,126,234,0.05);">
                    <div class="ittools-card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        🤖 AI Prompt for ${langCode.toUpperCase()}
                    </div>
                    <div class="ittools-card-body">
                        <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f8f9fa; padding: 15px; border-radius: 6px; font-size: 12px; max-height: 300px; overflow-y: auto;">${this.escapeHtml(prompt)}</pre>
                    </div>
                </div>
            `;
        }).join('');
        
        outputDiv.innerHTML = promptsHtml;
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
                const response = await fetch(`/translation/task/${taskId}`);
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
            await fetch('/translation/process-next', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
        } catch (error) {
            console.error('Failed to trigger task processing:', error);
        }
    },
    
    renderLearningResults(result, selectedLangs, generateAudio) {
        const outputDiv = document.getElementById('learning-output');
        let html = '';
        
        result.translations.forEach((trans, idx) => {
            const langCode = selectedLangs[idx];
            
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
                        </div>
                    </div>
                `;
                return;
            }
            
            html += `
                <div class="ittools-card" style="margin-bottom: 20px; background: linear-gradient(135deg, rgba(103,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%);">
                    <div class="ittools-card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        ${trans.language || 'Language ' + (idx + 1)}
                    </div>
                    <div class="ittools-card-body">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea;">📝 Translation:</strong>
                            <div style="padding: 10px; background: white; border-radius: 6px; margin-top: 5px; font-size: 16px; line-height: 1.6; display: flex; justify-content: space-between; align-items: center;">
                                <span>${trans.translation || 'N/A'}</span>
                                ${generateAudio ? '<span class="audio-btn-container" data-text="' + (trans.translation || '') + '" data-lang="' + langCode + '" data-type="sentence"></span>' : ''}
                            </div>
                        </div>
                        
                        ${trans.phonetics ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea;">📢 Phonetics:</strong>
                            <div style="padding: 10px; background: rgba(103,126,234,0.1); border-radius: 6px; margin-top: 5px; font-family: monospace;">
                                ${trans.phonetics}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${trans.words && trans.words.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea;">📝 Words Breakdown:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                                ${trans.words.map(w => `
                                    <div style="padding: 8px 12px; background: white; border: 2px solid #667eea; border-radius: 6px; display: inline-block;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <span style="font-weight: 600;">${w.word}</span>
                                            ${generateAudio ? '<span class="audio-btn-container" data-text="' + w.word + '" data-lang="' + langCode + '" data-type="word"></span>' : ''}
                                        </div>
                                        <div style="font-size: 12px; color: #666; font-family: monospace;">${w.phonetic || ''}</div>
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
                    </div>
                </div>
            `;
        });
        
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
    }
};

console.log('ITTools Translation implementation loaded');
