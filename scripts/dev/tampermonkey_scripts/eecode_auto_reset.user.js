// ==UserScript==
// @name         88code Auto Reset Quota
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Auto reset quota on 88code.org - smart reset based on quota status and time
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
        CHECK_INTERVAL: 60 * 1000,
        HOURS_THRESHOLD: 4,
        RESET_KEYWORD: '上次重置',
        QUOTA_KEYWORD: '额度状态',
        REMAINING_KEYWORD: '今日剩余重置次数',
        BUTTON_KEYWORD: '重置额度',
        CONFIRM_KEYWORD: '重置',
        CONFIRM_ICON_CLASS: 'fa-redo',
        CONFIRM_DELAY: 1500,
        NEAR_MIDNIGHT_HOUR: 22,
        NEAR_MIDNIGHT_MINUTE: 54,
    };

    function log(message) {
        const time = new Date().toLocaleTimeString();
        console.log(`[88code Auto Reset ${time}] ${message}`);
    }

    function getQuotaStatusText(status) {
        if (status.isFull) return 'FULL';
        if (status.isDepleted) return 'DEPLETED';
        return 'IN USE';
    }

    function logStatus(status) {
        console.log('='.repeat(50));
        log('Status Report:');
        log(`  Quota: $${status.currentQuota} / $${status.maxQuota} (${getQuotaStatusText(status)})`);
        log(`  Remaining Resets Today: ${status.remainingResets}`);
        log(`  Last Reset Time: ${status.lastResetTime || 'Unknown'}`);
        log(`  Hours Since Reset: ${status.hoursSinceReset?.toFixed(2) || 'Unknown'}`);
        log(`  Current Time: ${new Date().toLocaleString()}`);
        log(`  Near Midnight (${CONFIG.NEAR_MIDNIGHT_HOUR}:${CONFIG.NEAR_MIDNIGHT_MINUTE}): ${status.isNearMidnight ? 'YES' : 'NO'}`);
        log(`  Should Reset: ${status.shouldReset ? 'YES' : 'NO'}`);
        log(`  Reason: ${status.reason}`);
        console.log('='.repeat(50));
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

    function findSpanByKeyword(keyword) {
        return findElementByKeyword(keyword, 'span');
    }

    function findDivByKeyword(keyword) {
        return findElementByKeyword(keyword, 'div');
    }

    function findButtonByKeyword(keyword, excludeKeyword) {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
            if (btn.textContent && btn.textContent.includes(keyword)) {
                if (excludeKeyword && btn.textContent.includes(excludeKeyword)) {
                    continue;
                }
                return btn;
            }
        }
        return null;
    }

    function findConfirmButtonByIcon(iconClass) {
        const icons = document.querySelectorAll('i.' + iconClass.replace(/\s+/g, '.'));
        for (let icon of icons) {
            const btn = icon.closest('button');
            if (btn) {
                return btn;
            }
        }
        return null;
    }

    function parseQuotaStatus() {
        const result = {
            currentQuota: 0,
            maxQuota: 0,
            isFull: false,
            isDepleted: false,
            found: false
        };

        const quotaDiv = findDivByKeyword(CONFIG.QUOTA_KEYWORD);
        if (!quotaDiv) {
            log('Quota status div not found');
            return result;
        }

        const text = quotaDiv.textContent || '';
        
        // Match patterns like "$50 / $50", "$-0.5 / $50", "$ 30.5 / $ 50"
        // Support negative numbers and optional spaces
        const match = text.match(/\$\s*(-?\d+(?:\.\d+)?)\s*\/\s*\$\s*(\d+(?:\.\d+)?)/);
        
        if (match) {
            result.currentQuota = parseFloat(match[1]);
            result.maxQuota = parseFloat(match[2]);
            result.isFull = result.currentQuota >= result.maxQuota;
            result.isDepleted = result.currentQuota <= 0;
            result.found = true;
        } else {
            log('Failed to parse quota from: ' + text);
        }

        return result;
    }

    function parseRemainingResets() {
        const result = {
            count: 0,
            found: false
        };

        const resetDiv = findDivByKeyword(CONFIG.REMAINING_KEYWORD);
        if (!resetDiv) {
            log('Remaining resets div not found');
            return result;
        }

        const text = resetDiv.textContent || '';
        const match = text.match(/(\d+)\s*次/);
        
        if (match) {
            result.count = parseInt(match[1]);
            result.found = true;
        } else {
            log('Failed to parse remaining resets from: ' + text);
        }

        return result;
    }

    function parseLastResetTime() {
        const resetSpan = findSpanByKeyword(CONFIG.RESET_KEYWORD);
        if (!resetSpan) {
            return null;
        }

        const parent = resetSpan.closest('div');
        if (!parent) {
            return null;
        }

        const text = parent.textContent || '';
        const match = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        
        if (match) {
            return match[1];
        }

        return null;
    }

    function parseTime(timeStr) {
        const parts = timeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (!parts) return null;

        return new Date(
            parseInt(parts[1]),
            parseInt(parts[2]) - 1,
            parseInt(parts[3]),
            parseInt(parts[4]),
            parseInt(parts[5]),
            parseInt(parts[6])
        );
    }

    function isNearMidnight() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        if (hour === CONFIG.NEAR_MIDNIGHT_HOUR && minute >= CONFIG.NEAR_MIDNIGHT_MINUTE) {
            return true;
        }
        if (hour === 23) {
            return true;
        }

        return false;
    }

    function calculateHoursSinceReset(timeStr) {
        if (!timeStr) return null;

        const lastResetTime = parseTime(timeStr);
        if (!lastResetTime) return null;

        const now = new Date();
        const diffMs = now - lastResetTime;
        return diffMs / (1000 * 60 * 60);
    }

    function determineResetAction() {
        const quota = parseQuotaStatus();
        const remaining = parseRemainingResets();
        const lastResetTime = parseLastResetTime();
        const hoursSinceReset = calculateHoursSinceReset(lastResetTime);
        const nearMidnight = isNearMidnight();

        const status = {
            currentQuota: quota.currentQuota,
            maxQuota: quota.maxQuota,
            isFull: quota.isFull,
            isDepleted: quota.isDepleted,
            remainingResets: remaining.count,
            lastResetTime: lastResetTime,
            hoursSinceReset: hoursSinceReset,
            isNearMidnight: nearMidnight,
            shouldReset: false,
            reason: ''
        };

        // Check 1: If quota is full, no need to reset
        if (quota.isFull) {
            status.reason = 'Quota is full ($' + quota.currentQuota + '/$' + quota.maxQuota + '), no need to reset';
            logStatus(status);
            return status;
        }

        // Check 2: If no remaining resets today, cannot reset
        if (remaining.count <= 0) {
            status.reason = 'No remaining resets today (0 times left)';
            logStatus(status);
            return status;
        }

        // Check 3: Near midnight - use remaining resets before day ends
        if (nearMidnight && remaining.count > 0) {
            status.shouldReset = true;
            status.reason = `Near midnight (after ${CONFIG.NEAR_MIDNIGHT_HOUR}:${CONFIG.NEAR_MIDNIGHT_MINUTE}) with ${remaining.count} remaining resets - using before day ends`;
            logStatus(status);
            return status;
        }

        // Check 4: Only reset if quota is depleted (0 or negative)
        if (quota.isDepleted) {
            status.shouldReset = true;
            status.reason = `Quota depleted ($${quota.currentQuota}), triggering reset`;
            logStatus(status);
            return status;
        }

        // Not depleted yet, wait
        status.reason = `Quota still available ($${quota.currentQuota}/$${quota.maxQuota}), waiting until depleted (<=0)`;
        logStatus(status);
        return status;
    }

    function clickConfirmButton() {
        let confirmBtn = findConfirmButtonByIcon(CONFIG.CONFIRM_ICON_CLASS);
        
        if (!confirmBtn) {
            confirmBtn = findButtonByKeyword(CONFIG.CONFIRM_KEYWORD, CONFIG.BUTTON_KEYWORD);
        }

        if (confirmBtn) {
            log('Found confirm button, clicking...');
            confirmBtn.click();
            return true;
        } else {
            log('Confirm button not found');
            return false;
        }
    }

    function clickResetButton() {
        const button = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
        if (button) {
            log('Found reset button, clicking...');
            button.click();

            setTimeout(function() {
                log('Waiting for confirm dialog...');
                clickConfirmButton();
            }, CONFIG.CONFIRM_DELAY);

            return true;
        } else {
            log('Reset button not found');
            return false;
        }
    }

    function checkAndReset() {
        log('Running scheduled check...');

        if (!window.location.pathname.includes(CONFIG.TARGET_PATH)) {
            log('Not on target page, redirecting to ' + CONFIG.TARGET_PATH);
            window.location.href = CONFIG.TARGET_PATH;
            return;
        }

        const status = determineResetAction();

        if (status.shouldReset) {
            log('Executing reset...');
            clickResetButton();
        }
    }

    function init() {
        log('Script initialized v2.1');
        log('Target path: ' + CONFIG.TARGET_PATH);
        log('Check interval: ' + (CONFIG.CHECK_INTERVAL / 1000) + ' seconds');
        log('Reset triggers:');
        log('  1. Quota depleted (<=0)');
        log('  2. Near midnight (' + CONFIG.NEAR_MIDNIGHT_HOUR + ':' + CONFIG.NEAR_MIDNIGHT_MINUTE + '+) with remaining resets');
        log('Will NOT reset if quota still available or no remaining resets');

        setTimeout(function() {
            checkAndReset();
        }, 3000);

        setInterval(checkAndReset, CONFIG.CHECK_INTERVAL);
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})();
