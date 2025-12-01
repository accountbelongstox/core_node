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
        HOURS_THRESHOLD: 4 + 1/60, // 4小时零1分钟（4.0167小时）
        RESET_KEYWORD: '上次重置',
        QUOTA_KEYWORD: '额度状态',
        REMAINING_KEYWORD: '今日剩余重置次数',
        BUTTON_KEYWORD: '重置额度',
        CONFIRM_KEYWORD: '重置',
        CONFIRM_DIALOG_KEYWORD: '重置', // 确认对话框中的重置按钮
        CONFIRM_ICON_CLASS: 'fa-redo',
        CONFIRM_DELAY: 1500,
        NEAR_MIDNIGHT_HOUR: 22,
        NEAR_MIDNIGHT_MINUTE: 54,
        NEAR_11PM_START_HOUR: 22,
        NEAR_11PM_START_MINUTE: 58,
        NEAR_11PM_END_HOUR: 22,
        NEAR_11PM_END_MINUTE: 59,
        NEAR_11PM_END_SECOND: 50,
        STORAGE_KEY: 'eecode_auto_reset_clicks',
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
        // 宽泛且严格的查找：不检查disabled状态
        const buttons = document.querySelectorAll('button');
        
        // 精确匹配：完全包含关键词
        for (let btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text.includes(keyword)) {
                if (excludeKeyword && text.includes(excludeKeyword)) {
                    continue;
                }
                return btn;
            }
        }
        
        // 通过属性查找：查找data-slot="button"的按钮
        const dataSlotButtons = document.querySelectorAll('button[data-slot="button"]');
        for (let btn of dataSlotButtons) {
            const text = (btn.textContent || '').trim();
            if (text.includes(keyword)) {
                if (excludeKeyword && text.includes(excludeKeyword)) {
                    continue;
                }
                return btn;
            }
        }
        
        return null;
    }

    function closeIntroDialog() {
        // 查找"关闭"按钮，优先查找data-slot="button"的按钮
        const closeButtons = document.querySelectorAll('button[data-slot="button"]');
        for (let btn of closeButtons) {
            const text = (btn.textContent || '').trim();
            if (text === '关闭' || text === '关闭' || text.includes('关闭')) {
                // 检查按钮是否可见
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0';
                
                if (isVisible) {
                    log('Found intro dialog close button, clicking...');
                    btn.click();
                    return true;
                }
            }
        }
        
        // 如果没找到，尝试查找所有包含"关闭"的按钮
        const allButtons = document.querySelectorAll('button');
        for (let btn of allButtons) {
            const text = (btn.textContent || '').trim();
            if (text === '关闭' || text.includes('关闭')) {
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0';
                
                if (isVisible) {
                    log('Found close button, clicking...');
                    btn.click();
                    return true;
                }
            }
        }
        
        return false;
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

        // 宽泛查找：先尝试通过关键词查找
        let quotaDiv = findDivByKeyword(CONFIG.QUOTA_KEYWORD);
        
        // 如果没找到，尝试查找包含"额度余额"的元素
        if (!quotaDiv) {
            quotaDiv = findElementByKeyword('额度余额', 'div');
        }
        
        // 如果还没找到，尝试查找包含"额度"的元素
        if (!quotaDiv) {
            quotaDiv = findElementByKeyword('额度', 'div');
        }
        
        // 如果还没找到，尝试查找包含余额格式的span
        if (!quotaDiv) {
            const spans = document.querySelectorAll('span');
            for (let span of spans) {
                const text = span.textContent || '';
                if (text.match(/\$\s*-?\d+(?:\.\d+)?\s*\/\s*\$\s*\d+(?:\.\d+)?/)) {
                    quotaDiv = span.closest('div');
                    if (quotaDiv) break;
                }
            }
        }
        
        if (!quotaDiv) {
            log('Quota status div not found');
            return result;
        }

        // 查找包含余额格式的文本（可能在div内部任何地方）
        const text = quotaDiv.textContent || '';
        
        // Match patterns like "$50 / $50", "$-0.5 / $50", "$ 30.5 / $ 50", "$-0.02194605 / $50"
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
            found: false,
            lastResetTime: null,
            nextResetTime: null
        };

        // 先尝试查找包含"今日剩余"和"上次重置"的span
        const spans = document.querySelectorAll('span.text-xs.text-muted-foreground, span');
        for (let span of spans) {
            const text = span.textContent || '';
            if (text.includes('今日剩余') && text.includes('上次重置')) {
                // 解析"今日剩余 X 次"
                const countMatch = text.match(/今日剩余\s*(\d+)\s*次/);
                if (countMatch) {
                    result.count = parseInt(countMatch[1]);
                }
                
                // 解析"上次重置: 12/01 13:44" 或 "上次重置: 12/01 13:44:00"
                const timeMatch = text.match(/上次重置[：:]\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
                if (timeMatch) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = parseInt(timeMatch[1]) - 1; // 月份从0开始
                    const day = parseInt(timeMatch[2]);
                    const hour = parseInt(timeMatch[3]);
                    const minute = parseInt(timeMatch[4]);
                    const second = timeMatch[5] ? parseInt(timeMatch[5]) : 0;
                    
                    // 创建上次重置时间
                    let lastReset = new Date(year, month, day, hour, minute, second);
                    
                    // 如果日期是未来的（可能是去年的），调整为去年
                    if (lastReset > now) {
                        lastReset = new Date(year - 1, month, day, hour, minute, second);
                    }
                    
                    result.lastResetTime = lastReset;
                    
                    // 计算下次重置时间（24小时后）
                    result.nextResetTime = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
                    
                    result.found = true;
                    log(`Parsed: 今日剩余 ${result.count} 次, 上次重置: ${lastReset.toLocaleString()}, 下次重置: ${result.nextResetTime.toLocaleString()}`);
                }
                
                if (result.count !== undefined || result.lastResetTime) {
                    result.found = true;
                }
                break;
            }
        }
        
        // 如果没找到，尝试原来的方法
        if (!result.found) {
            const resetDiv = findDivByKeyword(CONFIG.REMAINING_KEYWORD);
            if (resetDiv) {
                const text = resetDiv.textContent || '';
                const match = text.match(/(\d+)\s*次/);
                if (match) {
                    result.count = parseInt(match[1]);
                    result.found = true;
                }
            }
        }

        return result;
    }

    function parseLastResetTime() {
        // 先尝试从包含"今日剩余"和"上次重置"的span中解析
        const spans = document.querySelectorAll('span.text-xs.text-muted-foreground, span');
        for (let span of spans) {
            const text = span.textContent || '';
            if (text.includes('上次重置')) {
                // 解析"上次重置: 12/01 13:44" 或 "上次重置: 12/01 13:44:00"
                // 格式可能是 月/日 或 日/月，需要根据当前系统时间判断
                const timeMatch = text.match(/上次重置[：:]\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
                if (timeMatch) {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth() + 1; // 1-12
                    const currentDay = now.getDate();
                    
                    const num1 = parseInt(timeMatch[1]);
                    const num2 = parseInt(timeMatch[2]);
                    const hour = parseInt(timeMatch[3]);
                    const minute = parseInt(timeMatch[4]);
                    const second = timeMatch[5] ? parseInt(timeMatch[5]) : 0;
                    
                    // 判断是 月/日 还是 日/月 格式
                    // 如果第一个数字 > 12，肯定是日/月格式
                    // 如果第二个数字 > 12，肯定是月/日格式
                    // 否则，尝试两种格式，选择更接近当前日期的那个
                    let month, day;
                    
                    if (num1 > 12) {
                        // 第一个数字 > 12，肯定是日/月格式
                        day = num1;
                        month = num2;
                    } else if (num2 > 12) {
                        // 第二个数字 > 12，肯定是月/日格式
                        month = num1;
                        day = num2;
                    } else {
                        // 两个数字都 <= 12，需要判断
                        // 尝试月/日格式
                        const try1 = new Date(currentYear, num1 - 1, num2, hour, minute, second);
                        // 尝试日/月格式
                        const try2 = new Date(currentYear, num2 - 1, num1, hour, minute, second);
                        
                        // 选择更接近当前日期的那个（但不能是未来日期）
                        const diff1 = Math.abs(try1 - now);
                        const diff2 = Math.abs(try2 - now);
                        
                        // 如果一个是未来日期，选择另一个
                        if (try1 > now && try2 <= now) {
                            day = num1;
                            month = num2;
                        } else if (try2 > now && try1 <= now) {
                            month = num1;
                            day = num2;
                        } else {
                            // 选择更接近的
                            if (diff1 <= diff2) {
                                month = num1;
                                day = num2;
                            } else {
                                day = num1;
                                month = num2;
                            }
                        }
                    }
                    
                    // 创建上次重置时间
                    let lastReset = new Date(currentYear, month - 1, day, hour, minute, second);
                    
                    // 如果日期是未来的（可能是上个月的），调整为上个月
                    if (lastReset > now) {
                        lastReset = new Date(currentYear, month - 2, day, hour, minute, second);
                        // 如果还是未来，可能是去年的
                        if (lastReset > now) {
                            lastReset = new Date(currentYear - 1, month - 1, day, hour, minute, second);
                        }
                    }
                    
                    // 调试日志
                    log(`Parsed last reset time: ${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`);
                    log(`Current system time: ${now.toLocaleString('zh-CN')}`);
                    log(`Last reset time object: ${lastReset.toLocaleString('zh-CN')}`);
                    
                    // 返回格式化的时间字符串
                    return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
                }
            }
        }
        
        // 如果没找到，尝试原来的方法
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

    function isNear11PM() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const second = now.getSeconds();

        // 检查是否在10:58:00到10:59:50之间
        if (hour === CONFIG.NEAR_11PM_START_HOUR && minute >= CONFIG.NEAR_11PM_START_MINUTE) {
            if (minute < CONFIG.NEAR_11PM_END_MINUTE) {
                return true; // 10:58:xx 到 10:58:59
            }
            if (minute === CONFIG.NEAR_11PM_END_MINUTE && second < CONFIG.NEAR_11PM_END_SECOND) {
                return true; // 10:59:00 到 10:59:49
            }
        }

        return false;
    }

    function recordSuccessfulClick() {
        try {
            const clicks = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            const clickRecord = {
                timestamp: new Date().toISOString(),
                time: new Date().toLocaleString('zh-CN')
            };
            clicks.push(clickRecord);
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(clicks));
            log(`Recorded successful click #${clicks.length} at ${clickRecord.time}`);
            return clicks.length;
        } catch (e) {
            log('Error recording click: ' + e.message);
            return 0;
        }
    }

    function getTotalClicks() {
        try {
            const clicks = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            return clicks.length;
        } catch (e) {
            return 0;
        }
    }

    function calculateHoursSinceReset(timeStr) {
        if (!timeStr) return null;

        const lastResetTime = parseTime(timeStr);
        if (!lastResetTime) return null;

        const now = new Date();
        const diffMs = now - lastResetTime;
        const hours = diffMs / (1000 * 60 * 60);
        
        // 调试日志
        log(`Time calculation:`);
        log(`  Last reset: ${lastResetTime.toLocaleString('zh-CN')}`);
        log(`  Current time: ${now.toLocaleString('zh-CN')}`);
        log(`  Difference: ${hours.toFixed(4)} hours (${(hours * 60).toFixed(2)} minutes)`);
        log(`  Threshold: ${CONFIG.HOURS_THRESHOLD.toFixed(4)} hours (${(CONFIG.HOURS_THRESHOLD * 60).toFixed(2)} minutes)`);
        
        return hours;
    }

    function determineResetAction() {
        const quota = parseQuotaStatus();
        const remaining = parseRemainingResets();
        const lastResetTime = parseLastResetTime();
        const hoursSinceReset = calculateHoursSinceReset(lastResetTime);
        const nearMidnight = isNearMidnight();
        const near11PM = isNear11PM();

        const status = {
            currentQuota: quota.currentQuota,
            maxQuota: quota.maxQuota,
            isFull: quota.isFull,
            isDepleted: quota.isDepleted,
            remainingResets: remaining.count,
            lastResetTime: lastResetTime,
            hoursSinceReset: hoursSinceReset,
            isNearMidnight: nearMidnight,
            isNear11PM: near11PM,
            shouldReset: false,
            reason: ''
        };

        // Check 1: If no remaining resets today, cannot reset
        if (remaining.count <= 0) {
            status.reason = 'No remaining resets today (0 times left)';
            logStatus(status);
            return status;
        }

        // Check 2: 临近11点且还有剩余次数，直接点击（10:58-10:59:50）
        if (near11PM && remaining.count > 0) {
            status.shouldReset = true;
            status.reason = `Near 11PM (10:58-10:59:50) with ${remaining.count} remaining resets, triggering reset`;
            logStatus(status);
            return status;
        }

        // Check 3: 只要满4小时就重置（主要逻辑）
        if (hoursSinceReset !== null && hoursSinceReset >= CONFIG.HOURS_THRESHOLD) {
            status.shouldReset = true;
            status.reason = `Hours since reset (${hoursSinceReset.toFixed(2)}) >= ${CONFIG.HOURS_THRESHOLD} hours, triggering reset`;
            logStatus(status);
            return status;
        }

        // Check 4: If quota is full, no need to reset
        if (quota.isFull) {
            status.reason = 'Quota is full ($' + quota.currentQuota + '/$' + quota.maxQuota + '), no need to reset';
            logStatus(status);
            return status;
        }

        // Not time yet, wait
        if (hoursSinceReset !== null) {
            const remainingHours = CONFIG.HOURS_THRESHOLD - hoursSinceReset;
            status.reason = `Hours since reset (${hoursSinceReset.toFixed(2)}) < ${CONFIG.HOURS_THRESHOLD} hours, waiting ${remainingHours.toFixed(2)} more hours`;
        } else {
            status.reason = 'Last reset time not found, waiting...';
        }
        logStatus(status);
        return status;
    }

    function findTopmostConfirmDialog() {
        // 查找所有可能包含"重置"的对话框按钮（确认对话框中的重置按钮）
        const confirmButtons = [];
        
        // 先查找所有包含"重置"的按钮，但要排除主重置按钮（通过排除"重置额度"来区分）
        const allButtons = document.querySelectorAll('button');
        for (let btn of allButtons) {
            const text = (btn.textContent || '').trim();
            // 查找文本为"重置"的按钮（不是"重置额度"）
            if (text === '重置' || (text.includes('重置') && !text.includes('额度'))) {
                // 检查按钮是否在可见的对话框中
                let dialog = btn.closest('div[role="dialog"], div[class*="dialog"], div[class*="modal"], div[class*="popup"]');
                
                // 检查按钮本身是否可见
                const rect = btn.getBoundingClientRect();
                const btnStyle = window.getComputedStyle(btn);
                const isBtnVisible = rect.width > 0 && rect.height > 0 && 
                                    btnStyle.display !== 'none' &&
                                    btnStyle.visibility !== 'hidden' &&
                                    btnStyle.opacity !== '0';
                
                if (!isBtnVisible) {
                    continue;
                }
                
                if (dialog) {
                    // 检查对话框是否可见
                    const dialogRect = dialog.getBoundingClientRect();
                    const dialogStyle = window.getComputedStyle(dialog);
                    const isDialogVisible = dialogRect.width > 0 && dialogRect.height > 0 &&
                                          dialogStyle.display !== 'none' &&
                                          dialogStyle.visibility !== 'hidden';
                    if (isDialogVisible) {
                        const zIndex = parseInt(dialogStyle.zIndex) || 0;
                        confirmButtons.push({
                            button: btn,
                            zIndex: zIndex,
                            rect: dialogRect,
                            dialog: dialog
                        });
                    }
                } else {
                    // 按钮不在对话框中，但可能是弹出的确认按钮
                    // 检查按钮是否有特定的样式（确认对话框中的重置按钮通常有bg-destructive样式）
                    const hasDestructiveStyle = btnStyle.backgroundColor && 
                                                (btn.className.includes('destructive') || 
                                                 btn.className.includes('bg-destructive'));
                    if (hasDestructiveStyle) {
                        confirmButtons.push({
                            button: btn,
                            zIndex: 9999, // 给高优先级
                            rect: rect
                        });
                    }
                }
            }
        }
        
        // 按z-index排序，找到最顶层的
        if (confirmButtons.length > 0) {
            confirmButtons.sort((a, b) => {
                // 先按z-index排序
                if (a.zIndex !== b.zIndex) {
                    return b.zIndex - a.zIndex;
                }
                // 如果z-index相同，按位置排序（更靠上的优先）
                return a.rect.top - b.rect.top;
            });
            return confirmButtons[0].button;
        }
        
        // 如果没找到，尝试查找包含"确认"、"确定"的按钮
        for (let btn of allButtons) {
            const text = (btn.textContent || '').trim();
            if (text.includes('确认') || text.includes('确定') || text.includes('OK')) {
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                const isVisible = rect.width > 0 && rect.height > 0 && 
                                style.display !== 'none' &&
                                style.visibility !== 'hidden';
                if (isVisible) {
                    return btn;
                }
            }
        }
        
        // 如果没找到，尝试原来的方法
        let confirmBtn = findConfirmButtonByIcon(CONFIG.CONFIRM_ICON_CLASS);
        if (!confirmBtn) {
            // 最后尝试查找"重置"按钮（排除"重置额度"）
            confirmBtn = findButtonByKeyword('重置', '额度');
        }
        
        return confirmBtn;
    }

    function clickConfirmButton() {
        const confirmBtn = findTopmostConfirmDialog();
        if (confirmBtn) {
            log('Found confirm button, clicking...');
            confirmBtn.click();
            return true;
        } else {
            log('Confirm button not found');
            return false;
        }
    }

    function clickAllConfirmDialogs() {
        let clicked = false;
        let attempts = 0;
        const maxAttempts = 10; // 最多尝试10次，防止无限循环
        
        while (attempts < maxAttempts) {
            const confirmBtn = findTopmostConfirmDialog();
            if (confirmBtn) {
                log(`Found confirm dialog (attempt ${attempts + 1}), clicking...`);
                confirmBtn.click();
                clicked = true;
                attempts++;
                
                // 等待一下，让对话框消失或新对话框出现
                // 这里不等待，立即继续查找下一个
            } else {
                break; // 没有找到更多确认对话框
            }
        }
        
        if (clicked) {
            log(`Clicked ${attempts} confirm dialog(s)`);
        }
        
        return clicked;
    }

    function clickResetButton() {
        const button = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
        if (button) {
            log('Found reset button, clicking...');
            button.click();

            // 等待对话框出现，然后循环点击所有确认对话框
            setTimeout(function() {
                log('Waiting for confirm dialog...');
                // 循环点击所有确认对话框，直到没有为止
                let hasMore = true;
                let attempts = 0;
                const maxAttempts = 10;
                
                const clickLoop = function() {
                    if (attempts >= maxAttempts) {
                        log('Max attempts reached, stopping confirm dialog loop');
                        // 如果所有确认对话框都点击完了，记录成功点击
                        recordSuccessfulClick();
                        return;
                    }
                    
                    attempts++;
                    const clicked = clickAllConfirmDialogs();
                    
                    if (clicked) {
                        // 如果点击了，再等一会儿继续查找
                        setTimeout(clickLoop, CONFIG.CONFIRM_DELAY);
                    } else {
                        log('No more confirm dialogs found');
                        // 所有确认对话框都点击完了，记录成功点击
                        recordSuccessfulClick();
                    }
                };
                
                // 开始循环点击
                setTimeout(clickLoop, CONFIG.CONFIRM_DELAY);
            }, CONFIG.CONFIRM_DELAY);

            return true;
        } else {
            log('Reset button not found');
            return false;
        }
    }

    function refreshAndClick() {
        log('Refreshing page before clicking reset button...');
        updateStatusMessage('正在刷新页面...');
        
        // 刷新页面
        window.location.reload();
    }

    // 检查是否刚刷新完页面
    let isPageJustRefreshed = false;
    const refreshFlag = sessionStorage.getItem('eecode_auto_reset_refresh');
    if (refreshFlag === 'true') {
        isPageJustRefreshed = true;
        sessionStorage.removeItem('eecode_auto_reset_refresh');
    }

    // 临近11点的持续点击定时器
    let near11PMInterval = null;

    function checkAndReset() {
        log('Running scheduled check...');
        updateStatusMessage('正在检查...');

        if (!window.location.pathname.includes(CONFIG.TARGET_PATH)) {
            log('Not on target page, redirecting to ' + CONFIG.TARGET_PATH);
            updateStatusMessage('正在跳转到目标页面...');
            window.location.href = CONFIG.TARGET_PATH;
            return;
        }

        // 更新UI
        updateUI();

        // 如果刚刷新完页面，直接尝试点击按钮
        if (isPageJustRefreshed) {
            log('Page just refreshed, attempting to click reset button...');
            updateStatusMessage('页面已刷新，正在点击重置按钮...');
            isPageJustRefreshed = false;
            
            setTimeout(function() {
                const clicked = clickResetButton();
                if (clicked) {
                    updateStatusMessage('已点击重置按钮，等待确认...');
                } else {
                    updateStatusMessage('未找到重置按钮');
                }
            }, 2000); // 等待页面完全加载
            
            return;
        }

        const status = determineResetAction();
        const near11PM = isNear11PM();
        const remaining = parseRemainingResets();

        // 处理临近11点的持续点击逻辑
        if (near11PM && remaining.count > 0) {
            // 如果还没有启动持续点击，则启动
            if (!near11PMInterval) {
                log('Near 11PM detected, starting continuous click attempts...');
                updateStatusMessage('临近11点，持续尝试点击中...');
                
                // 立即尝试一次
                setTimeout(function() {
                    const clicked = clickResetButton();
                    if (clicked) {
                        updateStatusMessage('已点击重置按钮（临近11点模式）...');
                    }
                }, 500);
                
                // 每2秒尝试一次，直到10:59:50
                near11PMInterval = setInterval(function() {
                    // 检查是否还在时间范围内
                    if (!isNear11PM()) {
                        log('Past 10:59:50, stopping continuous click attempts');
                        clearInterval(near11PMInterval);
                        near11PMInterval = null;
                        updateStatusMessage('已过10:59:50，停止持续点击');
                        return;
                    }
                    
                    // 检查是否还有剩余次数
                    const remainingCheck = parseRemainingResets();
                    if (remainingCheck.count <= 0) {
                        log('No remaining resets, stopping continuous click attempts');
                        clearInterval(near11PMInterval);
                        near11PMInterval = null;
                        updateStatusMessage('无剩余次数，停止持续点击');
                        return;
                    }
                    
                    // 尝试点击
                    const clicked = clickResetButton();
                    if (clicked) {
                        log('Clicked reset button (near 11PM mode)');
                        updateStatusMessage('已点击重置按钮（临近11点模式）...');
                    }
                }, 2000); // 每2秒尝试一次
            }
        } else {
            // 如果不在临近11点的时间，停止持续点击
            if (near11PMInterval) {
                log('No longer near 11PM, stopping continuous click attempts');
                clearInterval(near11PMInterval);
                near11PMInterval = null;
            }
        }

        if (status.shouldReset) {
            // 如果是临近11点的重置，不需要刷新页面，直接点击
            if (near11PM && remaining.count > 0) {
                log('Near 11PM reset - clicking directly without refresh');
                updateStatusMessage('临近11点，直接点击重置按钮...');
                
                setTimeout(function() {
                    const clicked = clickResetButton();
                    if (clicked) {
                        updateStatusMessage('已点击重置按钮（临近11点模式）...');
                    } else {
                        updateStatusMessage('未找到重置按钮');
                    }
                }, 500);
            } else {
                // 正常4小时重置逻辑：刷新页面
                log('Executing reset - refreshing page first...');
                updateStatusMessage('需要重置，正在刷新页面...');
                
                // 设置刷新标志
                sessionStorage.setItem('eecode_auto_reset_refresh', 'true');
                
                // 刷新页面
                setTimeout(function() {
                    window.location.reload();
                }, 1000);
            }
        } else {
            if (!near11PM) {
                updateStatusMessage(status.reason || '等待条件满足...');
            }
        }
    }

    // UI显示
    let uiElement = null;
    let countdownInterval = null;
    let nextCheckTime = null;
    let nextResetTime = null;

    function createUI() {
        // 移除旧的UI
        if (uiElement) {
            uiElement.remove();
        }

        // 创建UI容器
        uiElement = document.createElement('div');
        uiElement.id = 'eecode-auto-reset-ui';
        uiElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            min-width: 280px;
        `;

        // 创建内容
        const content = document.createElement('div');
        content.innerHTML = `
            <div style="margin-bottom: 12px; font-weight: 600; color: #1f2937;">88code Auto Reset</div>
            <div class="flex justify-between items-center" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="text-muted-foreground" style="color: #6b7280;">额度余额:</span>
                <span id="quota-display" class="text-red-500 font-medium" style="color: #ef4444; font-weight: 500;">加载中...</span>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">下次检查倒计时:</div>
                <div id="countdown-display" style="color: #1f2937; font-weight: 600; font-size: 16px;">--:--</div>
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

        uiElement.appendChild(content);
        document.body.appendChild(uiElement);

        updateUI();
    }

    function updateUI() {
        if (!uiElement) return;

        // 更新额度显示
        const quota = parseQuotaStatus();
        const quotaDisplay = uiElement.querySelector('#quota-display');
        if (quotaDisplay) {
            if (quota.found) {
                const color = quota.isDepleted ? '#ef4444' : (quota.isFull ? '#10b981' : '#f59e0b');
                quotaDisplay.textContent = `$${quota.currentQuota} / $${quota.maxQuota}`;
                quotaDisplay.style.color = color;
            } else {
                quotaDisplay.textContent = '未找到';
                quotaDisplay.style.color = '#6b7280';
            }
        }

        // 更新按钮状态
        const button = findButtonByKeyword(CONFIG.BUTTON_KEYWORD);
        const buttonStatus = uiElement.querySelector('#button-status');
        if (buttonStatus) {
            if (button) {
                buttonStatus.textContent = '已找到';
                buttonStatus.style.color = '#10b981';
            } else {
                buttonStatus.textContent = '未找到';
                buttonStatus.style.color = '#ef4444';
            }
        }

        // 更新倒计时
        updateCountdown();
        updateNextResetTime();
        updateTimeToReset();
        
        // 更新总点击次数
        const totalClicksDisplay = uiElement.querySelector('#total-clicks-display');
        if (totalClicksDisplay) {
            const totalClicks = getTotalClicks();
            totalClicksDisplay.textContent = totalClicks.toString();
        }
    }

    function updateCountdown() {
        if (!uiElement || !nextCheckTime) return;

        const countdownDisplay = uiElement.querySelector('#countdown-display');
        if (!countdownDisplay) return;

        const now = new Date();
        const diff = nextCheckTime - now;

        if (diff <= 0) {
            countdownDisplay.textContent = '00:00';
            nextCheckTime = new Date(now.getTime() + CONFIG.CHECK_INTERVAL);
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        countdownDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateNextResetTime() {
        if (!uiElement) return;

        const nextResetTimeDisplay = uiElement.querySelector('#next-reset-time-display');
        if (!nextResetTimeDisplay) return;

        // 通过上次重置时间计算下次重置时间（上次重置 + 4小时）
        const lastResetTime = parseLastResetTime();
        if (lastResetTime) {
            const lastReset = parseTime(lastResetTime);
            if (lastReset) {
                const nextReset = new Date(lastReset.getTime() + CONFIG.HOURS_THRESHOLD * 60 * 60 * 1000);
                
                // 显示格式：HH:MM:SS（小时:分钟:秒），小时范围是0-23
                const hours = nextReset.getHours(); // 0-23
                const minutes = nextReset.getMinutes(); // 0-59
                const seconds = nextReset.getSeconds(); // 0-59
                
                // 确保是两位数格式
                const hoursStr = String(hours).padStart(2, '0');
                const minutesStr = String(minutes).padStart(2, '0');
                const secondsStr = String(seconds).padStart(2, '0');
                
                // 显示格式：HH:MM:SS（例如：17:44:00 表示下午5点44分0秒）
                nextResetTimeDisplay.textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;
                
                const now = new Date();
                const diff = nextReset - now;
                
                // 如果已经过了重置时间，显示为可重置
                if (diff <= 0) {
                    nextResetTimeDisplay.style.color = '#10b981';
                    nextResetTimeDisplay.textContent = `${hoursStr}:${minutesStr}:${secondsStr} (可重置)`;
                } else if (diff < 60 * 60 * 1000) {
                    // 如果剩余时间少于1小时，显示红色警告
                    nextResetTimeDisplay.style.color = '#ef4444';
                } else if (diff < 3 * 60 * 60 * 1000) {
                    nextResetTimeDisplay.style.color = '#f59e0b';
                } else {
                    nextResetTimeDisplay.style.color = '#1f2937';
                }
                
                // 调试日志
                log(`Next reset time: ${hoursStr}:${minutesStr}:${secondsStr} (${hours}小时${minutes}分钟${seconds}秒)`);
            } else {
                nextResetTimeDisplay.textContent = '--:--:--';
                nextResetTimeDisplay.style.color = '#6b7280';
            }
        } else {
            nextResetTimeDisplay.textContent = '--:--:--';
            nextResetTimeDisplay.style.color = '#6b7280';
        }
    }

    function updateTimeToReset() {
        if (!uiElement) return;

        const timeToResetDisplay = uiElement.querySelector('#time-to-reset-display');
        if (!timeToResetDisplay) return;

        // 通过上次重置时间计算下次重置时间（上次重置 + 4小时零1分钟）
        const lastResetTime = parseLastResetTime();
        if (lastResetTime) {
            const lastReset = parseTime(lastResetTime);
            if (lastReset) {
                const nextReset = new Date(lastReset.getTime() + CONFIG.HOURS_THRESHOLD * 60 * 60 * 1000);
                const now = new Date();
                const diff = nextReset - now;
                
                if (diff <= 0) {
                    // 已经可以重置了
                    timeToResetDisplay.textContent = '00:00:00 (可点击)';
                    timeToResetDisplay.style.color = '#10b981';
                } else {
                    // 计算剩余时间
                    const totalSeconds = Math.floor(diff / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    
                    // 格式化显示：HH:MM:SS
                    const hoursStr = String(hours).padStart(2, '0');
                    const minutesStr = String(minutes).padStart(2, '0');
                    const secondsStr = String(seconds).padStart(2, '0');
                    
                    timeToResetDisplay.textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;
                    
                    // 根据剩余时间设置颜色
                    if (diff < 60 * 60 * 1000) {
                        // 少于1小时，显示红色
                        timeToResetDisplay.style.color = '#ef4444';
                    } else if (diff < 3 * 60 * 60 * 1000) {
                        // 少于3小时，显示橙色
                        timeToResetDisplay.style.color = '#f59e0b';
                    } else {
                        // 正常显示
                        timeToResetDisplay.style.color = '#1f2937';
                    }
                }
            } else {
                timeToResetDisplay.textContent = '--:--:--';
                timeToResetDisplay.style.color = '#6b7280';
            }
        } else {
            timeToResetDisplay.textContent = '--:--:--';
            timeToResetDisplay.style.color = '#6b7280';
        }
    }

    function updateStatusMessage(message) {
        if (!uiElement) return;
        const statusMessage = uiElement.querySelector('#status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
        }
    }

    function closeIntroDialog() {
        // 查找"关闭"按钮，优先查找data-slot="button"的按钮
        const closeButtons = document.querySelectorAll('button[data-slot="button"]');
        for (let btn of closeButtons) {
            const text = (btn.textContent || '').trim();
            if (text === '关闭' || text.includes('关闭')) {
                // 检查按钮是否可见
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0';
                
                if (isVisible) {
                    log('Found intro dialog close button, clicking...');
                    btn.click();
                    return true;
                }
            }
        }
        
        // 如果没找到，尝试查找所有包含"关闭"的按钮
        const allButtons = document.querySelectorAll('button');
        for (let btn of allButtons) {
            const text = (btn.textContent || '').trim();
            if (text === '关闭' || text.includes('关闭')) {
                const rect = btn.getBoundingClientRect();
                const style = window.getComputedStyle(btn);
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0';
                
                if (isVisible) {
                    log('Found close button, clicking...');
                    btn.click();
                    return true;
                }
            }
        }
        
        return false;
    }

    function init() {
        log('Script initialized v2.3');
        log('Target path: ' + CONFIG.TARGET_PATH);
        log('Check interval: ' + (CONFIG.CHECK_INTERVAL / 1000) + ' seconds');
        log('Reset triggers:');
        log('  1. Hours since reset >= ' + CONFIG.HOURS_THRESHOLD + ' hours');
        log('Will NOT reset if no remaining resets today');

        // 初次打开时关闭介绍弹窗
        setTimeout(function() {
            closeIntroDialog();
        }, 500);

        // 再次尝试关闭（有些弹窗可能延迟出现）
        setTimeout(function() {
            closeIntroDialog();
        }, 2000);

        // 创建UI
        createUI();

        // 启动倒计时更新
        nextCheckTime = new Date(Date.now() + CONFIG.CHECK_INTERVAL);
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        countdownInterval = setInterval(function() {
            updateCountdown();
            updateNextResetTime();
            updateTimeToReset();
        }, 1000);

        // 定期更新UI
        setInterval(updateUI, 5000);

        setTimeout(function() {
            checkAndReset();
        }, 3000);

        setInterval(function() {
            nextCheckTime = new Date(Date.now() + CONFIG.CHECK_INTERVAL);
            checkAndReset();
        }, CONFIG.CHECK_INTERVAL);
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})();
