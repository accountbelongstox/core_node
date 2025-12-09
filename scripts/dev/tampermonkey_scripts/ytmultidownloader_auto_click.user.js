// ==UserScript==
// @name         YT Multi Downloader Auto Click
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Scan and generate download script from ytmultidownloader.com
// @author       You
// @match        *://ytmultidownloader.com/*
// @match        *://www.ytmultidownloader.com/*
// @match        *://*.googlevideo.com/*
// @match        *://googlevideo.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'ytmultidownloader_clicked_pages';
    const currentPageUrl = window.location.href;

    // Clear current page from storage on load (allows re-clicking after refresh)
    function clearCurrentPageFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const clickedPages = JSON.parse(data);
                const filtered = clickedPages.filter(url => url !== currentPageUrl);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            }
        } catch (e) {
            console.error('[YT Multi Downloader Auto Click] Failed to clear current page from storage:', e);
        }
    }

    // Get clicked pages from localStorage
    function getClickedPages() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    // Check if current page has been clicked
    function hasPageBeenClicked() {
        const clickedPages = getClickedPages();
        return clickedPages.includes(currentPageUrl);
    }

    // Mark current page as clicked
    function markPageAsClicked() {
        try {
            const clickedPages = getClickedPages();
            if (!clickedPages.includes(currentPageUrl)) {
                clickedPages.push(currentPageUrl);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(clickedPages));
            }
        } catch (e) {
            console.error('[YT Multi Downloader Auto Click] Failed to mark page as clicked:', e);
        }
    }

    // Clear current page on page load (allows re-clicking after refresh)
    clearCurrentPageFromStorage();

    // UI Element
    let uiElement = null;
    let statusData = {
        buttonFound: false,
        buttonType: '',
        clicked: false,
        status: 'Initializing...',
        lastCheck: ''
    };

    // Create status UI in bottom right corner
    function createStatusUI() {
        if (uiElement) {
            uiElement.remove();
        }

        uiElement = document.createElement('div');
        uiElement.id = 'ytmultidownloader-status-ui';
        uiElement.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
            min-width: 280px;
            max-width: 350px;
        `;

        uiElement.innerHTML = `
            <div style="margin-bottom: 12px; font-weight: 600; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                YT Multi Downloader
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Status:</div>
                <div id="status-text" style="color: #1f2937; font-weight: 500; font-size: 14px;">Ready</div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Items Found:</div>
                <div id="items-count" style="color: #6b7280; font-size: 12px;">0</div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <button id="generate-script-btn" style="width: 100%; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 8px;">
                    Collect & Generate Download Script
                </button>
                <div style="display: flex; gap: 4px;">
                    <button id="download-bash-btn" style="flex: 1; padding: 6px 8px; background: #10b981; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; display: none;">
                        Download Bash
                    </button>
                    <button id="download-ps-btn" style="flex: 1; padding: 6px 8px; background: #10b981; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; display: none;">
                        Download PS
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(uiElement);
        updateStatusUI();
        
        // Add event listeners
        const generateBtn = uiElement.querySelector('#generate-script-btn');
        const bashBtn = uiElement.querySelector('#download-bash-btn');
        const psBtn = uiElement.querySelector('#download-ps-btn');
        
        let generatedScript = null;
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                setStatus('Scanning page...');
                const items = scanVideoBlocks();
                setStatus(`Found ${items.length} items`);
                updateItemsCount(items.length);
                
                if (items.length > 0) {
                    generatedScript = generateDownloadScript(items);
                    if (generatedScript) {
                        bashBtn.style.display = 'block';
                        psBtn.style.display = 'block';
                        setStatus(`Generated script for ${items.length} items`);
                    }
                } else {
                    setStatus('No items found');
                    bashBtn.style.display = 'none';
                    psBtn.style.display = 'none';
                }
            });
        }
        
        if (bashBtn) {
            bashBtn.addEventListener('click', () => {
                if (generatedScript) {
                    downloadScript(generatedScript.bash, 'download.sh');
                    setStatus('Bash script downloaded');
                }
            });
        }
        
        if (psBtn) {
            psBtn.addEventListener('click', () => {
                if (generatedScript) {
                    downloadScript(generatedScript.powershell, 'download.ps1');
                    setStatus('PowerShell script downloaded');
                }
            });
        }
    }
    
    // Update items count
    function updateItemsCount(count) {
        if (!uiElement) return;
        const countEl = uiElement.querySelector('#items-count');
        if (countEl) {
            countEl.textContent = count.toString();
            countEl.style.color = count > 0 ? '#10b981' : '#6b7280';
        }
    }

    // Update status UI
    function updateStatusUI() {
        if (!uiElement) return;

        const statusText = uiElement.querySelector('#status-text');

        if (statusText) {
            statusText.textContent = statusData.status;
            if (statusData.status.includes('Found') || statusData.status.includes('Generated') || statusData.status.includes('downloaded')) {
                statusText.style.color = '#10b981';
            } else if (statusData.status.includes('Error') || statusData.status.includes('Failed')) {
                statusText.style.color = '#ef4444';
            } else if (statusData.status.includes('Scanning') || statusData.status.includes('Auto')) {
                statusText.style.color = '#f59e0b';
            } else {
                statusText.style.color = '#1f2937';
            }
        }
    }

    // Update status data
    function setStatus(status) {
        statusData.status = status;
        updateStatusUI();
    }

    // Find button containing "Load Options" text
    function findLoadOptionsButton() {
        // Method 1: Find by text content (broadest approach)
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
            const text = button.textContent || button.innerText || '';
            // Broad match: contains "Load Options" or "Options"
            if (text.includes('Load Options') || 
                text.trim() === 'Load Options' ||
                (text.includes('Options') && text.includes('Load'))) {
                // Check if button is enabled
                const isDisabled = button.disabled || 
                                  button.getAttribute('aria-disabled') === 'true' ||
                                  button.classList.contains('disabled');
                
                if (!isDisabled) {
                    return button;
                }
            }
        }

        // Method 2: Find by SVG path (if button contains download icon)
        const downloadIcons = document.querySelectorAll('svg path[d*="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"]');
        for (const icon of downloadIcons) {
            let element = icon;
            // Traverse up to find button element
            while (element && element.tagName !== 'BUTTON') {
                element = element.parentElement;
            }
            if (element && element.tagName === 'BUTTON') {
                const text = element.textContent || element.innerText || '';
                if (text.includes('Load Options') || 
                    text.includes('Options') || 
                    text.includes('Load')) {
                    const isDisabled = element.disabled || 
                                      element.getAttribute('aria-disabled') === 'true' ||
                                      element.classList.contains('disabled');
                    
                    if (!isDisabled) {
                        return element;
                    }
                }
            }
        }

        // Method 3: Find by class name (based on user-provided class names)
        const buttonsByClass = document.querySelectorAll('button.inline-flex.items-center');
        for (const button of buttonsByClass) {
            const text = button.textContent || button.innerText || '';
            if (text.includes('Load Options') || 
                text.includes('Options') || 
                text.includes('Load')) {
                const isDisabled = button.disabled || 
                                  button.getAttribute('aria-disabled') === 'true' ||
                                  button.classList.contains('disabled');
                
                if (!isDisabled) {
                    return button;
                }
            }
        }

        // Method 4: Find by download icon
        const buttonsWithDownloadIcon = document.querySelectorAll('button');
        for (const button of buttonsWithDownloadIcon) {
            const hasDownloadIcon = button.querySelector('svg path[d*="M21 15v4"]') ||
                                   button.querySelector('svg.lucide-download');
            if (hasDownloadIcon) {
                const text = button.textContent || button.innerText || '';
                if (text.includes('Options') || text.includes('Load')) {
                    const isDisabled = button.disabled || 
                                      button.getAttribute('aria-disabled') === 'true' ||
                                      button.classList.contains('disabled');
                    
                    if (!isDisabled) {
                        return button;  
                    }
                }
            }
        }

        return null;
    }

    // Scan page for video blocks and extract Direct URLs and titles
    function scanVideoBlocks() {
        const items = [];
        
        // Find all video blocks (each block contains h3 title and Direct URL)
        // Look for containers that have both h3 and Direct URL link
        const containers = document.querySelectorAll('div.p-6, div[class*="p-"]');
        
        for (const container of containers) {
            // Find h3 title in this container
            const h3 = container.querySelector('h3.text-lg.font-semibold, h3[class*="text-lg"]');
            if (!h3) continue;
            
            const title = h3.textContent.trim();
            if (!title) continue;
            
            // Find first Direct URL link in this container
            let directUrlLink = container.querySelector('a[href*="googlevideo.com"][href*="videoplayback"]');
            if (!directUrlLink) {
                // Try alternative: find any link with "Direct URL" text
                const links = container.querySelectorAll('a');
                for (const link of links) {
                    if (link.textContent.includes('Direct URL') && link.href.includes('googlevideo.com')) {
                        directUrlLink = link;
                        break;
                    }
                }
            }
            
            if (!directUrlLink) {
                continue;
            }
            
            const url = directUrlLink.href;
            if (url && url.includes('googlevideo.com')) {
                items.push({
                    title: title,
                    url: url,
                    filename: sanitizeFilename(title)
                });
            }
        }
        
        // Alternative method: find all h3 titles and their nearest Direct URL
        if (items.length === 0) {
            const h3s = document.querySelectorAll('h3.text-lg.font-semibold, h3[class*="text-lg"]');
            for (const h3 of h3s) {
                const title = h3.textContent.trim();
                if (!title) continue;
                
                // Find nearest Direct URL link (search in parent containers)
                let parent = h3.parentElement;
                let found = false;
                while (parent && !found) {
                    const directUrlLink = parent.querySelector('a[href*="googlevideo.com"][href*="videoplayback"]');
                    if (directUrlLink && directUrlLink.href.includes('googlevideo.com')) {
                        items.push({
                            title: title,
                            url: directUrlLink.href,
                            filename: sanitizeFilename(title)
                        });
                        found = true;
                    }
                    parent = parent.parentElement;
                }
            }
        }
        
        return items;
    }

    // Sanitize filename from title
    function sanitizeFilename(title) {
        // Remove invalid filename characters and replace with underscore
        return title
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_{2,}/g, '_')
            .substring(0, 200); // Limit length
    }

    // Generate download script
    function generateDownloadScript(items) {
        if (items.length === 0) {
            return null;
        }

        // Generate bash script
        let bashScript = '#!/bin/bash\n\n';
        bashScript += '# Auto-generated download script\n';
        bashScript += `# Generated: ${new Date().toISOString()}\n`;
        bashScript += `# Total items: ${items.length}\n\n`;

        items.forEach((item, index) => {
            const ext = item.url.includes('.mp4') ? 'mp4' : 'mp4';
            const filename = `${item.filename}.${ext}`;
            bashScript += `# ${index + 1}. ${item.title}\n`;
            bashScript += `curl -L -o "${filename}" "${item.url}"\n\n`;
        });

        // Generate PowerShell script
        let psScript = '# Auto-generated download script (PowerShell)\n';
        psScript += `# Generated: ${new Date().toISOString()}\n`;
        psScript += `# Total items: ${items.length}\n\n`;

        items.forEach((item, index) => {
            const ext = item.url.includes('.mp4') ? 'mp4' : 'mp4';
            const filename = `${item.filename}.${ext}`;
            psScript += `# ${index + 1}. ${item.title}\n`;
            psScript += `Invoke-WebRequest -Uri "${item.url}" -OutFile "${filename}"\n\n`;
        });

        return {
            bash: bashScript,
            powershell: psScript,
            items: items
        };
    }

    // Download script as file
    function downloadScript(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Click Load Options button
    function clickLoadOptionsButton() {
        // Check if already clicked for this page
        if (hasPageBeenClicked()) {
            return false;
        }

        const button = findLoadOptionsButton();
        if (button) {
            console.log('[YT Multi Downloader Auto Click] Found Load Options button, preparing to click');
            setStatus('Found Load Options, clicking...');
            
            // Ensure button is visible
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Wait a moment to ensure scroll completes
            setTimeout(() => {
                // Trigger click event
                try {
                    button.click();
                    console.log('[YT Multi Downloader Auto Click] Clicked Load Options button');
                    
                    // Mark page as clicked
                    markPageAsClicked();
                    setStatus('Clicked Load Options successfully');
                } catch (e) {
                    console.error('[YT Multi Downloader Auto Click] Click failed:', e);
                    // If click() fails, try dispatching mouse event
                    const event = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    button.dispatchEvent(event);
                    markPageAsClicked();
                    setStatus('Clicked Load Options (fallback method)');
                }
            }, 300);
            
            return true;
        }
        return false;
    }

    // Auto scan on page load
    function autoScan() {
        setStatus('Auto scanning...');
        const items = scanVideoBlocks();
        updateItemsCount(items.length);
        if (items.length > 0) {
            setStatus(`Found ${items.length} items`);
        } else {
            setStatus('Ready to scan');
        }
    }

    // Watch for Load Options button and click it
    function observeAndClickLoadOptions() {
        // Try to find and click immediately
        if (clickLoadOptionsButton()) {
            return;
        }

        // If not found, set up observer to watch DOM changes
        const observer = new MutationObserver((mutations) => {
            if (clickLoadOptionsButton()) {
                // After successful click, can choose to stop or continue observing
                // observer.disconnect();
            }
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled', 'class']
        });

        // Set timeout to avoid infinite observation
        setTimeout(() => {
            observer.disconnect();
        }, 60000); // Stop observing after 60 seconds
    }

    // Execute after page load completes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createStatusUI();
            observeAndClickLoadOptions(); // Auto click Load Options
            setTimeout(autoScan, 2000); // Wait for content to load, then scan
        });
    } else {
        createStatusUI();
        observeAndClickLoadOptions(); // Auto click Load Options
        setTimeout(autoScan, 2000);
    }

    // Also watch for page navigation (may be needed for SPA apps)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            clearCurrentPageFromStorage();
            observeAndClickLoadOptions(); // Auto click Load Options on navigation
            setTimeout(autoScan, 2000);
        }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // Periodic check for Load Options button (every 5 seconds)
    const checkInterval = setInterval(() => {
        if (!hasPageBeenClicked()) {
            clickLoadOptionsButton();
        }
    }, 5000); // Check every 5 seconds

})();

