// ==UserScript==
// @name         YouTube Playlist Auto Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically download videos from YouTube playlists, load options one by one, download and rename
// @author       You
// @match        https://ytmultidownloader.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

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
        
        await delay(CONFIG.delayBetweenDownloads);
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

    function createControlPanel() {
        if (document.getElementById('auto-downloader-panel')) {
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'auto-downloader-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 2px solid #3B82F6;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            min-width: 300px;
            font-family: Arial, sans-serif;
        `;
        
        panel.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #3B82F6;">YouTube Auto Downloader</h3>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Playlist URL:</label>
                <input type="text" id="playlist-url-input" placeholder="https://www.youtube.com/playlist?list=..." style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Format:</label>
                <select id="format-select" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="Video-only (fastest)⚡" ${CONFIG.format === 'Video-only (fastest)⚡' ? 'selected' : ''}>Video-only (fastest)⚡</option>
                    <option value="Audio-only" ${CONFIG.format === 'Audio-only' ? 'selected' : ''}>Audio-only</option>
                    <option value="Muxed" ${CONFIG.format === 'Muxed' ? 'selected' : ''}>Muxed</option>
                    <option value="Auto Mix (Video + Audio)" ${CONFIG.format === 'Auto Mix (Video + Audio)' ? 'selected' : ''}>Auto Mix (Video + Audio)</option>
                    <option value="Custom Mix" ${CONFIG.format === 'Custom Mix' ? 'selected' : ''}>Custom Mix</option>
                </select>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Quality:</label>
                <select id="quality-select" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="1080p" ${CONFIG.quality === '1080p' ? 'selected' : ''}>1080p</option>
                    <option value="720p" ${CONFIG.quality === '720p' ? 'selected' : ''}>720p</option>
                    <option value="360p" ${CONFIG.quality === '360p' ? 'selected' : ''}>360p</option>
                    <option value="144p" ${CONFIG.quality === '144p' ? 'selected' : ''}>144p</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <button id="submit-url-btn" style="width: 100%; padding: 10px; background: #3B82F6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 5px;">1. Submit Playlist</button>
                <button id="start-download-btn" style="width: 100%; padding: 10px; background: #10B981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 5px;">2. Start Auto Download</button>
                <button id="stop-download-btn" style="width: 100%; padding: 10px; background: #EF4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Stop Download</button>
            </div>
            <div id="status" style="padding: 10px; background: #F3F4F6; border-radius: 4px; font-size: 12px; color: #6B7280;">
                Ready
            </div>
        `;
        
        document.body.appendChild(panel);
        
        document.getElementById('submit-url-btn').addEventListener('click', async () => {
            const playlistUrl = document.getElementById('playlist-url-input').value.trim();
            
            if (!playlistUrl) {
                document.getElementById('status').textContent = 'Please enter a playlist URL';
                return;
            }
            
            if (!playlistUrl.includes('youtube.com/playlist')) {
                document.getElementById('status').textContent = 'Invalid playlist URL';
                return;
            }
            
            CONFIG.playlistUrl = playlistUrl;
            document.getElementById('status').textContent = 'Submitting playlist...';
            await submitPlaylistUrl(playlistUrl);
            collectVideoElements();
            document.getElementById('status').textContent = `Loaded ${videoList.length} videos`;
        });
        
        document.getElementById('start-download-btn').addEventListener('click', async () => {
            CONFIG.format = document.getElementById('format-select').value;
            CONFIG.quality = document.getElementById('quality-select').value;
            document.getElementById('status').textContent = 'Starting download...';
            await processVideos();
            document.getElementById('status').textContent = 'Download completed';
        });
        
        document.getElementById('stop-download-btn').addEventListener('click', () => {
            isProcessing = false;
            document.getElementById('status').textContent = 'Stopped';
        });
    }

    function init() {
        console.log('[Auto Downloader] Script loaded');
        createControlPanel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
