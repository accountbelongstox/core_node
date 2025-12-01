// ==UserScript==
// @name         88code Auto Reset Quota
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  Auto reset quota on 88code.org
// @author       CoreNode
// @match        *://www.88code.org/*
// @match        *://88code.org/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        TARGET_PATH: '/my-subscription',
        HOURS_THRESHOLD: 4 + 1/60,
        BUTTON_KEYWORD: '重置额度',
        CONFIRM_DELAY: 1500,
        NEAR_11PM_START_HOUR: 22,
        NEAR_11PM_START_MINUTE: 58,
        NEAR_11PM_END_HOUR: 22,
        NEAR_11PM_END_MINUTE: 59,
        NEAR_11PM_END_SECOND: 50,
        STORAGE_KEY: '88code_auto_reset_clicks',
    };

    function log(message) {
        console.log(`[88code Auto Reset ${new Date().toLocaleTimeString()}] ${message}`);
    }

    function findElementByKeyword(keyword, tagName = '*') {
        const elements = document.querySelectorAll(tagName);
        for (let el of elements) {
            if (el.textContent && el.textContent.includes(keyword)) {
                return el;
            }
        }
        return null;
    }

    function findButtonByKeyword(keyword) {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
            if ((btn.textContent || '').trim().includes(keyword)) {
                return btn;
            }
        }
        return null;
    }

    function parseQuotaStatus() {
        const result = { currentQuota: 0, maxQuota: 0, isFull: false, found: false };
        const quotaDiv = findElementByKeyword('额度余额', 'div') || findElementByKeyword('额度', 'div');
        if (!quotaDiv) return result;

        const match = (quotaDiv.textContent || '').match(/\$\s*(-?\d+(?:\.\d+)?)\s*\/\s*\$\s*(\d+(?:\.\d+)?)/);
        if (match) {
            result.currentQuota = parseFloat(match[1]);
            result.maxQuota = parseFloat(match[2]);
            result.isFull = result.currentQuota >= result.maxQuota;
            result.found = true;
        }
        return result;
    }

    function parseLastResetTime() {
        log('[DEBUG] parseLastResetTime() called');
        const spans = document.querySelectorAll('span');
        log(`[DEBUG] Found ${spans.length} span elements`);
        for (let span of spans) {
            const text = span.textContent || '';
            if (text.includes('上次重置')) {
                log(`[DEBUG] Found span with "上次重置": ${text}`);
                const match = text.match(/上次重置[：:]\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
                if (match) {
                    log(`[DEBUG] Match found: month=${match[1]}, day=${match[2]}, hour=${match[3]}, minute=${match[4]}, second=${match[5] || 0}`);
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = parseInt(match[1]);
                    const day = parseInt(match[2]);
                    const hour = parseInt(match[3]);
                    const minute = parseInt(match[4]);
                    const second = match[5] ? parseInt(match[5]) : 0;

                    // 先尝试当前月份
                    let lastReset = new Date(year, month - 1, day, hour, minute, second);
                    log(`[DEBUG] Initial lastReset (current month): ${lastReset.toLocaleString()}`);
                    
                    // 如果解析的时间在未来，尝试上个月
                    if (lastReset > now) {
                        log('[DEBUG] lastReset > now, trying previous month');
                        lastReset = new Date(year, month - 2, day, hour, minute, second);
                        log(`[DEBUG] lastReset (previous month): ${lastReset.toLocaleString()}`);
                        // 如果还是未来，尝试去年
                        if (lastReset > now) {
                            log('[DEBUG] lastReset still > now, trying previous year');
                            lastReset = new Date(year - 1, month - 1, day, hour, minute, second);
                            log(`[DEBUG] lastReset (previous year): ${lastReset.toLocaleString()}`);
                        }
                    }
                    
                    // 如果解析的时间太早（超过31天前），可能是本月
                    const daysDiff = (now - lastReset) / (1000 * 60 * 60 * 24);
                    log(`[DEBUG] daysDiff: ${daysDiff}`);
                    if (daysDiff > 31) {
                        log('[DEBUG] daysDiff > 31, resetting to current month');
                        lastReset = new Date(year, month - 1, day, hour, minute, second);
                        log(`[DEBUG] lastReset reset to: ${lastReset.toLocaleString()}`);
                    }
                    
                    // 确保 lastReset 不超过 now
                    if (lastReset > now) {
                        log('[DEBUG] lastReset still > now after all checks, trying previous month again');
                        lastReset = new Date(year, month - 2, day, hour, minute, second);
                        if (lastReset > now) {
                            lastReset = new Date(year - 1, month - 1, day, hour, minute, second);
                        }
                        log(`[DEBUG] Final lastReset after correction: ${lastReset.toLocaleString()}`);
                    }

                    log(`[DEBUG] Returning lastReset: ${lastReset.toLocaleString()}`);
                    return lastReset;
                } else {
                    log('[DEBUG] No match found in regex');
                }
            }
        }
        log('[DEBUG] No span with "上次重置" found, returning null');
        return null;
    }

    function parseRemainingResets() {
        const spans = document.querySelectorAll('span');
        for (let span of spans) {
            const text = span.textContent || '';
            if (text.includes('今日剩余') && text.includes('次')) {
                const match = text.match(/今日剩余\s*(\d+)\s*次/);
                if (match) {
                    return parseInt(match[1]);
                }
            }
        }
        return 0;
    }

    function isNear11PM() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const second = now.getSeconds();
        if (hour === CONFIG.NEAR_11PM_START_HOUR && minute >= CONFIG.NEAR_11PM_START_MINUTE) {
            if (minute < CONFIG.NEAR_11PM_END_MINUTE) return true;
            if (minute === CONFIG.NEAR_11PM_END_MINUTE && second < CONFIG.NEAR_11PM_END_SECOND) return true;
        }
        return false;
    }

    function canClick() {
        const quota = parseQuotaStatus();
        if (quota.isFull) return { can: false, reason: '额度已满' };
        const remaining = parseRemainingResets();
        if (remaining <= 0) return { can: false, reason: '无剩余次数' };
        return { can: true, reason: '' };
    }

    // 检查是否一切就绪可以点击
    function isEverythingReady() {
        log('[DEBUG] isEverythingReady() called');
        
        // 0. 检查是否正在点击中
        if (isClickingInProgress) {
            log('[DEBUG] Click already in progress, not ready');
            return { ready: false, reason: '点击进行中' };
        }
        
        // 1. 检查重置按钮是否存在
        const resetButton = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
        if (!resetButton) {
            log('[DEBUG] Reset button not found');
            return { ready: false, reason: '重置按钮未找到' };
        }
        log('[DEBUG] Reset button found');
        
        // 2. 检查是否可以点击（额度、剩余次数）
        const clickCheck = canClick();
        if (!clickCheck.can) {
            log(`[DEBUG] Cannot click: ${clickCheck.reason}`);
            return { ready: false, reason: clickCheck.reason };
        }
        log('[DEBUG] Can click check passed');
        
        // 3. 检查是否应该重置（时间、额度条件）
        const resetCheck = shouldReset();
        if (!resetCheck.should) {
            log(`[DEBUG] Should not reset: ${resetCheck.reason}`);
            return { ready: false, reason: resetCheck.reason };
        }
        log('[DEBUG] Should reset check passed');
        
        // 4. 检查确认按钮是否存在（先点击重置按钮后会出现）
        // 这里不检查确认按钮，因为确认按钮是在点击重置按钮后才出现的
        
        log('[DEBUG] Everything is ready');
        return { ready: true, reason: '一切就绪' };
    }

    function findConfirmButton() {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text === '重置' || (text.includes('重置') && !text.includes('额度'))) {
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    return btn;
                }
            }
        }
        return null;
    }

    function findCancelButton() {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text === '取消') {
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    return btn;
                }
            }
        }
        return null;
    }

    // 测试按钮：点击重置按钮，检查确认对话框，点击取消
    function testButtons() {
        log('[DEBUG] testButtons() called');
        updateButtonTestStatus('测试中...');
        
        const resetButton = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
        if (!resetButton) {
            log('[DEBUG] Reset button not found for testing');
            updateButtonTestStatus('重置按钮未找到');
            return;
        }

        log('[DEBUG] Clicking reset button for testing');
        resetButton.click();

        // 等待对话框出现
        setTimeout(function() {
            log('[DEBUG] Checking for confirm button after click');
            const confirmButton = findConfirmButton();
            if (confirmButton) {
                log('[DEBUG] Confirm button found, clicking cancel');
                updateButtonTestStatus('确认按钮已找到，点击取消');
                
                // 点击取消按钮
                setTimeout(function() {
                    const cancelButton = findCancelButton();
                    if (cancelButton) {
                        log('[DEBUG] Cancel button found, clicking it');
                        cancelButton.click();
                        updateButtonTestStatus('确认按钮已找到，已点击取消');
                    } else {
                        log('[DEBUG] Cancel button not found');
                        updateButtonTestStatus('确认按钮已找到，但取消按钮未找到');
                    }
                }, 500);
            } else {
                log('[DEBUG] Confirm button not found');
                updateButtonTestStatus('确认按钮未找到');
            }
        }, 1000);
    }

    function updateButtonTestStatus(message) {
        if (!uiElement) return;
        const testStatus = uiElement.querySelector('#button-test-status');
        if (testStatus) {
            testStatus.textContent = message;
            if (message.includes('已找到') && message.includes('已点击取消')) {
                testStatus.style.color = '#10b981';
            } else if (message.includes('已找到')) {
                testStatus.style.color = '#f59e0b';
            } else if (message.includes('未找到')) {
                testStatus.style.color = '#ef4444';
            } else {
                testStatus.style.color = '#6b7280';
            }
        }
    }

    function clickConfirmButton() {
        const btn = findConfirmButton();
        if (btn) {
            log('Clicking confirm button');
            btn.click();
            return true;
        }
        return false;
    }

    // 检查点击是否成功（额度是否恢复到50）
    function isClickSuccessful() {
        log('[DEBUG] isClickSuccessful() called');
        const quota = parseQuotaStatus();
        log(`[DEBUG] quota.currentQuota: ${quota.currentQuota}, quota.maxQuota: ${quota.maxQuota}`);
        // 额度恢复到接近最大值（>= 49.9）才算成功
        const isSuccess = quota.currentQuota >= 49.9;
        log(`[DEBUG] isClickSuccessful: ${isSuccess}`);
        return isSuccess;
    }

    // 保存点击前的额度，用于对比
    function saveQuotaBeforeClick() {
        const quota = parseQuotaStatus();
        sessionStorage.setItem('88code_quota_before_click', quota.currentQuota.toString());
        log(`[DEBUG] Saved quota before click: ${quota.currentQuota}`);
    }

    // 检查点击后额度是否恢复
    function checkClickSuccessAfterDelay() {
        log('[DEBUG] checkClickSuccessAfterDelay() called');
        // 等待5秒后检查
        setTimeout(function() {
            log('[DEBUG] Checking quota after click');
            if (isClickSuccessful()) {
                log('[DEBUG] Click successful, quota restored');
                recordSuccessfulClick();
                // 清除点击进行中标志
                isClickingInProgress = false;
                log('[DEBUG] Setting isClickingInProgress = false (success)');
            } else {
                log('[DEBUG] Click not successful yet, quota not restored, will check again');
                // 如果还没恢复，再等5秒检查一次
                setTimeout(function() {
                    if (isClickSuccessful()) {
                        log('[DEBUG] Click successful after second check');
                        recordSuccessfulClick();
                    } else {
                        log('[DEBUG] Click failed, quota not restored');
                    }
                    // 清除点击进行中标志
                    isClickingInProgress = false;
                    log('[DEBUG] Setting isClickingInProgress = false (after check)');
                }, 5000);
            }
        }, 5000);
    }

    function clickResetButton() {
        // 防止重复点击
        if (isClickingInProgress) {
            log('[DEBUG] Click already in progress, skipping');
            return false;
        }
        
        const button = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
        if (!button) {
            log('Reset button not found');
            return false;
        }

        // 设置点击进行中标志
        isClickingInProgress = true;
        log('[DEBUG] Setting isClickingInProgress = true');

        // 保存点击前的额度
        saveQuotaBeforeClick();

        log('Clicking reset button');
        button.click();

        // 等待对话框出现，确保确认按钮存在后再点击
        setTimeout(function() {
            log('[DEBUG] Checking for confirm button after clicking reset button');
            const confirmButton = findConfirmButton();
            if (!confirmButton) {
                log('[DEBUG] Confirm button not found, waiting and retrying');
                // 再等1秒重试
                setTimeout(function() {
                    const confirmButton2 = findConfirmButton();
                    if (confirmButton2) {
                        log('[DEBUG] Confirm button found on retry, clicking');
                        clickConfirmButton();
                        // 只点击一次确认按钮，然后检查结果
                        checkClickSuccessAfterDelay();
                    } else {
                        log('[DEBUG] Confirm button still not found, click may have failed');
                        // 清除点击进行中标志
                        isClickingInProgress = false;
                        log('[DEBUG] Setting isClickingInProgress = false (confirm button not found)');
                    }
                }, 1000);
                return;
            }
            
            log('[DEBUG] Confirm button found, clicking');
            clickConfirmButton();
            // 只点击一次确认按钮，然后检查结果
            checkClickSuccessAfterDelay();
        }, CONFIG.CONFIRM_DELAY);

        return true;
    }

    function recordSuccessfulClick() {
        try {
            const clicks = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            const quota = parseQuotaStatus();
            clicks.push({ 
                timestamp: new Date().toISOString(), 
                time: new Date().toLocaleString('zh-CN'),
                quotaAfter: quota.currentQuota
            });
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(clicks));
            log(`Recorded successful click #${clicks.length}, quota after: ${quota.currentQuota}`);
            // 清除点击前额度记录
            sessionStorage.removeItem('88code_quota_before_click');
        } catch (e) {
            log('Error: ' + e.message);
        }
    }

    function getTotalClicks() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]').length;
        } catch (e) {
            return 0;
        }
    }

    // 判断是否到了重置时间
    function isResetTimeReached() {
        log('[DEBUG] isResetTimeReached() called');
        const lastReset = parseLastResetTime();
        if (!lastReset) {
            log('[DEBUG] lastReset is null, returning false');
            return { reached: false, reason: '未找到上次重置时间' };
        }
        
        const now = new Date();
        const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);
        log(`[DEBUG] hoursSinceReset: ${hoursSinceReset}, CONFIG.HOURS_THRESHOLD: ${CONFIG.HOURS_THRESHOLD}`);
        
        if (hoursSinceReset >= CONFIG.HOURS_THRESHOLD) {
            log('[DEBUG] Reset time reached');
            return { reached: true, reason: '时间已到' };
        } else {
            const waitHours = (CONFIG.HOURS_THRESHOLD - hoursSinceReset).toFixed(2);
            log(`[DEBUG] Reset time not reached, need to wait ${waitHours} hours`);
            return { reached: false, reason: `还需等待 ${waitHours} 小时` };
        }
    }

    // 判断余额是否大于2
    function isQuotaGreaterThan2() {
        log('[DEBUG] isQuotaGreaterThan2() called');
        const quota = parseQuotaStatus();
        log(`[DEBUG] quota.currentQuota: ${quota.currentQuota}`);
        const result = quota.currentQuota > 2;
        log(`[DEBUG] isQuotaGreaterThan2: ${result}`);
        return result;
    }

    // 判断是否临近11点且应该重置
    function shouldResetNear11PM() {
        log('[DEBUG] shouldResetNear11PM() called');
        const near11PM = isNear11PM();
        log(`[DEBUG] isNear11PM(): ${near11PM}`);
        
        if (!near11PM) {
            log('[DEBUG] Not near 11PM, returning false');
            return { should: false, reason: '' };
        }
        
        const quota = parseQuotaStatus();
        log(`[DEBUG] quota.currentQuota: ${quota.currentQuota}`);
        
        if (quota.currentQuota < 50) {
            log('[DEBUG] Near 11PM and quota < 50, returning true');
            return { should: true, reason: '临近11点，额度小于50' };
        } else {
            log('[DEBUG] Near 11PM but quota >= 50, returning false');
            return { should: false, reason: '临近11点，但额度已满' };
        }
    }

    function shouldReset() {
        log('[DEBUG] shouldReset() called');
        
        const remaining = parseRemainingResets();
        log(`[DEBUG] remaining resets: ${remaining}`);
        if (remaining <= 0) {
            log('[DEBUG] No remaining resets, returning should: false');
            return { should: false, reason: '无剩余次数' };
        }

        // 条件3: 如果临近11点，无论是否到点击时间，只要额度 < 50 都点击
        const near11PMCheck = shouldResetNear11PM();
        if (near11PMCheck.should) {
            log('[DEBUG] Should reset near 11PM');
            return { should: true, reason: near11PMCheck.reason };
        }
        if (near11PMCheck.reason) {
            log('[DEBUG] Near 11PM but should not reset');
            return { should: false, reason: near11PMCheck.reason };
        }

        // 条件1: 只有到了重置时间才刷新点击
        const timeCheck = isResetTimeReached();
        if (!timeCheck.reached) {
            log('[DEBUG] Reset time not reached');
            return { should: false, reason: timeCheck.reason };
        }

        // 条件2: 点击前判断余额，如果余额 > 2 则不点击
        if (isQuotaGreaterThan2()) {
            const quota = parseQuotaStatus();
            log('[DEBUG] Quota > 2, returning should: false');
            return { should: false, reason: `余额大于2，当前余额: ${quota.currentQuota}` };
        }

        // 时间到了且余额 <= 2，可以点击
        log('[DEBUG] Time reached and quota <= 2, returning should: true');
        return { should: true, reason: '时间已到，余额小于等于2' };
    }

    let near11PMInterval = null;
    let quotaRefreshInterval = null;
    let isClickingInProgress = false; // 防止重复点击

    function checkAndReset() {
        log('[DEBUG] checkAndReset() called');
        log(`[DEBUG] Current pathname: ${window.location.pathname}, TARGET_PATH: ${CONFIG.TARGET_PATH}`);
        const currentPath = window.location.pathname;
        // 如果不在精确路径上，跳转到目标路径
        if (currentPath !== CONFIG.TARGET_PATH) {
            log(`[DEBUG] Not on exact target path (current: ${currentPath}), redirecting to ${CONFIG.TARGET_PATH}`);
            window.location.href = CONFIG.TARGET_PATH;
            return;
        }

        log('[DEBUG] Calling updateUI()');
        updateUI();

        log('[DEBUG] Calling shouldReset()');
        const reset = shouldReset();
        log(`[DEBUG] reset.should: ${reset.should}, reset.reason: ${reset.reason}`);
        
        log('[DEBUG] Calling isNear11PM()');
        const near11PM = isNear11PM();
        log(`[DEBUG] isNear11PM(): ${near11PM}`);

        if (!near11PM && near11PMInterval) {
            log('[DEBUG] Not near 11PM and interval exists, clearing it');
            clearInterval(near11PMInterval);
            near11PMInterval = null;
        }

        if (reset.should) {
            log('[DEBUG] reset.should is true');
            if (near11PMInterval) {
                log('[DEBUG] Clearing near11PMInterval');
                clearInterval(near11PMInterval);
                near11PMInterval = null;
            }

            // 根据当前实际状态判断：检查额度
            const quota = parseQuotaStatus();
            log(`[DEBUG] Current quota: ${quota.currentQuota}`);
            
            // 如果临近11点，无论额度多少（只要 < 50），都直接点击
            if (near11PM && quota.currentQuota < 50) {
                log('[DEBUG] Near 11PM and quota < 50, clicking directly');
                if (quotaRefreshInterval) {
                    clearInterval(quotaRefreshInterval);
                    quotaRefreshInterval = null;
                }
                // 检查一切就绪后点击
                const readyCheck = isEverythingReady();
                if (readyCheck.ready) {
                    clickResetButton();
                } else {
                    log(`[DEBUG] Not ready for click: ${readyCheck.reason}`);
                    updateStatusMessage(`准备点击但未就绪: ${readyCheck.reason}`);
                }
            } else if (quota.currentQuota > 2) {
                // 额度大于2，启动刷新循环，每分钟刷新一次
                // 如果已经在刷新循环中，不重复启动
                if (quotaRefreshInterval) {
                    log('[DEBUG] Quota > 2, refresh loop already running');
                    return;
                }
                
                log('[DEBUG] Quota > 2, starting refresh loop');
                updateStatusMessage(`额度大于2 (${quota.currentQuota})，每分钟刷新一次直到额度小于等于2...`);
                
                // 立即刷新一次
                setTimeout(function() {
                    window.location.reload();
                }, 1000);
                
                // 设置定时器，每分钟刷新一次
                quotaRefreshInterval = setInterval(function() {
                    log('[DEBUG] quotaRefreshInterval: refreshing page');
                    window.location.reload();
                }, 60 * 1000);
            } else {
                // 额度 <= 2，刷新页面后点击
                log('[DEBUG] Quota <= 2, refreshing page to click');
                if (quotaRefreshInterval) {
                    clearInterval(quotaRefreshInterval);
                    quotaRefreshInterval = null;
                }
                updateStatusMessage('准备点击，正在刷新页面...');
                // 设置标记，刷新后检查一切就绪再点击
                sessionStorage.setItem('88code_ready_to_click', 'true');
                setTimeout(function() {
                    window.location.reload();
                }, 1000);
            }
        } else {
            log('[DEBUG] reset.should is false');
            if (near11PM && !near11PMInterval) {
                log('[DEBUG] Near 11PM and no interval, creating interval');
                near11PMInterval = setInterval(function() {
                    log('[DEBUG] near11PMInterval callback called');
                    if (!isNear11PM()) {
                        log('[DEBUG] No longer near 11PM, clearing interval');
                        clearInterval(near11PMInterval);
                        near11PMInterval = null;
                        return;
                    }
                    // 临近11点时也要检查一切是否就绪
                    log('[DEBUG] Still near 11PM, checking if everything is ready');
                    const readyCheck = isEverythingReady();
                    log(`[DEBUG] readyCheck.ready: ${readyCheck.ready}, reason: ${readyCheck.reason}`);
                    if (readyCheck.ready) {
                        log('[DEBUG] Everything is ready, clicking reset button');
                        clickResetButton();
                    } else {
                        log(`[DEBUG] Not ready: ${readyCheck.reason}`);
                    }
                }, 2000);
            }
            if (!near11PM) {
                log(`[DEBUG] Not near 11PM, updating status message: ${reset.reason}`);
                updateStatusMessage(reset.reason);
            }
        }
        log('[DEBUG] checkAndReset() finished');
    }

    let uiElement = null;
    let timeUpdateInterval = null;

    function createUI() {
        if (uiElement) uiElement.remove();

        uiElement = document.createElement('div');
        uiElement.id = '88code-auto-reset-ui';
        uiElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; min-width: 280px;';

        uiElement.innerHTML = `
            <div style="margin-bottom: 12px; font-weight: 600; color: #1f2937;">88code Auto Reset</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #6b7280;">额度余额:</span>
                <span id="quota-display" style="color: #ef4444; font-weight: 500;">加载中...</span>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">下次重置时间:</div>
                <div id="next-reset-time-display" style="color: #1f2937; font-weight: 600; font-size: 16px;">--:--:--</div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">按钮状态:</div>
                <div id="button-status" style="color: #1f2937; font-size: 12px;">检查中...</div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">按钮测试:</div>
                <div id="button-test-status" style="color: #1f2937; font-size: 12px;">未测试</div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">距离下次重置:</div>
                <div id="time-to-reset-display" style="color: #1f2937; font-weight: 600; font-size: 16px;">--:--:--</div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #6b7280; font-size: 12px;">总成功点击:</span>
                    <span id="total-clicks-display" style="color: #10b981; font-weight: 600; font-size: 14px;">0</span>
                </div>
                <div id="status-message" style="color: #6b7280; font-size: 12px; line-height: 1.5;">等待检查...</div>
            </div>
        `;

        document.body.appendChild(uiElement);
        updateUI();
    }

    function updateUI() {
        if (!uiElement) return;

        const quota = parseQuotaStatus();
        const quotaDisplay = uiElement.querySelector('#quota-display');
        if (quotaDisplay) {
            if (quota.found) {
                quotaDisplay.textContent = `$${quota.currentQuota} / $${quota.maxQuota}`;
                quotaDisplay.style.color = quota.isFull ? '#10b981' : '#f59e0b';
            } else {
                quotaDisplay.textContent = '未找到';
                quotaDisplay.style.color = '#6b7280';
            }
        }

        const buttonStatus = uiElement.querySelector('#button-status');
        if (buttonStatus) {
            const button = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
            buttonStatus.textContent = button ? '已找到' : '未找到';
            buttonStatus.style.color = button ? '#10b981' : '#ef4444';
        }

        const totalClicksDisplay = uiElement.querySelector('#total-clicks-display');
        if (totalClicksDisplay) {
            totalClicksDisplay.textContent = getTotalClicks().toString();
        }

        updateNextResetTime();
        updateTimeToReset();
    }

    function updateNextResetTime() {
        if (!uiElement) return;
        const display = uiElement.querySelector('#next-reset-time-display');
        if (!display) return;

        const lastReset = parseLastResetTime();
        if (!lastReset) {
            display.textContent = '--:--:--';
            return;
        }

        const nextReset = new Date(lastReset.getTime() + CONFIG.HOURS_THRESHOLD * 60 * 60 * 1000);
        const now = new Date();
        const nextYear = nextReset.getFullYear();
        const nextMonth = nextReset.getMonth() + 1;
        const nextDay = nextReset.getDate();
        const nowYear = now.getFullYear();
        const nowMonth = now.getMonth() + 1;
        const nowDay = now.getDate();

        let dateStr = '';
        if (nextYear === nowYear && nextMonth === nowMonth && nextDay === nowDay) {
            dateStr = '今天';
        } else if (nextYear === nowYear && nextMonth === nowMonth && nextDay === nowDay + 1) {
            dateStr = '明天';
        } else {
            dateStr = `${nextMonth}/${nextDay}`;
        }

        const hoursStr = String(nextReset.getHours()).padStart(2, '0');
        const minutesStr = String(nextReset.getMinutes()).padStart(2, '0');
        const secondsStr = String(nextReset.getSeconds()).padStart(2, '0');

        const diff = nextReset - now;
        if (diff <= 0) {
            display.textContent = `${dateStr} ${hoursStr}:${minutesStr}:${secondsStr} (可重置)`;
            display.style.color = '#10b981';
        } else {
            display.textContent = `${dateStr} ${hoursStr}:${minutesStr}:${secondsStr}`;
            display.style.color = diff < 60 * 60 * 1000 ? '#ef4444' : (diff < 3 * 60 * 60 * 1000 ? '#f59e0b' : '#1f2937');
        }
    }

    function updateTimeToReset() {
        log('[DEBUG] updateTimeToReset() called');
        if (!uiElement) {
            log('[DEBUG] uiElement is null, returning');
            return;
        }
        const display = uiElement.querySelector('#time-to-reset-display');
        if (!display) {
            log('[DEBUG] display element not found, returning');
            return;
        }

        log('[DEBUG] Parsing last reset time...');
        const lastReset = parseLastResetTime();
        if (!lastReset) {
            log('[DEBUG] lastReset is null, displaying --:--:--');
            display.textContent = '--:--:--';
            return;
        }
        log(`[DEBUG] lastReset parsed: ${lastReset.toLocaleString()}`);

        log(`[DEBUG] CONFIG.HOURS_THRESHOLD: ${CONFIG.HOURS_THRESHOLD}`);
        const nextReset = new Date(lastReset.getTime() + CONFIG.HOURS_THRESHOLD * 60 * 60 * 1000);
        log(`[DEBUG] nextReset calculated: ${nextReset.toLocaleString()}`);
        
        const now = new Date();
        log(`[DEBUG] now: ${now.toLocaleString()}`);
        
        const diff = nextReset - now;
        log(`[DEBUG] diff (ms): ${diff}, diff (hours): ${diff / (1000 * 60 * 60)}`);
        
        const quota = parseQuotaStatus();
        log(`[DEBUG] quota.isFull: ${quota.isFull}, quota.currentQuota: ${quota.currentQuota}, quota.maxQuota: ${quota.maxQuota}`);

        // 计算剩余时间（无论额度是否已满都显示倒计时）
        const totalSeconds = Math.max(0, Math.floor(diff / 1000));
        log(`[DEBUG] totalSeconds: ${totalSeconds}`);
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        log(`[DEBUG] hours: ${hours}, minutes: ${minutes}, seconds: ${seconds}`);
        
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const secondsStr = String(seconds).padStart(2, '0');
        log(`[DEBUG] Formatted time: ${hoursStr}:${minutesStr}:${secondsStr}`);

        // 即使额度已满，也显示倒计时
        if (quota.isFull) {
            log('[DEBUG] Quota is full, displaying countdown with (额度已满)');
            display.textContent = `${hoursStr}:${minutesStr}:${secondsStr} (额度已满)`;
            display.style.color = '#6b7280';
        } else {
            if (diff <= 0) {
                log('[DEBUG] diff <= 0, but quota not full, displaying 00:00:00 (可点击)');
                display.textContent = '00:00:00 (可点击)';
                display.style.color = '#10b981';
            } else {
                log(`[DEBUG] diff > 0, displaying countdown: ${hoursStr}:${minutesStr}:${secondsStr}`);
                display.textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;
                display.style.color = diff < 60 * 60 * 1000 ? '#ef4444' : (diff < 3 * 60 * 60 * 1000 ? '#f59e0b' : '#1f2937');
            }
        }
        log(`[DEBUG] Final display text: ${display.textContent}`);
    }

    function updateStatusMessage(message) {
        if (!uiElement) return;
        const statusMessage = uiElement.querySelector('#status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
        }
    }

    function closeIntroDialog() {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text.includes('关闭')) {
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }

    function init() {
        log('[DEBUG] init() called');
        log('Script initialized v6.0');

        // 首先检查是否在目标页面，如果不在则立即跳转
        log(`[DEBUG] Checking pathname: ${window.location.pathname}, TARGET_PATH: ${CONFIG.TARGET_PATH}`);
        const currentPath = window.location.pathname;
        // 如果不在精确路径上，跳转到目标路径
        if (currentPath !== CONFIG.TARGET_PATH) {
            log(`[DEBUG] Not on exact target path (current: ${currentPath}), redirecting to ${CONFIG.TARGET_PATH}`);
            window.location.href = CONFIG.TARGET_PATH;
            return;
        }

        log('[DEBUG] On target path, continuing initialization');
        
        // 检查是否准备点击（刷新后检查一切就绪再点击）
        const readyToClick = sessionStorage.getItem('88code_ready_to_click');
        if (readyToClick === 'true') {
            log('[DEBUG] Ready to click flag found, checking if everything is ready');
            sessionStorage.removeItem('88code_ready_to_click');
            setTimeout(function() {
                const readyCheck = isEverythingReady();
                log(`[DEBUG] readyCheck.ready: ${readyCheck.ready}, reason: ${readyCheck.reason}`);
                if (readyCheck.ready) {
                    log('[DEBUG] Everything is ready, clicking reset button');
                    clickResetButton();
                } else {
                    log(`[DEBUG] Not ready: ${readyCheck.reason}`);
                    updateStatusMessage(`未就绪: ${readyCheck.reason}`);
                }
            }, 3000);
        }
        
        // 检查是否有未确认的点击（刷新后检查额度是否恢复）
        const quotaBeforeClick = sessionStorage.getItem('88code_quota_before_click');
        if (quotaBeforeClick) {
            log(`[DEBUG] Found quota before click: ${quotaBeforeClick}, checking if quota restored`);
            setTimeout(function() {
                if (isClickSuccessful()) {
                    log('[DEBUG] Quota restored after page refresh, recording successful click');
                    recordSuccessfulClick();
                } else {
                    log('[DEBUG] Quota not restored yet, will check again');
                    // 再等5秒检查一次
                    setTimeout(function() {
                        if (isClickSuccessful()) {
                            log('[DEBUG] Quota restored after second check');
                            recordSuccessfulClick();
                        } else {
                            log('[DEBUG] Click failed, quota not restored, clearing flag');
                            sessionStorage.removeItem('88code_quota_before_click');
                        }
                    }, 5000);
                }
            }, 3000);
        }
        
        setTimeout(closeIntroDialog, 500);
        setTimeout(closeIntroDialog, 2000);

        createUI();

        // 测试按钮：点击重置按钮，检查确认对话框，点击取消（仅在非点击进行中时测试）
        setTimeout(function() {
            if (!isClickingInProgress) {
                testButtons();
            }
        }, 4000);

        setTimeout(checkAndReset, 3000);

        let uiUpdateCounter = 0;
        if (timeUpdateInterval) clearInterval(timeUpdateInterval);
        timeUpdateInterval = setInterval(function() {
            updateNextResetTime();
            updateTimeToReset();
            checkAndReset();
            uiUpdateCounter++;
            if (uiUpdateCounter >= 5) {
                uiUpdateCounter = 0;
                updateUI();
            }
        }, 1000);
        
        // 清理间隔：页面卸载时清理所有间隔
        window.addEventListener('beforeunload', function() {
            if (timeUpdateInterval) clearInterval(timeUpdateInterval);
            if (near11PMInterval) clearInterval(near11PMInterval);
            if (quotaRefreshInterval) clearInterval(quotaRefreshInterval);
        });
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})();

