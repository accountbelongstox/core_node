ITTools.TTS = {
    audioCache: {},
    pollingIntervals: {},
    pendingAudio: new Set(),
    
    async generateAudio(text, language, type = 'sentence') {
        const cacheKey = this.getCacheKey(text, language, type);
        
        if (this.audioCache[cacheKey]) {
            return this.audioCache[cacheKey];
        }
        
        try {
            const response = await fetch('/tts/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    language: language,
                    type: type,
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.audioCache[cacheKey] = result;
                
                if (!result.cached) {
                    this.pendingAudio.add(result.audio_path);
                    this.startPolling(result.audio_path);
                }
                
                return result;
            } else {
                console.error('[TTS] Generation failed:', result.error);
                return null;
            }
        } catch (error) {
            console.error('[TTS] Error:', error);
            return null;
        }
    },
    
    async batchGenerate(items) {
        try {
            const response = await fetch('/tts/batch-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ items: items })
            });
            
            const data = await response.json();
            
            if (data.success && data.results) {
                data.results.forEach(result => {
                    if (result.success) {
                        const cacheKey = this.getCacheKey(result.text, result.language, result.type);
                        this.audioCache[cacheKey] = result;
                        
                        if (!result.cached) {
                            this.pendingAudio.add(result.audio_path);
                            this.startPolling(result.audio_path);
                        }
                    }
                });
                
                return data.results;
            }
        } catch (error) {
            console.error('[TTS] Batch generation error:', error);
        }
        
        return [];
    },
    
    startPolling(audioPath) {
        if (this.pollingIntervals[audioPath]) {
            return;
        }
        
        const pollInterval = setInterval(async () => {
            const result = await this.checkGeneration(audioPath);
            
            if (result && result.ready) {
                this.pendingAudio.delete(audioPath);
                clearInterval(this.pollingIntervals[audioPath]);
                delete this.pollingIntervals[audioPath];
                
                this.triggerAudioReady(audioPath);
            }
        }, 1000);
        
        this.pollingIntervals[audioPath] = pollInterval;
        
        setTimeout(() => {
            if (this.pollingIntervals[audioPath]) {
                clearInterval(this.pollingIntervals[audioPath]);
                delete this.pollingIntervals[audioPath];
                this.pendingAudio.delete(audioPath);
                console.warn('[TTS] Polling timeout for:', audioPath);
            }
        }, 30000);
    },
    
    async checkGeneration(audioPath) {
        try {
            const response = await fetch('/tts/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ audio_path: audioPath })
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[TTS] Check error:', error);
            return null;
        }
    },
    
    triggerAudioReady(audioPath) {
        const event = new CustomEvent('tts-audio-ready', {
            detail: { audioPath: audioPath }
        });
        document.dispatchEvent(event);
        console.log('[TTS] Audio ready:', audioPath);
    },
    
    getCacheKey(text, language, type) {
        return `${language}:${type}:${text}`;
    },
    
    playAudio(text, language, type = 'sentence') {
        const cacheKey = this.getCacheKey(text, language, type);
        const cached = this.audioCache[cacheKey];
        
        if (cached && cached.audio_url) {
            const audio = new Audio(cached.audio_url);
            audio.play().catch(err => {
                console.error('[TTS] Playback error:', err);
            });
        } else {
            this.generateAudio(text, language, type).then(result => {
                if (result && result.audio_url) {
                    const audio = new Audio(result.audio_url);
                    audio.play().catch(err => {
                        console.error('[TTS] Playback error:', err);
                    });
                }
            });
        }
    },
    
    createAudioButton(text, language, type = 'sentence') {
        const cacheKey = this.getCacheKey(text, language, type);
        const button = document.createElement('button');
        button.className = 'ittools-audio-btn';
        button.innerHTML = '🔊';
        button.title = 'Play audio';
        button.style.cssText = 'border: none; background: transparent; cursor: pointer; font-size: 18px; padding: 2px 5px; transition: transform 0.2s;';
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.2)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.playAudio(text, language, type);
        });
        
        const cached = this.audioCache[cacheKey];
        if (cached && !cached.cached) {
            button.style.opacity = '0.5';
            button.title = 'Generating audio...';
            
            const checkReady = () => {
                const updated = this.audioCache[cacheKey];
                if (updated && updated.cached) {
                    button.style.opacity = '1';
                    button.title = 'Play audio';
                } else if (!this.pendingAudio.has(updated?.audio_path)) {
                    button.style.opacity = '1';
                    button.title = 'Play audio';
                }
            };
            
            document.addEventListener('tts-audio-ready', (event) => {
                if (event.detail.audioPath === cached.audio_path) {
                    checkReady();
                }
            });
            
            setTimeout(checkReady, 2000);
        }
        
        return button;
    },
    
    stopAllPolling() {
        Object.keys(this.pollingIntervals).forEach(audioPath => {
            clearInterval(this.pollingIntervals[audioPath]);
            delete this.pollingIntervals[audioPath];
        });
        this.pendingAudio.clear();
    }
};

window.addEventListener('beforeunload', () => {
    ITTools.TTS.stopAllPolling();
});

console.log('ITTools TTS Helper loaded');
