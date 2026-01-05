// ==UserScript==
// @name         抖音搜索自动化
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动在抖音搜索框输入"星灿传媒"并搜索
// @author       You
// @match        *://*.douyin.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 协议脚本测试函数
    function runScriptTest() {
        const testResults = [];
        
        // 测试1: 检查页面环境
        testResults.push({
            name: '页面环境检查',
            status: typeof window !== 'undefined' && typeof document !== 'undefined' ? '✓ 通过' : '✗ 失败',
            details: `Window: ${typeof window}, Document: ${typeof document}`
        });

        // 测试2: 检查搜索框元素是否存在
        const searchInput = document.querySelector('[data-e2e="searchbar-input"]');
        testResults.push({
            name: '搜索框元素查找',
            status: searchInput ? '✓ 通过' : '✗ 未找到',
            details: searchInput ? `找到元素: ${searchInput.tagName}` : '未找到 [data-e2e="searchbar-input"]'
        });

        // 测试3: 检查事件创建能力
        try {
            const testEvent = new KeyboardEvent('keydown', { key: 'Test' });
            testResults.push({
                name: '事件创建能力',
                status: '✓ 通过',
                details: 'KeyboardEvent 创建成功'
            });
        } catch (e) {
            testResults.push({
                name: '事件创建能力',
                status: '✗ 失败',
                details: `错误: ${e.message}`
            });
        }

        // 测试4: 检查DOM操作能力
        try {
            const testDiv = document.createElement('div');
            testDiv.style.display = 'none';
            document.body.appendChild(testDiv);
            document.body.removeChild(testDiv);
            testResults.push({
                name: 'DOM操作能力',
                status: '✓ 通过',
                details: 'DOM 创建和删除成功'
            });
        } catch (e) {
            testResults.push({
                name: 'DOM操作能力',
                status: '✗ 失败',
                details: `错误: ${e.message}`
            });
        }

        // 测试5: 检查脚本函数（通过尝试调用验证）
        let functionTestStatus = '✓ 通过';
        let functionTestDetails = '核心函数可用';
        try {
            // 尝试创建测试元素来验证函数可用性
            const testElement = document.createElement('input');
            testElement.type = 'text';
            testElement.value = '';
            document.body.appendChild(testElement);
            
            // 验证基本功能
            if (typeof testElement.dispatchEvent === 'function') {
                const testEvent = new KeyboardEvent('keydown', { key: 'a' });
                testElement.dispatchEvent(testEvent);
            }
            
            document.body.removeChild(testElement);
        } catch (e) {
            functionTestStatus = '✗ 失败';
            functionTestDetails = `错误: ${e.message}`;
        }
        testResults.push({
            name: '脚本函数检查',
            status: functionTestStatus,
            details: functionTestDetails
        });

        // 测试6: 检查页面URL
        testResults.push({
            name: '页面URL检查',
            status: location.href.includes('douyin.com') ? '✓ 通过' : '⚠ 警告',
            details: `当前URL: ${location.href}`
        });

        // 测试7: 检查页面加载状态
        testResults.push({
            name: '页面加载状态',
            status: document.readyState === 'complete' ? '✓ 完成' : '⚠ 加载中',
            details: `状态: ${document.readyState}`
        });

        // 测试8: 检查Tampermonkey环境
        const isTampermonkey = typeof GM_info !== 'undefined' || typeof GM !== 'undefined';
        testResults.push({
            name: 'Tampermonkey环境',
            status: isTampermonkey ? '✓ 检测到' : '⚠ 未检测到',
            details: isTampermonkey ? '运行在Tampermonkey环境中' : '可能运行在其他环境或直接注入'
        });

        // 测试9: 检查CSP限制
        try {
            const testStyle = document.createElement('style');
            testStyle.textContent = 'body { color: red; }';
            document.head.appendChild(testStyle);
            document.head.removeChild(testStyle);
            testResults.push({
                name: 'CSP限制检查',
                status: '✓ 无限制',
                details: '可以正常创建和操作style元素'
            });
        } catch (e) {
            testResults.push({
                name: 'CSP限制检查',
                status: '⚠ 有限制',
                details: `可能受到CSP限制: ${e.message}`
            });
        }

        // 测试10: 检查搜索框交互能力
        if (searchInput) {
            const canInteract = !searchInput.disabled && 
                               searchInput.offsetParent !== null &&
                               window.getComputedStyle(searchInput).display !== 'none';
            testResults.push({
                name: '搜索框交互能力',
                status: canInteract ? '✓ 可交互' : '⚠ 不可交互',
                details: canInteract 
                    ? '搜索框可见且可操作' 
                    : '搜索框可能被隐藏或禁用'
            });
        } else {
            testResults.push({
                name: '搜索框交互能力',
                status: '✗ 无法测试',
                details: '搜索框不存在，无法测试'
            });
        }

        // 格式化测试结果
        let resultHtml = '<div style="text-align: left; font-family: monospace; font-size: 12px;">';
        resultHtml += '<strong style="color: #333; font-size: 14px;">协议脚本测试结果：</strong><br><br>';
        
        testResults.forEach((test, index) => {
            const statusColor = test.status.includes('✓') ? '#28a745' : 
                               test.status.includes('✗') ? '#dc3545' : '#ffc107';
            resultHtml += `<div style="margin-bottom: 12px; padding: 8px; background: #f8f9fa; border-radius: 4px;">`;
            resultHtml += `<strong style="color: ${statusColor};">[${index + 1}] ${test.name}:</strong> ${test.status}<br>`;
            resultHtml += `<span style="color: #666; font-size: 11px;">${test.details}</span>`;
            resultHtml += `</div>`;
        });
        
        resultHtml += '</div>';
        
        return resultHtml;
    }

    // 自定义HTML Alert弹窗
    function showCustomAlert(message, title = '提示', showTestButton = false) {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        `;

        // 创建弹窗容器
        const alertBox = document.createElement('div');
        alertBox.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        `;

        // 添加动画样式
        if (!document.getElementById('custom-alert-styles')) {
            const style = document.createElement('style');
            style.id = 'custom-alert-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateY(-50px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // 创建标题
        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = `
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            color: #333;
        `;

        // 创建消息内容
        const messageEl = document.createElement('div');
        messageEl.innerHTML = message;
        messageEl.style.cssText = `
            margin: 0 0 20px 0;
            font-size: 14px;
            color: #666;
            line-height: 1.6;
            max-height: 400px;
            overflow-y: auto;
            word-wrap: break-word;
        `;

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            flex-direction: column;
        `;

        // 创建测试按钮（如果启用）
        let testButton = null;
        if (showTestButton) {
            testButton = document.createElement('button');
            testButton.textContent = '协议脚本测试';
            testButton.style.cssText = `
                background: #28a745;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px 24px;
                font-size: 14px;
                cursor: pointer;
                width: 100%;
                transition: background 0.2s;
                margin-bottom: 10px;
            `;

            testButton.onmouseover = () => testButton.style.background = '#218838';
            testButton.onmouseout = () => testButton.style.background = '#28a745';

            testButton.onclick = () => {
                const testResult = runScriptTest();
                messageEl.innerHTML = testResult;
                messageEl.scrollTop = 0;
            };

            buttonContainer.appendChild(testButton);
        }

        // 创建确定按钮
        const button = document.createElement('button');
        button.textContent = '确定';
        button.style.cssText = `
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 10px 24px;
            font-size: 14px;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
        `;

        button.onmouseover = () => button.style.background = '#0056CC';
        button.onmouseout = () => button.style.background = '#007AFF';

        // 关闭弹窗函数
        const closeAlert = () => {
            overlay.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        };

        button.onclick = closeAlert;
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeAlert();
            }
        };

        // 组装元素
        alertBox.appendChild(titleEl);
        alertBox.appendChild(messageEl);
        buttonContainer.appendChild(button);
        alertBox.appendChild(buttonContainer);
        overlay.appendChild(alertBox);
        document.body.appendChild(overlay);

        // 聚焦按钮
        setTimeout(() => (testButton || button).focus(), 100);
    }

    // 获取DOM元素状态信息
    function getElementStatus(element) {
        if (!element) return '元素不存在';

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        
        const status = {
            tagName: element.tagName,
            id: element.id || '无',
            className: element.className || '无',
            dataE2e: element.getAttribute('data-e2e') || '无',
            value: element.value || element.textContent?.substring(0, 50) || '无',
            type: element.type || '无',
            placeholder: element.placeholder || '无',
            position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            visibility: {
                display: styles.display,
                visibility: styles.visibility,
                opacity: styles.opacity
            },
            isVisible: rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden',
            isFocused: document.activeElement === element
        };

        return `
            <div style="text-align: left;">
                <strong>元素信息：</strong><br>
                • 标签: ${status.tagName}<br>
                • ID: ${status.id}<br>
                • 类名: ${status.className}<br>
                • data-e2e: ${status.dataE2e}<br>
                • 值: ${status.value}<br>
                • 类型: ${status.type}<br>
                • 占位符: ${status.placeholder}<br><br>
                
                <strong>位置信息：</strong><br>
                • X: ${status.position.x}px<br>
                • Y: ${status.position.y}px<br>
                • 宽度: ${status.position.width}px<br>
                • 高度: ${status.position.height}px<br><br>
                
                <strong>可见性：</strong><br>
                • Display: ${status.visibility.display}<br>
                • Visibility: ${status.visibility.visibility}<br>
                • Opacity: ${status.visibility.opacity}<br>
                • 是否可见: ${status.isVisible ? '是' : '否'}<br>
                • 是否聚焦: ${status.isFocused ? '是' : '否'}<br>
            </div>
        `;
    }

    // 等待页面加载完成
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

    // 模拟人工输入
    function simulateHumanInput(element, text, delay = 100) {
        return new Promise((resolve) => {
            let index = 0;

            function typeNextChar() {
                if (index < text.length) {
                    const char = text[index];
                    
                    // 创建并触发键盘按下事件
                    const keydownEvent = new KeyboardEvent('keydown', {
                        key: char,
                        code: `Key${char.toUpperCase()}`,
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(keydownEvent);

                    // 创建并触发键盘按下事件（keypress）
                    const keypressEvent = new KeyboardEvent('keypress', {
                        key: char,
                        code: `Key${char.toUpperCase()}`,
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(keypressEvent);

                    // 更新输入框的值
                    element.value += char;

                    // 创建并触发输入事件
                    const inputEvent = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: char
                    });
                    element.dispatchEvent(inputEvent);

                    // 创建并触发键盘释放事件
                    const keyupEvent = new KeyboardEvent('keyup', {
                        key: char,
                        code: `Key${char.toUpperCase()}`,
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(keyupEvent);

                    index++;
                    
                    // 添加随机延迟，模拟真实输入速度
                    const randomDelay = delay + Math.random() * 50;
                    setTimeout(typeNextChar, randomDelay);
                } else {
                    // 输入完成后触发 change 事件
                    const changeEvent = new Event('change', {
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(changeEvent);
                    resolve();
                }
            }

            typeNextChar();
        });
    }

    // 模拟点击
    function simulateClick(element) {
        // 聚焦元素
        element.focus();
        
        // 创建并触发鼠标事件序列
        const mouseEvents = [
            new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
            }),
            new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window
            }),
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            })
        ];

        mouseEvents.forEach(event => {
            element.dispatchEvent(event);
        });

        // 触发 focus 事件
        const focusEvent = new FocusEvent('focus', {
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(focusEvent);
    }

    // 执行搜索
    function performSearch() {
        waitForElement('[data-e2e="searchbar-input"]')
            .then((searchInput) => {
                console.log('找到搜索框，开始模拟操作...');
                
                // 点击搜索框
                simulateClick(searchInput);
                
                // 显示DOM状态信息
                const domStatus = getElementStatus(searchInput);
                showCustomAlert(domStatus, '查找到的DOM状态');
                
                // 等待一小段时间确保点击生效
                setTimeout(() => {
                    // 清空输入框（如果需要）
                    searchInput.value = '';
                    
                    // 模拟输入"星灿传媒"
                    simulateHumanInput(searchInput, '星灿传媒', 150)
                        .then(() => {
                            console.log('输入完成，等待搜索...');
                            
                            // 等待输入完成后，触发搜索
                            setTimeout(() => {
                                // 尝试触发搜索（按回车键）
                                const enterEvent = new KeyboardEvent('keydown', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                searchInput.dispatchEvent(enterEvent);
                                
                                // 也尝试点击搜索按钮（如果存在）
                                const searchButton = document.querySelector('[data-e2e="searchbar-button"]') || 
                                                     document.querySelector('button[type="submit"]') ||
                                                     document.querySelector('.search-button');
                                
                                if (searchButton) {
                                    setTimeout(() => {
                                        simulateClick(searchButton);
                                    }, 200);
                                }
                                
                                console.log('搜索已触发');
                            }, 500);
                        })
                        .catch((error) => {
                            console.error('输入过程中出错:', error);
                        });
                }, 300);
            })
            .catch((error) => {
                console.error('未找到搜索框:', error);
                showCustomAlert(`未找到搜索框: ${error.message}<br><br>请确保页面已完全加载，或检查搜索框选择器是否正确。`, '错误');
            });
    }

    // 页面加载完成后执行
    function initScript() {
        // 显示脚本即将开始运行的提示（带测试按钮）
        showCustomAlert('脚本即将开始运行，正在查找搜索框...<br><br>点击"协议脚本测试"按钮可以测试脚本的各项功能。', '抖音搜索自动化', true);
        
        // 延迟执行搜索，让用户看到提示
        setTimeout(() => {
            performSearch();
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        // 如果页面已经加载完成，直接执行
        initScript();
    }

    // 也监听页面变化（SPA应用可能需要）
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // 路由变化时也显示提示（带测试按钮）
            showCustomAlert('检测到页面变化，脚本即将重新运行...<br><br>点击"协议脚本测试"按钮可以测试脚本的各项功能。', '抖音搜索自动化', true);
            setTimeout(() => {
                performSearch();
            }, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

})();

