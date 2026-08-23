// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// ==UserScript==
// @name         文档词典统计工具
// @namespace 	 accountbelongstox@163.com
// @version      0.4.1
// @description  将文档整理成词典，并展示。
// @author       accountbelongstox@163.com
// @match        *://*.*/*
// @match        *://*.*.*/*
// @match        *://*/*
// @exclude      *://*.deepseek.com/*
// @exclude      *://*.chatgpt.com/*
// @license      AGPL License
// @grant        GM_download
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_getResourceURL
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        GM_cookie
// @require     https://cdn.jsdelivr.net/npm/axios@v1.0.0-alpha.1/dist/axios.min.js
// @require     https://cdn.jsdelivr.net/npm/axios-userscript-adapter@0.2.0-alpha.2
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/tampermonkey/js/logger.1.0.js
// @resource     coreNodeServiceContract https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/config/service_contract.json
// @require      https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/tampermonkey/js/service_contract.js
// @require      https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/tampermonkey/js/pako.min.js
// @require      https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/bwpaser.1.0.12.js
// @require      https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/pinyin-pro.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  // #@require      https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/bwpaser.1.0.10.js

  if (CoreNodeServiceContract.matchesRootDomain(window.location.hostname)
    || (window.location.hostname === CoreNodeServiceContract.host('loopback')
      && Number(window.location.port) === CoreNodeServiceContract.port('tampermonkey_local_api'))) {
    return;
  }

  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return window.frameElement !== null;
    }
  }
  axios.defaults.adapter = axiosGmxhrAdapter;
  if (!isInIframe()) {
    const styleVersion = `0.4`;
    const styleUrl = `https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/tampermonkey/styles/word.style.${styleVersion}.css`;
    const baseUrl = CoreNodeServiceContract.url('https', CoreNodeServiceContract.serviceDomain('dictionary_static'));
    const staticApiUrl = CoreNodeServiceContract.url('https', CoreNodeServiceContract.serviceDomain('static_api'));
    const userApiUrl = CoreNodeServiceContract.url('http', CoreNodeServiceContract.host('localhost'), CoreNodeServiceContract.port('tampermonkey_local_api'), '/');

    //----------------------------------------------------------------
    if (typeof pinyinPro == "undefined") {
      logger.error("pinyinPro is not loaded");
    } else {
      logger.log("pinyinPro is loaded");
    }
    const STATIC_BASE_URL = ``;
    let binParse = null;
    const wordQueryUrl = `${staticApiUrl}/query_words`;
    let new_words = [];
    let filterwords = [];
    const isDebug = false;
    let currentPage = 0;
    const pageSize = 100;
    let globalTranslateCache = [];
    const localStorageKey = `translateCache`;
    function toJSON(obj) {
      if (typeof obj === "string") {
        try {
          obj = JSON.parse(obj);
        } catch (e) {
          logger.error("toJSON failed", e);
          return ``;
        }
      }
      return obj;
    }
    function JsonToStr(obj) {
      if (typeof obj === "string") {
        return obj;
      }
      try {
        return JSON.stringify(obj);
      } catch (e) {
        logger.error("JsonToStr failed", e);
        return ``;
      }
    }
    function compressJson(jsonObj) {
      if (!jsonObj) return ``;
      const jsonString = JsonToStr(jsonObj);
      const compressed = pako.deflate(jsonString, { level: 9 });
      let binaryString = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < compressed.length; i += chunkSize) {
        const chunk = compressed.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binaryString);
    }
    function debug() {
      logger.log(`remove translateCache ${localStorageKey}`);
      localStorage.removeItem(localStorageKey);
    }
    function getNextPageData(data, pageIndex, pageSize) {
      if (!Array.isArray(data)) return [];
      const start = pageIndex * pageSize;
      const end = start + pageSize;
      const clampedStart = Math.max(0, Math.min(start, data.length));
      const clampedEnd = Math.max(0, Math.min(end, data.length));

      return data.slice(clampedStart, clampedEnd);
    }
    function mergeUniqueContent(arrA, arrB) {
      const existingContent = new Set(arrA.map((item) => item.content));
      const newItems = arrB.filter(
        (item) => !existingContent.has(item.content),
      );
      return [...arrA, ...newItems];
    }
    function decompressJson(compressedStr) {
      if (!compressedStr) return ``;
      const binaryString = atob(compressedStr);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decompressed = pako.inflate(bytes, { to: "string" });
      return toJSON(decompressed);
    }
    function normalizeStr(str) {
      return str
        .trim()
        .toLowerCase()
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/\s+/g, "-");
    }
    function getTranslateCacheByLocal() {
      let translateCache = localStorage.getItem(localStorageKey);
      if (translateCache) {
        try {
          translateCache = decompressJson(translateCache);
        } catch {
          translateCache = [];
        }
      } else {
        translateCache = [];
      }
      return translateCache;
    }
    function queryByLocal() {
      let translateCache = getTranslateCacheByLocal();
      let result = [];
      let needQueryWords = [];
      let alreadyLoadedWords = [];
      translateCache.forEach((item) => {
        if (new_words.includes(item.content)) {
          result.push(item);
          alreadyLoadedWords.push(item.content);
        }
      });
      new_words.forEach((word) => {
        if (!alreadyLoadedWords.includes(word)) {
          needQueryWords.push(word);
        }
      });
      return { result, needQueryWords };
    }
    function saveToLocal(newTranslations) {
      let translateCache = getTranslateCacheByLocal();
      translateCache = mergeUniqueContent(translateCache, newTranslations);
      const compressed = compressJson(translateCache);
      try {
        localStorage.setItem(localStorageKey, compressed);
      } catch (e) {
        logger.error("localStorage setItem failed", e);
        logger.log(compressed);
      }
    }
    function saveToGlobal(dataArray) {
      globalTranslateCache = dataArray;
    }
    async function queryWords() {
      let { result, needQueryWords } = queryByLocal();
      if (needQueryWords.length > 0) {
        var response = null;
        try {
          response = await axios.post(
            wordQueryUrl,
            { words: needQueryWords },
            {
              headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
              },
              timeout: 10000, // 10 seconds (adjust as needed)
            },
          );
        } catch (error) {
          logger.error("Error making request to:", wordQueryUrl);
          logger.error("Error details:", error);
        }
        if (response && response.data) {
          const dataArray = response.data.data;
          result = mergeUniqueContent(result, dataArray);
          saveToLocal(dataArray);
        }
      }
      saveToGlobal(result);
      return result;
    }
    function createWcountPanel() {
      const wcountPanel = document.createElement("div");
      wcountPanel.classList.add("wcount-panel");
      wcountPanel.style.display = "block";
      wcountPanel.style.width = "0px";
      wcountPanel.style.height = "0px";
      wcountPanel.style.margin = "0px";
      wcountPanel.style.padding = "0px";
      wcountPanel.style.borderWidth = "initial";
      wcountPanel.style.borderStyle = "none";
      wcountPanel.style.borderColor = "initial";
      wcountPanel.style.borderImage = "initial";
      wcountPanel.style.outline = "none";
      document.body.appendChild(wcountPanel);
      return wcountPanel;
    }

    function displaySortedWords(shadowRoot) {
      let tableBody = $(shadowRoot).find("#words_table tbody");
      tableBody.empty(); // Clear the table body
      new_words.sort(); // Sort words in ascending order
      const maxColumns = 20;
      let columns = []; // Array to hold multiple columns (each with a max of 20 words)
      for (let i = 0; i < new_words.length; i += maxColumns) {
        columns.push(new_words.slice(i, i + maxColumns));
      }
      const numRows = columns[0].length; // Number of rows in the first column (they should all have the same number of rows)
      for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
        let rowHtml = "<tr>"; // Start a new row
        columns.forEach(function (column) {
          rowHtml += `<td>${column[rowIndex] || ""}</td>`;
        });
        rowHtml += "</tr>"; // End the row
        tableBody.append(rowHtml); // Add the row to the table
      }
    }

    function displayCategorizedWords(shadowRoot) {
      let tableBody = $(shadowRoot).find("#words_table tbody");
      tableBody.empty(); // Clear the table body

      let categorized = {};

      new_words.forEach(function (word) {
        let firstLetter = word.charAt(0).toUpperCase();
        if (!categorized[firstLetter]) {
          categorized[firstLetter] = [];
        }
        categorized[firstLetter].push(word);
      });

      let maxColumnWords = 30;
      let columns = {}; // Store columns for each category

      Object.keys(categorized).forEach(function (letter) {
        let words = categorized[letter];

        let columnsForLetter = [];
        for (let i = 0; i < words.length; i += maxColumnWords) {
          columnsForLetter.push(words.slice(i, i + maxColumnWords));
        }

        columns[letter] = columnsForLetter;
      });

      let headerRowHtml = "<tr>";
      Object.keys(columns).forEach(function (letter) {
        headerRowHtml += `<th>${letter}</th>`;
      });
      headerRowHtml += "</tr>";
      tableBody.append(headerRowHtml);

      let maxRows = 0;
      Object.keys(columns).forEach(function (letter) {
        maxRows = Math.max(maxRows, columns[letter].length);
      });

      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        let rowHtml = "<tr>"; // Start a new row

        Object.keys(columns).forEach(function (letter) {
          rowHtml += `<td>${columns[letter][rowIndex] ? columns[letter][rowIndex].join("<br>") : ""}</td>`;
        });

        rowHtml += "</tr>"; // End the row
        tableBody.append(rowHtml); // Add the row to the table
      }
    }

    async function setWordsToTextarea(shadowRoot) {
      let wordsText = new_words.join("\n");
      $(shadowRoot).find("#words_textarea").val(wordsText);
    }

    async function getWordsTranslate(shadowRoot) {
      const originalText = $(shadowRoot).find("#getWordsTranslate").text();
      const loadingText = "loading...";
      const originalReadText = $(shadowRoot).find(".readText").text();
      if (originalText === loadingText) {
        alert("loading...");
        return;
      }
      $(shadowRoot).find("#getWordsTranslate").text(loadingText);
      $(shadowRoot).find(".readText").text(loadingText);
      const result = await queryWords();
      function calculateLocalStorageUsageInMB() {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          totalSize += key.length + value.length;
        }
        const sizeInMB = totalSize / (1024 * 1024);
        return sizeInMB;
      }
      $(shadowRoot).find("#getWordsTranslate").text(originalText);
      $(shadowRoot).find(".readText").text(originalReadText);
      const wordsCount = Object.keys(result).length;
      const resultNoticeString = `loaded ${wordsCount} words`;
      $(shadowRoot).find(".translate-result").text(resultNoticeString);
      $(shadowRoot).find("#ur").text(wordsCount);
    }

    function getUserWordsCount(readwords = "", shadowRoot) {
      readwords = readwords.split(",");
      const words = getDocumentWords();
      const unread_words = words.filter((item) => !readwords.includes(item));
      const precent = ((unread_words.length / words.length) * 100).toFixed(2);

      let shadowRootDoc =
        shadowRoot || document.querySelector("#wcount-shadow-host").shadowRoot;
      $(shadowRootDoc).find("#sw").text(words.length);

      return { precent, words, unread_words };
    }

    function getDocumentWords() {
      let words = [
        ...new Set(
          document.documentElement.textContent
            .split(/[^a-zA-Z]/)
            .join(" ")
            .split(/(?<=[a-z])\B(?=[A-Z])/)
            .join(" ")
            .split(/\s+/),
        ),
      ];

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
      return html.replaceAll(/<.+?>/g, "");
    }

    async function listenInit() {
      await debug();
      const up_html = await getInitHtml();
      let wcountPanel = document.querySelector(".wcount-panel");
      if (!wcountPanel) {
        wcountPanel = createWcountPanel();
      }

      let shadowHost = wcountPanel.querySelector("#shadow-host");
      if (!shadowHost) {
        shadowHost = document.createElement("div");
        shadowHost.id = "wcount-shadow-host";
        wcountPanel.appendChild(shadowHost);
      }

      if (!shadowHost.shadowRoot) {
        shadowHost.attachShadow({ mode: "open" });
      }
      shadowHost.shadowRoot.innerHTML = up_html;

      const shadowRoot = shadowHost.shadowRoot;
      $(shadowRoot).ready(async function () {
        window.addEventListener("message", function (event) {
          try {
            const data = event.data;
            logger.log(data);
            if (data.type === "app_ready") {
              $("#message-container").html(`
                      <strong>Received from Flutter:</strong><br>
                      Type: ${data.type}<br>
                      Message: ${data.message}<br>
                      <small>Origin: ${event.origin}</small>
                  `);
              alert(`Flutter Message:\n${data.message}`);
            }
          } catch (e) {
            alert("Error processing message:", e);
          }
        });
        const shadow = $(shadowRoot); // assuming shadowRoot is defined
        const iframe = shadow.find("#dict_user_ifrm")[0];
        if (!iframe || !iframe.contentWindow) {
          logger.error("❌ iframe not found or not ready.");
        } else {
          setInterval(() => {
            try {
              iframe.contentWindow.postMessage(
                { type: "ping", time: Date.now() },
                "*",
              );
              logger.log("✅ Message sent successfully.");
            } catch (err) {
              logger.error("❌ Failed to send message:", err);
            }
          }, 1000);
        }

        $(shadowRoot)
          .find(".showWords")
          .click(async function () {
            await setWordsToTextarea(shadowRoot);
            $(shadowRoot).find("#wp").toggle();
            $(shadowRoot).find("#wl").hide();
            $(shadowRoot).find("#lg").hide();
            $(shadowRoot).find("#lf").hide();
          });
        const { precent, words, unread_words } = getUserWordsCount(
          ``,
          shadowRoot,
        );
        await setWordsToTextarea(shadowRoot);
        $(shadowRoot)
          .find("#getWordsTranslate")
          .click(async function () {
            await getWordsTranslate(shadowRoot);
          });
        $(shadowRoot)
          .find("#readBtn")
          .click(async function () {
            await displayWords(shadowRoot);
          });
        $(shadowRoot)
          .find("#login")
          .click(async function () {
            await checkLogin(shadowRoot);
          });
        if (!binParse) {
          binParse = new BingWordParse({
            baseUrl: baseUrl,
            isDebug: true,
            initElement: shadowRoot,
            showImage: false,
            onlyPhonetic: "us",
          });
        }
        $(shadowRoot)
          .find("#nextPageBtn")
          .click(async function () {
            await showNextPageData(shadowRoot);
          });
        $(shadowRoot)
          .find("#prevPageBtn")
          .click(async function () {
            await showPrevPageData(shadowRoot);
          });
        $(shadowRoot)
          .find("#loginButton")
          .click(async function () {
            await handleLoginSubmit(shadowRoot);
          });
        // $(shadowRoot).find('#categorizedBtn').click(function () {
        //     displayCategorizedWords(shadowRoot);
        // });
      });
    }

    function toggleWordsList(shadowRoot, showWl = true) {
      $(shadowRoot).find("#wl").toggle();
      $(shadowRoot).find("#wp").hide();
      $(shadowRoot).find("#lg").hide();
      $(shadowRoot).find("#lf").hide();
    }

    function toggleLoginHtml(shadowRoot, showLogin = true) {
      $(shadowRoot).find("#lf").toggle();
      $(shadowRoot).find("#lg").hide();
      $(shadowRoot).find("#wl").hide();
      $(shadowRoot).find("#wp").hide();
    }

    async function showCurrentPageData(shadowRoot) {
      const currentPageData = getNextPageData(
        globalTranslateCache,
        currentPage,
        pageSize,
      );
      const html = await binParse.createHtml(currentPageData);
      $(shadowRoot).find(".words-list").html(html);
      toggleWordsList(shadowRoot, true);
      return currentPageData;
    }

    async function showNextPageData(shadowRoot) {
      currentPage++;
      const maxPage = parseInt(globalTranslateCache.length / pageSize);
      if (currentPage > maxPage) {
        currentPage = maxPage;
      }
      const currentPageData = getNextPageData(
        globalTranslateCache,
        currentPage,
        pageSize,
      );
      const html = await binParse.createHtml(currentPageData);
      $(shadowRoot).find(".words-list").html(html);
      toggleWordsList(shadowRoot, true);
      return currentPageData;
    }

    async function showPrevPageData(shadowRoot) {
      currentPage = Math.max(0, currentPage - 1);
      if (currentPage < 0) {
        currentPage = 0;
      }
      const currentPageData = getNextPageData(
        globalTranslateCache,
        currentPage,
        pageSize,
      );
      const html = await binParse.createHtml(currentPageData);
      $(shadowRoot).find(".words-list").html(html);
      toggleWordsList(shadowRoot, true);
      return currentPageData;
    }

    async function handleLoginSubmit(shadowRoot) {
      const formData = {
        email: $(shadowRoot).find("#stacked-user").val(),
        password: $(shadowRoot).find("#stacked-password").val(),
      };
      $.ajax({
        url: `${userApiUrl}/login`,
        method: "POST",
        headers: {
          "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content"),
        },
        data: JSON.stringify(formData),
        contentType: "application/json",
        dataType: "json",
        success: function (data, status, xhr) {
          if (xhr.status >= 200 && xhr.status < 300) {
            window.location.href = data.redirect || "/dashboard";
          } else {
            logger.log(`fail login`);
          }
        },
        error: function (xhr) {
          const errorMessage =
            xhr.responseJSON && xhr.responseJSON.message
              ? xhr.responseJSON.message
              : "Network error - please try again";
        },
      });
    }

    async function checkLogin(shadowRoot) {
      const login_username = $(shadowRoot).find(".login_username").text();
      // if (login_username === "Not signed in") {
      //   await handleLoginSubmit(shadowRoot);
      // }
      toggleLoginHtml(shadowRoot, true);
    }

    async function displayWords(shadowRoot) {
      await showCurrentPageData(shadowRoot);
      if (globalTranslateCache.length == 0) {
        await getWordsTranslate(shadowRoot);
      }
    }

    async function getInitHtml() {
      let html = `
  <link rel="stylesheet" href="${styleUrl}" />
  <div class="tw">
      <div class="fixed-bottom-right">
          <button class="button-27 showWords">WordsCount : <span id="sw">-</span></button>
          <button class="button-85" id="readBtn"><span class="readText">WillRead : </span><span id="ur">0</span></button>
          <button class="button-6" id="login"><span class="login_username">Not signed in</span></button>
      </div>
      <div class="fixed-bottom-right bottom_h30 wp-gd" id="wp" style="display: none;">
          <div class="dict_words_list_warp">
            <div class="pure-group textarea-wrap">
                <textarea class="pure-input-2-3 t-container" id="words_textarea" placeholder="Textareas work too"></textarea>
            </div>
            <div class="button-wrap">
                <div class="p10 flex-center">
                    <div class="translate-result flex-center"></div>
                    <div class="flex-center">
                        <button class="button-6" id="getWordsTranslate">Get Words Translate</button>
                    </div>
                </div>
            </div>
            <div style="display: none;">
                <div class="p10">
                    <button class="button-6" id="sortedBtn">Sorted in order</button>
                    <button class="button-6" id="categorizedBtn">Categorized by letters</button>
                </div>
                <table class="pure-table" id="words_table">
                    <thead>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
          </div>
      </div>
      <div class="fixed-bottom-right bottom_h30 wp-gd" id="wl" style="display: none;">
        <div class="dict_getedlist_warp">
          <div class="dict_wrap_p words-list">
          </div>
          <div class="button-wrap">
              <div class="p10 flex-center">
                  <div class="wondlist-info flex-center"></div>
                  <div class="flex-row">
                      <button class="button-6" id="nextPageBtn">Next Page</button>
                      <button class="button-6" id="prevPageBtn">Prev Page</button>
                      <button class="button-6" id="autoPlay">Auto Play</button>
                      <button class="button-6" id="openSetting">Setting</button>
                  </div>
              </div>
          </div>
        </div>
      </div>
      <div class="fixed-bottom-right bottom_h30 wp-lg" id="lg" style="display: none;">
          <div class="login-wrap">
              <div class="p10 flex-center">
                  <form class="pure-form pure-form-stacked">
                      <fieldset>
                          <legend>A Stacked Form</legend>
                          <label for="stacked-user">User</label>
                          <input id="stacked-user" type="text" placeholder="User Name" />
                          <span class="pure-form-message">This is a required field.</span>
                          <label for="stacked-password">Password</label>
                          <input id="stacked-password" type="password" placeholder="Password" />
                          <label for="stacked-remember" class="pure-checkbox">
                              <input id="stacked-remember" type="checkbox" /> Remember me
                          </label>
                          <button type="button" id="loginButton" class="pure-button pure-button-primary">Sign in</button>
                      </fieldset>
                  </form>
              </div>
          </div>
          <div class="registry-wrap">
              <div class="p10 flex-center">
                  <form class="pure-form pure-form-stacked">
                      <fieldset>
                          <legend>A Stacked Form</legend>
                          <label for="stacked-email">Email</label>
                          <input id="stacked-email" type="email" placeholder="Email" />
                          <span class="pure-form-message">This is a required field.</span>
                          <label for="stacked-password">Password</label>
                          <input id="stacked-password" type="password" placeholder="Password" />
                          <label for="stacked-remember" class="pure-checkbox">
                              <input id="stacked-remember" type="checkbox" /> Remember me
                          </label>
                          <button type="submit" class="pure-button pure-button-primary">Sign in</button>
                      </fieldset>
                  </form>
              </div>
          </div>
      </div>
      <div class="fixed-bottom-right bottom_h30 wp-lf" id="lf" style="display: none;">
          <div class="iframe-wrap">
            <iframe
                    src="${userApiUrl}"
                    id="dict_user_ifrm"
                    frameborder="0"
                    class="iframe_css"
                    allow="fullscreen"
                    title="Flutter Application"
                ></iframe>
          </div>
      </div>
  </div>
              `;
      return html;
    }
    async function doGet(url, headers = {}, timeout = 10000) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json(); // You can change to text() if needed
      } catch (error) {
        logger.error("GET request failed:", error);
        throw error;
      }
    }

    async function doPost(url, data = {}, headers = {}, timeout = 10000) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...headers,
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        logger.error("POST request failed:", error);
        throw error;
      }
    }

    window.addEventListener(
      "load",
      async function () {
        await listenInit();
      },
      false,
    );
  }
})();
