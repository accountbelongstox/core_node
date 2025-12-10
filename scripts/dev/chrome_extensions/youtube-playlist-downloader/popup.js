(function() {
    'use strict';

    const playlistUrlInput = document.getElementById('playlist-url-input');
    const formatSelect = document.getElementById('format-select');
    const qualitySelect = document.getElementById('quality-select');
    const submitUrlBtn = document.getElementById('submit-url-btn');
    const startDownloadBtn = document.getElementById('start-download-btn');
    const stopDownloadBtn = document.getElementById('stop-download-btn');
    const statusDiv = document.getElementById('status');

    function updateStatus(message) {
        statusDiv.textContent = message;
    }

    function setButtonsEnabled(enabled) {
        submitUrlBtn.disabled = !enabled;
        startDownloadBtn.disabled = !enabled;
    }

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    async function ensureYtMultiDownloaderTab() {
        const targetUrl = 'https://ytmultidownloader.com/';
        
        // Search for existing tab with ytmultidownloader.com
        const tabs = await chrome.tabs.query({ url: 'https://ytmultidownloader.com/*' });
        
        let targetTab = null;
        
        if (tabs.length > 0) {
            // Switch to existing tab
            targetTab = tabs[0];
            await chrome.tabs.update(targetTab.id, { active: true });
            updateStatus('Switched to ytmultidownloader.com');
            
            // Check if page is already loaded
            const tab = await chrome.tabs.get(targetTab.id);
            if (tab.status === 'complete') {
                // Wait for content script to be ready
                await new Promise(resolve => setTimeout(resolve, 1500));
                return targetTab;
            }
        } else {
            // Create new tab
            targetTab = await chrome.tabs.create({ url: targetUrl, active: true });
            updateStatus('Opening ytmultidownloader.com...');
        }
        
        // Wait for page to load completely
        return new Promise((resolve) => {
            const listener = (tabId, changeInfo) => {
                if (tabId === targetTab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    // Additional wait for content script to be ready
                    setTimeout(() => {
                        resolve(targetTab);
                    }, 1500);
                }
            };
            
            chrome.tabs.onUpdated.addListener(listener);
            
            // Fallback timeout
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(targetTab);
            }, 10000);
        });
    }

    async function sendMessageToContentScript(action, data = {}) {
        let tab = await getCurrentTab();
        
        // If current tab is not ytmultidownloader.com, ensure we have the right tab
        if (!tab || !tab.url || !tab.url.includes('ytmultidownloader.com')) {
            tab = await ensureYtMultiDownloaderTab();
        }

        try {
            return await chrome.tabs.sendMessage(tab.id, { action, ...data });
        } catch (error) {
            // If message fails, content script might not be ready yet
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                return await chrome.tabs.sendMessage(tab.id, { action, ...data });
            } catch (retryError) {
                updateStatus('Error: ' + retryError.message);
                return null;
            }
        }
    }

    submitUrlBtn.addEventListener('click', async () => {
        const playlistUrl = playlistUrlInput.value.trim();
        
        if (!playlistUrl) {
            updateStatus('Please enter a playlist URL');
            return;
        }

        if (!playlistUrl.includes('youtube.com/playlist')) {
            updateStatus('Invalid playlist URL');
            return;
        }

        setButtonsEnabled(false);
        updateStatus('Switching to ytmultidownloader.com...');

        // Ensure we're on the right page first
        await ensureYtMultiDownloaderTab();
        
        updateStatus('Submitting playlist...');

        const response = await sendMessageToContentScript('submitPlaylist', {
            playlistUrl: playlistUrl
        });

        if (response && response.success) {
            updateStatus(`Loaded ${response.videoCount} videos`);
        } else {
            updateStatus(response?.error || 'Failed to submit playlist');
        }

        setButtonsEnabled(true);
    });

    startDownloadBtn.addEventListener('click', async () => {
        const format = formatSelect.value;
        const quality = qualitySelect.value;

        setButtonsEnabled(false);
        updateStatus('Starting download...');

        const response = await sendMessageToContentScript('startDownload', {
            format: format,
            quality: quality
        });

        if (response && response.success) {
            updateStatus('Download started');
            startStatusPolling();
        } else {
            updateStatus(response?.error || 'Failed to start download');
            setButtonsEnabled(true);
        }
    });

    stopDownloadBtn.addEventListener('click', async () => {
        const response = await sendMessageToContentScript('stopDownload');
        if (response && response.success) {
            updateStatus('Download stopped');
            setButtonsEnabled(true);
        }
    });

    async function startStatusPolling() {
        const interval = setInterval(async () => {
            const response = await sendMessageToContentScript('getStatus');
            if (response) {
                if (response.isProcessing) {
                    const progress = response.totalVideos > 0 
                        ? `${response.processedCount}/${response.totalVideos}`
                        : 'Processing...';
                    updateStatus(`Downloading... ${progress}`);
                } else {
                    clearInterval(interval);
                    updateStatus('Download completed');
                    setButtonsEnabled(true);
                }
            } else {
                clearInterval(interval);
                setButtonsEnabled(true);
            }
        }, 1000);
    }

    chrome.storage.local.get(['playlistUrl', 'format', 'quality'], (result) => {
        if (result.playlistUrl) {
            playlistUrlInput.value = result.playlistUrl;
        }
        if (result.format) {
            formatSelect.value = result.format;
        }
        if (result.quality) {
            qualitySelect.value = result.quality;
        }
    });

    playlistUrlInput.addEventListener('change', () => {
        chrome.storage.local.set({ playlistUrl: playlistUrlInput.value });
    });

    formatSelect.addEventListener('change', () => {
        chrome.storage.local.set({ format: formatSelect.value });
    });

    qualitySelect.addEventListener('change', () => {
        chrome.storage.local.set({ quality: qualitySelect.value });
    });

    updateStatus('Ready');
})();

