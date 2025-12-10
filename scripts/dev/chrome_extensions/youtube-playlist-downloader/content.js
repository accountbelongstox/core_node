(function() {
    'use strict';

    const CONFIG = {
        playlistUrl: '',
        format: 'Video-only (fastest)⚡',
        quality: '1080p',
        delayBetweenLoads: 2000,
        delayBetweenDownloads: 5000
    };

    let currentVideoIndex = 0;
    let videoList = [];
    let isProcessing = false;

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function sanitizeFileName(fileName) {
        return fileName
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 200);
    }

    async function submitPlaylistUrl(playlistUrl) {
        console.log('[Auto Downloader] Step 1: Submitting playlist URL');
        
        const urlInput = await waitForElement('input[type="url"]');
        const submitButton = await waitForElement('form button[type="submit"]');
        
        urlInput.value = playlistUrl;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        await delay(500);
        submitButton.click();
        
        console.log('[Auto Downloader] Playlist URL submitted, waiting for video list to load...');
        
        await waitForElement('div[class*="divide-y"]', 30000);
        await delay(3000);
        
        console.log('[Auto Downloader] Video list loaded');
    }

    function collectVideoElements() {
        console.log('[Auto Downloader] Step 2: Collecting video elements');
        
        const videoContainers = document.querySelectorAll('div.divide-y > div.p-6.hover\\:bg-slate-50\\/50');
        videoList = Array.from(videoContainers).map((container, index) => {
            const titleElement = container.querySelector('h3.text-lg.font-semibold.text-slate-800');
            const title = titleElement ? titleElement.textContent.trim() : `Video_${index + 1}`;
            
            return {
                index: index,
                container: container,
                title: title,
                processed: false
            };
        });
        
        console.log(`[Auto Downloader] Found ${videoList.length} videos`);
        return videoList;
    }

    async function loadVideoOptions(video) {
        console.log(`[Auto Downloader] Loading options for video ${video.index + 1}/${videoList.length}: ${video.title}`);
        
        video.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(1000);
        
        const buttons = video.container.querySelectorAll('button');
        let loadButton = null;
        for (const btn of buttons) {
            if (btn.textContent.trim() === 'Load Options') {
                loadButton = btn;
                break;
            }
        }
        
        if (!loadButton) {
            const radiogroup = video.container.querySelector('div[role="radiogroup"]');
            if (radiogroup) {
                console.log(`[Auto Downloader] Options for video ${video.index + 1} already loaded`);
                return true;
            }
            return false;
        }
        
        loadButton.click();
        console.log(`[Auto Downloader] Clicked Load Options for video ${video.index + 1}`);
        
        try {
            await waitForElement('div[role="radiogroup"]', 15000);
            await delay(1000);
        } catch (e) {
            console.log(`[Auto Downloader] Failed to load options for video ${video.index + 1}`);
            return false;
        }
        
        const formatButtonsList = video.container.querySelectorAll('div[class*="inline-flex"] button');
        if (formatButtonsList.length > 0) {
            for (const btn of formatButtonsList) {
                if (btn.textContent.includes(CONFIG.format)) {
                    btn.click();
                    await delay(500);
                    break;
                }
            }
        }
        
        await delay(1000);
        return true;
    }

    async function waitForDownloadToStart() {
        return new Promise((resolve) => {
            const checkDownloads = async () => {
                try {
                    const downloads = await chrome.downloads.search({ state: 'in_progress' });
                    if (downloads.length > 0) {
                        console.log(`[Auto Downloader] Download started, waiting for completion...`);
                        const downloadId = downloads[0].id;
                        
                        const listener = (downloadDelta) => {
                            if (downloadDelta.id === downloadId) {
                                if (downloadDelta.state && downloadDelta.state.current === 'complete') {
                                    chrome.downloads.onChanged.removeListener(listener);
                                    console.log(`[Auto Downloader] Download completed`);
                                    resolve();
                                } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
                                    chrome.downloads.onChanged.removeListener(listener);
                                    console.log(`[Auto Downloader] Download interrupted`);
                                    resolve();
                                }
                            }
                        };
                        
                        chrome.downloads.onChanged.addListener(listener);
                        
                        setTimeout(() => {
                            chrome.downloads.onChanged.removeListener(listener);
                            resolve();
                        }, 300000);
                    } else {
                        setTimeout(checkDownloads, 500);
                    }
                } catch (error) {
                    console.log('[Auto Downloader] Cannot check download status, using timeout...');
                    setTimeout(resolve, CONFIG.delayBetweenDownloads);
                }
            };
            setTimeout(checkDownloads, 1000);
        });
    }

    async function selectQualityAndDownload(video) {
        console.log(`[Auto Downloader] Selecting quality and downloading: ${video.title}`);
        
        const radiogroup = video.container.querySelector('div[role="radiogroup"]');
        if (!radiogroup) {
            console.log(`[Auto Downloader] No quality options found (radiogroup not found)`);
            return false;
        }
        
        const qualityCards = radiogroup.querySelectorAll('div.rounded-xl.border.bg-white.shadow-sm');
        if (qualityCards.length === 0) {
            console.log(`[Auto Downloader] No quality options found`);
            return false;
        }
        
        let selectedCard = null;
        for (const card of qualityCards) {
            const radio = card.querySelector('div[role="radio"]');
            if (radio && radio.getAttribute('aria-checked') === 'true') {
                selectedCard = card;
                break;
            }
        }
        
        if (!selectedCard) {
            selectedCard = qualityCards[0];
            console.log(`[Auto Downloader] No pre-selected option, using first card`);
        }
        
        const videoTitle = video.title;
        const sanitizedTitle = sanitizeFileName(videoTitle);
        
        const downloadButton = selectedCard.querySelector('button[title="Quick download"]');
        if (!downloadButton) {
            console.log(`[Auto Downloader] Download button not found in selected card`);
            return false;
        }
        
        downloadButton.click();
        console.log(`[Auto Downloader] Clicked download button for: ${videoTitle} (will save as: ${sanitizedTitle}.mp4)`);
        
        await waitForDownloadToStart();
        
        console.log(`[Auto Downloader] Download completed for: ${videoTitle}`);
        return true;
    }

    async function processVideos() {
        if (isProcessing) {
            console.log('[Auto Downloader] Already processing, please wait...');
            return;
        }
        
        isProcessing = true;
        console.log('[Auto Downloader] Starting to process video list');
        
        try {
            if (videoList.length === 0) {
                collectVideoElements();
            }
            
            for (let i = currentVideoIndex; i < videoList.length; i++) {
                if (!isProcessing) {
                    console.log('[Auto Downloader] Processing stopped by user');
                    break;
                }
                
                const video = videoList[i];
                currentVideoIndex = i;
                
                console.log(`\n[Auto Downloader] ===== Processing video ${i + 1}/${videoList.length} =====`);
                
                const loaded = await loadVideoOptions(video);
                if (!loaded) {
                    console.log(`[Auto Downloader] Skipping video ${i + 1}, continuing to next`);
                    continue;
                }
                
                const downloaded = await selectQualityAndDownload(video);
                if (!downloaded) {
                    console.log(`[Auto Downloader] Failed to download video ${i + 1}, continuing to next`);
                    continue;
                }
                
                video.processed = true;
                await delay(CONFIG.delayBetweenDownloads);
            }
            
            console.log('\n[Auto Downloader] ===== All videos processed =====');
        } catch (error) {
            console.error('[Auto Downloader] Error during processing:', error);
        } finally {
            isProcessing = false;
        }
    }

    function stopProcessing() {
        isProcessing = false;
        console.log('[Auto Downloader] Processing stopped');
    }

    function updateConfig(config) {
        Object.assign(CONFIG, config);
        console.log('[Auto Downloader] Config updated:', CONFIG);
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'submitPlaylist') {
            submitPlaylistUrl(request.playlistUrl).then(() => {
                collectVideoElements();
                sendResponse({ success: true, videoCount: videoList.length });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        }
        
        if (request.action === 'startDownload') {
            updateConfig({
                format: request.format,
                quality: request.quality,
                delayBetweenLoads: request.delayBetweenLoads || CONFIG.delayBetweenLoads,
                delayBetweenDownloads: request.delayBetweenDownloads || CONFIG.delayBetweenDownloads
            });
            processVideos().then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        }
        
        if (request.action === 'stopDownload') {
            stopProcessing();
            sendResponse({ success: true });
        }
        
        if (request.action === 'getStatus') {
            sendResponse({
                isProcessing: isProcessing,
                currentIndex: currentVideoIndex,
                totalVideos: videoList.length,
                processedCount: videoList.filter(v => v.processed).length
            });
        }
    });

    function init() {
        console.log('[Auto Downloader] Script loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
