// ==UserScript==
// @name         文档词典统计工具
// @namespace 	 accountbelongstox@163.com
// @version      0.4.1
// @description  将文档整理成词典，并展示。
// @author       accountbelongstox@163.com
// @match        *://*.*/*
// @match        *://*.*.*/*
// @match        *://*/*
// @exclude      *://*.12gm.com/*
// @exclude      *://*.deepseek.com/*
// @exclude      *://*.chatgpt.com/*
// @license      AGPL License
// @grant        GM_download
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_addElement
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_getResourceURL
// @grant        GM_getResourceText
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        GM_cookie
// @resource     bootstrapCSS https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css
// @run-at      document-idle
// @connect      cdn.jsdelivr.net
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js
// @downloadURL https://update.greasyfork.org/scripts/452648/%E6%96%87%E6%A1%A3%E8%AF%8D%E5%85%B8%E7%BB%9F%E8%AE%A1%E5%B7%A5%E5%85%B7.user.js
// @updateURL https://update.greasyfork.org/scripts/452648/%E6%96%87%E6%A1%A3%E8%AF%8D%E5%85%B8%E7%BB%9F%E8%AE%A1%E5%B7%A5%E5%85%B7.meta.js
// ==/UserScript==
(function () {
    'use strict';
    const base_remote_url = "https://api.12gm.com/";
    const module_name = 'dictionary';
    const local_tokenname = 'doc_dict_username';
    let new_words = [];
    let filterwords = [];
    const cssUrls = [];
    const jsUrls = [];

    function loadOnlineCSS(shadowRoot, callback) {
        // Official Tampermonkey way: Use GM_addElement to add link tag to Shadow DOM
        // Reference: https://www.tampermonkey.net/documentation.php
        // GM_addElement(shadowDOM, 'link', { rel: 'stylesheet', href: '...' })
        
        const cssUrl = GM_getResourceURL('bootstrapCSS');
        
        // Use GM_addElement as per official documentation
        GM_addElement(shadowRoot, 'link', {
            rel: 'stylesheet',
            href: cssUrl,
            type: 'text/css',
            crossOrigin: 'anonymous'
        });
        
        // Custom CSS for positioning and gradient background - using Bootstrap CSS for everything else
        GM_addElement(shadowRoot, 'style', {
            textContent: `
                /* Floating positioning - must be fixed relative to viewport */
                .dict-fixed-bottom-right {
                    position: fixed !important;
                    bottom: 20px !important;
                    right: 20px !important;
                    z-index: 9999 !important;
                }
                .dict-fixed-bottom-right .btn {
                    display: block !important;
                    margin-bottom: 8px !important;
                }
                .dict-fixed-bottom-right .btn:last-child {
                    margin-bottom: 0 !important;
                }
                .dict-bottom-h60 {
                    bottom: 60px !important;
                }
                .dict-panel-hidden {
                    display: none !important;
                }
                /* Beautiful gradient background from origin_v1.js */
                .dict-wp-gradient {
                    background-image: linear-gradient(to right bottom, #051937, #004d7a, #008793, #00bf72, #a8eb12) !important;
                    min-width: 300px !important;
                    min-height: 200px !important;
                }
                #dict-words-textarea {
                    min-height: 600px !important;
                }
                .w-66 {
                    width: 66% !important;
                }
                #dict-success-notification {
                    z-index: 10000 !important;
                }
                /* Checkbox label text color for gradient background */
                #dict-words-panel .form-check-label {
                    color: white !important;
                    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
                }
            `
        });
        
        // Callback immediately - CSS will load asynchronously
        if (callback) {
            setTimeout(callback, 100);
        }
    }

    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        const up_html = getInitHtml();
        let wcountPanel = document.querySelector('.wcount-panel');
        if (!wcountPanel) {
            wcountPanel = createWcountPanel();
        }

        let shadowHost = wcountPanel.querySelector('#wcount-shadow-host');
        if (!shadowHost) {
            shadowHost = document.createElement('div');
            shadowHost.id = 'wcount-shadow-host';
            wcountPanel.appendChild(shadowHost);
        }

        if (!shadowHost.shadowRoot) {
            shadowHost.attachShadow({ mode: 'open' });
        }
        
        const shadowRoot = shadowHost.shadowRoot;
        
        // Load CSS and HTML together - CSS is embedded in HTML via GM_addElement
        // Set HTML first, then load CSS to ensure styles apply
        shadowRoot.innerHTML = up_html;
        loadOnlineCSS(shadowRoot, () => {
            // CSS loaded, now initialize
            initShadowContent(shadowRoot);
        });
    }

    function initShadowContent(shadowRoot) {
        // Shadow DOM doesn't have document.ready event
        // Use setTimeout to ensure DOM is ready, or use MutationObserver
        // For simplicity, use immediate execution since HTML is already set
        const $shadow = $(shadowRoot);
        
        // Bind click event handlers
        $shadow.find('#dict-toggle-words-btn').on('click', function () {
            setWordsToTextarea(shadowRoot);
            $shadow.find('#dict-words-panel').toggleClass('dict-panel-hidden');
        });
        
        $shadow.find('#dict-unread-btn').on('click', function () {
            // Unread button click handler if needed
        });
        
        // Initialize word count (default: only text)
        const { precent, words, unread_words } = getUserWordsCount('', shadowRoot, false);
        setWordsToTextarea(shadowRoot);
        
        // Update unread count
        $shadow.find('#dict-unread-count').text(unread_words.length);

        // Bind extract mode checkbox
        $shadow.find('#dict-extract-all').on('change', function () {
            const extractAll = $(this).is(':checked');
            // 重新提取单词
            new_words = [];
            filterwords = [];
            const { precent, words, unread_words } = getUserWordsCount('', shadowRoot, extractAll);
            setWordsToTextarea(shadowRoot);
            $shadow.find('#dict-words-count').text(words.length);
            $shadow.find('#dict-unread-count').text(unread_words.length);
        });

        // Bind sorted and categorized buttons
        $shadow.find('#dict-sorted-btn').on('click', function () {
            displaySortedWords(shadowRoot);
        });

        $shadow.find('#dict-categorized-btn').on('click', function () {
            displayCategorizedWords(shadowRoot);
        });
    }

    function createWcountPanel() {
        const wcountPanel = document.createElement('div');
        wcountPanel.classList.add('wcount-panel');
        // Critical: wcount-panel must have zero size to not interfere with fixed positioning
        wcountPanel.style.display = 'block';
        wcountPanel.style.width = '0px';
        wcountPanel.style.height = '0px';
        wcountPanel.style.margin = '0px';
        wcountPanel.style.padding = '0px';
        wcountPanel.style.borderWidth = 'initial';
        wcountPanel.style.borderStyle = 'none';
        wcountPanel.style.borderColor = 'initial';
        wcountPanel.style.borderImage = 'initial';
        wcountPanel.style.outline = 'none';
        document.body.appendChild(wcountPanel);
        return wcountPanel;
    }

    function displaySortedWords(shadowRoot) {
        let tableBody = $(shadowRoot).find('#dict-words-table tbody');
        tableBody.empty(); // Clear the table body

        new_words.sort(); // Sort words in ascending order

        const maxColumns = 20;
        let columns = [];  // Array to hold multiple columns (each with a max of 20 words)

        // Split the words into groups of max 20 words per column
        for (let i = 0; i < new_words.length; i += maxColumns) {
            columns.push(new_words.slice(i, i + maxColumns));
        }

        // Create the table rows with words grouped in columns
        const numRows = columns[0].length; // Number of rows in the first column (they should all have the same number of rows)

        // Loop through the rows
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
            let rowHtml = '<tr>'; // Start a new row

            // Loop through each column
            columns.forEach(function (column) {
                // Add word for this row in each column
                rowHtml += `<td>${column[rowIndex] || ''}</td>`;
            });

            rowHtml += '</tr>'; // End the row
            tableBody.append(rowHtml); // Add the row to the table
        }
    }
    function displayCategorizedWords(shadowRoot) {
        let tableBody = $(shadowRoot).find('#dict-words-table tbody');
        tableBody.empty(); // Clear the table body

        let categorized = {};

        // Group words by their first letter
        new_words.forEach(function (word) {
            let firstLetter = word.charAt(0).toUpperCase();
            if (!categorized[firstLetter]) {
                categorized[firstLetter] = [];
            }
            categorized[firstLetter].push(word);
        });

        // Split each category into multiple columns if the count exceeds 30
        let maxColumnWords = 30;
        let columns = {}; // Store columns for each category

        Object.keys(categorized).forEach(function (letter) {
            let words = categorized[letter];

            // Create columns for categories with more than maxColumnWords
            let columnsForLetter = [];
            for (let i = 0; i < words.length; i += maxColumnWords) {
                columnsForLetter.push(words.slice(i, i + maxColumnWords));
            }

            columns[letter] = columnsForLetter; // Store the columns for the letter
        });

        // Generate table headers (one per column)
        let headerRowHtml = '<tr>';
        Object.keys(columns).forEach(function (letter) {
            headerRowHtml += `<th>${letter}</th>`;
        });
        headerRowHtml += '</tr>';
        tableBody.append(headerRowHtml); // Add headers to the table

        // Determine the maximum number of rows based on the number of columns in any category
        let maxRows = 0;
        Object.keys(columns).forEach(function (letter) {
            maxRows = Math.max(maxRows, columns[letter].length);
        });

        // Create rows, filling in columns for each letter
        for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
            let rowHtml = '<tr>'; // Start a new row

            Object.keys(columns).forEach(function (letter) {
                // If the column has a word for this row, add it; otherwise, add an empty cell
                rowHtml += `<td>${columns[letter][rowIndex] ? columns[letter][rowIndex].join('<br>') : ''}</td>`;
            });

            rowHtml += '</tr>'; // End the row
            tableBody.append(rowHtml); // Add the row to the table
        }
    }

    function setWordsToTextarea(shadowRoot) {
        let wordsText = new_words.join('\n');
        $(shadowRoot).find('#dict-words-textarea').val(wordsText);
    }

    function getUserWordsCount(readwords = "", shadowRoot, extractAll = false) {
        readwords = readwords.split(',');
        const words = getDocumentWords(extractAll);
        const unread_words = words.filter(item => !readwords.includes(item));
        const precent = words.length > 0 ? ((unread_words.length / words.length) * 100).toFixed(2) : 0;

        let shadowRootDoc = shadowRoot || document.querySelector('#wcount-shadow-host').shadowRoot;
        $(shadowRootDoc).find('#dict-words-count').text(words.length);

        return { precent, words, unread_words };
    }

    function getDocumentWords(extractAll = false) {
        let content = '';
        
        if (extractAll) {
            // 提取所有内容：HTML源码 + CSS + JS
            // HTML源码
            content += document.documentElement.innerHTML;
            
            // 提取所有<style>标签中的CSS
            const styleSheets = document.querySelectorAll('style');
            styleSheets.forEach(style => {
                content += ' ' + style.textContent;
            });
            
            // 提取所有<script>标签中的JS（排除外部脚本）
            const scripts = document.querySelectorAll('script:not([src])');
            scripts.forEach(script => {
                content += ' ' + script.textContent;
            });
            
            // 提取内联样式
            const elementsWithStyle = document.querySelectorAll('[style]');
            elementsWithStyle.forEach(el => {
                content += ' ' + el.getAttribute('style');
            });
        } else {
            // 只提取可见文本
            content = document.documentElement.textContent;
        }
        
        // 提取单词
        let words = [...(
            new Set(
                content.split(/[^a-zA-Z]/)
                    .join(" ").split(/(?<=[a-z])\B(?=[A-Z])/)
                    .join(" ").split(/\s+/)
            )
        )];

        // 清空之前的单词（重新提取时）
        new_words = [];
        filterwords = [];

        const isNotWord = /^[a-z]+[A-Z]$/;
        for (let word of words) {
            if (isNotWord.test(word) || word.length < 3) {
                if (!filterwords.includes(word)) {
                    filterwords.push(word);
                }
            } else {
                if (!new_words.includes(word)) {
                    new_words.push(word);
                }
            }
        }

        return new_words;
    }

    function splitHtml(html) {
        return html.replaceAll(/<.+?>/g, '');
    }

    function getInitHtml() {
        // Use Bootstrap CSS classes only - all styling from Bootstrap
        let html = `
<div>
    <div class="dict-fixed-bottom-right">
        <button class="btn btn-dark btn-sm" id="dict-toggle-words-btn">Words : <span id="dict-words-count">-</span></button>
        <button class="btn btn-secondary btn-sm" id="dict-unread-btn">Unread : <span id="dict-unread-count">-</span></button>
    </div>
    <div class="dict-fixed-bottom-right dict-bottom-h60 dict-wp-gradient dict-panel-hidden p-3 rounded shadow-lg" id="dict-words-panel">
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="dict-extract-all">
            <label class="form-check-label text-white" for="dict-extract-all">
                提取所有（包含HTML/CSS/JS源码）
            </label>
        </div>
        <fieldset class="mb-3">
            <textarea class="form-control w-66" id="dict-words-textarea" rows="20" placeholder="Textareas work too"></textarea>
        </fieldset>
        <div class="dict-panel-hidden">
            <div class="p-2">
                <button class="btn btn-outline-primary btn-sm me-2" id="dict-sorted-btn">Sorted in order</button>
                <button class="btn btn-outline-primary btn-sm" id="dict-categorized-btn">Categorized by letters</button>
            </div>
            <table class="table table-bordered table-sm" id="dict-words-table">
                <thead>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    </div>
</div>
<div class="position-fixed top-50 start-50 translate-middle bg-danger text-white p-3 rounded shadow-lg dict-panel-hidden" id="dict-success-notification">
    单词添加成功提示:<br/>
    <span></span>
</div>
<div class="dict-panel-hidden">
    <a href="javascript:void(0)" data-click="put_group" class="btn btn-primary">
        <span>提交本页<br><font>-</font><br>个词</span>
    </a>
    <input type="button" class="btn btn-secondary" data-click="check_local_user" value="打开菜单">
</div>
<div class="dict-panel-hidden">
    <form>
        <fieldset>
            <legend>A Stacked Form</legend>
            <div class="mb-3">
                <label for="dict-form-email" class="form-label">Email</label>
                <input id="dict-form-email" type="email" class="form-control" placeholder="Email" />
                <div class="form-text">This is a required field.</div>
            </div>
            <div class="mb-3">
                <label for="dict-form-password" class="form-label">Password</label>
                <input id="dict-form-password" type="password" class="form-control" placeholder="Password" />
            </div>
            <div class="mb-3">
                <label for="dict-form-state" class="form-label">State</label>
                <select id="dict-form-state" class="form-select">
                    <option>AL</option>
                    <option>CA</option>
                    <option>IL</option>
                </select>
            </div>
            <div class="mb-3 form-check">
                <input id="dict-form-remember" type="checkbox" class="form-check-input" />
                <label for="dict-form-remember" class="form-check-label">Remember me</label>
            </div>
            <button type="submit" class="btn btn-primary">Sign in</button>
        </fieldset>
    </form>
</div>
            `
        return html
    }
    
    // Initialize when DOM is ready
    // @run-at document-idle ensures DOM is ready, but we still check
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
