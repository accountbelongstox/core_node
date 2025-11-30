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

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    }
    else if (typeof define === 'function' && define.amd) {
        define([], factory);
    }
    else {
        global.BingWordParse = factory();
        global.$BWP = global.BingWordParse;
    }
}(typeof window !== 'undefined' ? window : this, function () {
    class BingWordParse {
        MAX_SHOW_MAXIMAGES = 1
        PHONETIC_SHOW_MAX = 1
        PHONETIC_ONLY_SHOW = `us`
        STATIC_PATH = `sound_dir`
        BASE_STAIC_URL = `https://dict.si.12gm.com/`
        isDebug = true
        logger = {
            log: (...args) => console.log(...args),
            error: (...args) => console.error(...args),
            warn: (...args) => console.warn(...args),
            info: (...args) => console.info(...args),
            debug: (...args) => this.isDebug && console.debug(...args),
            trace: (...args) => this.isDebug && console.trace(...args),
            dir: (...args) => console.dir(...args),
            dirxml: (...args) => console.dirxml(...args),
        }

        constructor(options = {}) {
            this.BASE_STAIC_URL = options.baseUrl || this.BASE_STAIC_URL
            this.STATIC_PATH = options.staticPath || this.STATIC_PATH
            this.isDebug = options.isDebug || true
            this.iniCssElement = options.initElement || document
            this.showImage = options.showImage || true
            this.PHONETIC_ONLY_SHOW = options.onlyPhonetic || `us`
            this.PHONETIC_SHOW_MAX = options.phoneticMaxShow || 1
            this.MAX_SHOW_MAXIMAGES = options.showMaxImage || 1
            
            if (typeof pinyinPro == 'undefined') {
                this.logger.warn('pinyinPro is undefined')
            }
            this.initCSS(this.iniCssElement)
        }
        normalizeStr(str) {
            return str.trim().toLowerCase().replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, '-');
        }
        toJSON(obj) { if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch (e) { this.logger.debug(e); return {}; } } return obj }
        joinUrl(baseUrl, path, params = {}) {
            var url = baseUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
            var queryString = Object.keys(params)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
                .join('&');
            if (queryString) {
                url += '?' + queryString;
            }
            return url;
        }
        is_json_str(str) {
            return /^\s*[\{\[]/.test(str)
        }
        formatDurationToStr(timestamp) {
            if (typeof timestamp == 'string') {
                if (!/\d+/.test(timestamp)) {
                    return `0s`
                }
                timestamp = parseInt(timestamp)
            }
            const seconds = Math.floor(timestamp / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const months = Math.floor(days / 30);
            const years = Math.floor(days / 365);
            const remainingMonths = Math.floor((days % 365) / 30);
            const remainingDays = days % 30;
            const remainingHours = hours % 24;
            const remainingMinutes = minutes % 60;
            const remainingSeconds = seconds % 60;
            if (years > 0) {
                return `${years}y ${remainingMonths}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
            }
            if (months > 0) {
                return `${months}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
            }
            if (days > 0) {
                return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
            }
            if (hours > 0) {
                return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
            }
            if (minutes > 0) {
                return `${minutes}m ${remainingSeconds}s`;
            }
            return `${seconds}s`;
        }
        fill_alphabet(s, l, fill_s = "0") { s = s + ""; s = s.padStart(l, fill_s); return s }
        get_array_plusvalue(array, index) { if (array.length >= index + 1) { return array[index] } return null }
        createHtml(data, pre_render = false, options = {}) {
            let {
                brief_mode = false,
                project_mode = true
            } = options
            let wordbox_html = "";
            let index = 0;
            const entries = Array.isArray(data) ? data.entries() : Object.entries(data);
            console.log(entries)
            for (const [word, wordItem] of entries) {
                let word_id = index
                let last_readtime = this.formatDurationToStr(wordItem.lastModified)
                let word = wordItem.content
                let translation = this.toJSON(wordItem.translation)
                let voice_files = this.toJSON(wordItem.voice_files);
                let word_index = wordItem.id
                let id = wordItem.id
                let advanced_translate = this.get_word_propertytounicode(translation, "advanced_translate");
                let advanced_translate_type = this.get_word_propertytounicode(translation, "advanced_translate_type");
                let phonetic_symbol = {
                    us: wordItem.usPhonetic,
                    uk: wordItem.ukPhonetic
                };
                let plural_form = this.get_word_propertytounicode(translation, "plural_form");
                let image_files = this.toJSON(wordItem.image_files);
                let synonyms = this.get_word_propertytounicode(translation, "synonyms");
                let synonyms_type = this.get_word_propertytounicode(translation, "synonyms_type");
                let word_translation = this.get_word_propertytounicode(translation, "word_translation", "translate_text", []);
                let translation_html = this.create_translation_html(word, word_translation, project_mode)
                let phonetic_symbol_html = this.create_phonetic_symbol_html(wordItem, voice_files, index, phonetic_symbol)
                let sampleimages_html = this.create_sampleimages_html(image_files)
                let haveread_html = this.create_haveread_html(word, id, word_translation, last_readtime)
                let advanced_translate_html = ``
                let synonyms_html = ``
                let plural_html = ``
                if (!brief_mode && !project_mode) {
                    advanced_translate_html = this.create_advanced_html(word, word_id, advanced_translate_type, advanced_translate)
                    synonyms_html = this.create_synonyms_html(word, word_id, synonyms_type, synonyms)
                    plural_html = this.create_plural_html(plural_form)
                }
                wordbox_html += this.create_wordbox_html(
                    word,
                    word_id,
                    phonetic_symbol_html,
                    translation_html,
                    sampleimages_html,
                    advanced_translate_html,
                    synonyms_html,
                    plural_html,
                    haveread_html,
                    word_index,
                    id,
                    pre_render,
                    project_mode,
                )
                index++
            }
            return wordbox_html
        }


        create_wordbox_html(
            word,
            word_id,
            phonetic_symbol_html,
            translation_html,
            sampleimages_html,
            advanced_translate_html,
            synonyms_html,
            plural_html,
            haveread_html,
            word_index,
            id,
            pre_render,
            project_mode
        ) {
            if (
                !phonetic_symbol_html &&
                !translation_html &&
                !sampleimages_html &&
                !advanced_translate_html &&
                !synonyms_html &&
                !plural_html &&
                !haveread_html
            ) {
                //advanced_translate_html = `No translations found`
            }
            let visibility_html = ''
            let preload_data = false
            if (pre_render) {
                visibility_html = `visibility:hidden;height:1px;overflow:hidden;`
                preload_data = true
            }

            let title_class = project_mode ? `project_title` : `box-title`
            let html = `
            <div class="col-12" id="${word_id}" data-word="${word}" data-preload="${preload_data}" data-index="${word_index}" data-wordid="${id}" style="${visibility_html}">
              <div class="box box-default">
                <div class="box-header-translate">
                  <h5 class="${title_class} word_h5">${word}</h5>
                  ${phonetic_symbol_html}
                  ${translation_html}
                  ${plural_html}
                </div>
                <div class="box-body">
                    ${sampleimages_html}
                    ${synonyms_html}
                    ${advanced_translate_html}
                    ${haveread_html}
                </div>
              </div>
            </div>
            `
            return html
        }

        create_haveread_html(word, id, word_translation, last_readtime) {
            let html = ``
            if (!last_readtime || last_readtime.startsWith('1970')) {
                last_readtime = ''
            }
            if (last_readtime) {
                last_readtime = `<p class="last-read-time" >last-read-time: ${last_readtime}</p>`
            }
            //if (word_translation.length > 0) {
            html += `<div class="box-footer">
                    <button onclick="window.MyDict.submit_hasreaded('${id}','+1',true)" class="btn btn-success btn-flat"><i class="fa fa-check-circle" aria-hidden="true"></i> </button>
                    <button onclick="window.MyDict.submit_hasreaded('${id}','-1',true)" class="btn btn-flat btn-secondary"><i class="fa fa-coffee" aria-hidden="true"></i> </button>
                    <button onclick="window.MyDict.get_like(this)" class="btn btn-flat btn-secondary"><i class="fa fa-external-link-square" aria-hidden="true"></i>Like</button>
                    <button onclick="window.MyDict.re_translatewords(this.dataset.word)" style="float: right;" class="btn btn-flat btn-light"><i class="fa fa-refresh" aria-hidden="true"></i> re-t</button>
                    ${last_readtime}
                </div> `
            // }
            return html
        }

        create_plural_html(plural_form) {
            let html_tab = ""
            let html = ""
            let plural_html = ""

            plural_form.forEach((item, index) => {
                let delimiter = item.indexOf("Form") != -1
                if (delimiter) {
                    if (plural_html) {
                        html_tab += `
                        <code >${plural_html}</code> 
                        `
                        plural_html = ""
                    }
                    plural_html = `<span class="text-muted">${item}</code>`
                } else {
                    plural_html += ` ${item}`
                }
            })
            if (html_tab) {
                html = `
                <h6 class="box-subtitle">
                    ${html_tab}
                </h6>
                `
            }
            return html
        }

        create_synonyms_html(word, word_id, advanced_translate_type, advanced_translate) {
            let html_tab = ""
            let html = ""
            let tab_content_html = ""
            advanced_translate_type.forEach((item, index) => {
                let random_string = this.gen_randomstring(32)
                word_id = `tab_${word_id}${random_string}`
                item = this.split_html(item)
                let active_class = ""
                if (index == 0) {
                    active_class = "active"
                }
                html_tab += `
                        <li class="nav-item"> <a class="nav-link ${active_class}" data-toggle="tab" href="#${word_id}" role="tab">
                            <span class="hidden-sm-up">
                            </span> <span class="">${item}</span></a> 
                        </li>
                `
                let advanced_translate_item = advanced_translate[index]
                if (!advanced_translate_item) {
                    advanced_translate_item = []
                }
                let advanced_translate_html = this.analyze_advanced_translate(advanced_translate_item, "", "code", word)
                tab_content_html += `
                        <div class="tab-pane ${active_class}" id="${word_id}" role="tabpanel">
                            <div class="p-0">
                                    ${advanced_translate_html}
                            </div>
                        </div>
                `
            })
            if (html_tab) {
                html = `
                    <div class="customvtab">
                        <ul class="nav nav-tabs customtab2" role="tablist">
                            ${html_tab}
                        </ul>
                        <!-- Tab panes -->
                        <div class="tab-content">
                            ${tab_content_html}
                        </div>
                    </div>
                `
            }
            return html
        }

        create_advanced_html(word, word_id, advanced_translate_type, advanced_translate) {
            let html_tab = ""
            let html = ""
            let tab_content_html = ""
            advanced_translate_type.forEach((item, index) => {
                item = this.split_html(item)
                let random_string = this.gen_randomstring(32)
                word_id = `tab_${word_id}${random_string}`
                let active_class = ""
                if (index == 0) {
                    active_class = "active"
                }
                html_tab += `
                        <li class="nav-item">
                        <a class="nav-link ${active_class}" data-toggle="tab" href="#${word_id}" role="tab">
                            <span class="hidden-sm-up">
                            </span> <span class="">${item}</span></a> 
                        </li>
                `
                let advanced_translate_html = this.analyze_advanced_translate(advanced_translate[index], "<br />", "w_css", word)
                tab_content_html += `
                        <div class="tab-pane ${active_class}" id="${word_id}" role="tabpanel">
                            <div class="p-0">
                                <p>
                                    ${advanced_translate_html}
                                </p>
                            </div>
                        </div>
                `
            })
            if (html_tab) {
                html = `
                    <div class="customvtab">
                        <ul class="nav nav-tabs customtab2" role="tablist">
                            ${html_tab}
                        </ul>
                        <!-- Tab panes -->
                        <div class="tab-content">
                            ${tab_content_html}
                        </div>
                    </div>
                `
            }
            return html
        }

        analyze_advanced_translate(advanced_translate, br = "", tag_class = "w_css", word) {
            let html = ``
            let continuous = null
            let explanation_html = null
            let code_content_html = `<div class="de_co"><div class="def_pa">`
            let code_content_close = `</div></div>`
            if (tag_class == "code") {
                code_content_html = `<span>`
                code_content_close = `</span><br />`
                br = ",&nbsp;"
            }
            if (!advanced_translate) {
                advanced_translate = []
            }
            advanced_translate.forEach((trans_item, index) => {
                if (this.is_word_self(index, word, trans_item)) {
                    html += `<div class="word-title">${trans_item}${br}</div>`
                } else if (this.is_word_redandancy(trans_item)) {

                } else if (this.is_word_type(trans_item)) {
                    continuous = null
                    if (explanation_html) {
                        explanation_html = null
                        html += code_content_close
                    }
                    if (tag_class == "code") {
                        html += `
                        <code>${trans_item}</code>
                        `
                    } else {
                        html += `
                        <div class="pos_lin">
                        <div class="pos pull-left ">${trans_item}</div>
                        </div>
                        `
                    }
                } else if (this.is_word_number(trans_item)) {
                    continuous = null
                    if (explanation_html) {
                        explanation_html = null
                        html += code_content_close
                    }
                    html += `<div class="se_n_d">${trans_item}</div>`
                } else if (this.is_word_notes(trans_item)) {
                    html += `<code>${trans_item}</code>`
                } else {
                    if (!continuous) {
                        explanation_html = code_content_html
                        html += explanation_html
                        continuous = true
                    }
                    html += `${trans_item}${br}`
                }
            })
            if (explanation_html && continuous) {
                explanation_html = null
                html += code_content_close
            }
            return html
        }

        is_word_type(word_type) {
            let word_types = [
                "n.",
                "v.",
                "Web",
                "prep.",
                "abbr.",
                "n.",
                "adj.",
                "vt.",
                "adj.",
                "IDM",
                "pron.",
                "adv.",
                "etc.",
                "pron.",
            ]
            let result = null
            word_types.forEach(function (type_oneitem) {
                word_type = word_type.toLowerCase().trim()
                if (word_type.startsWith(type_oneitem.toLowerCase())) {
                    result = word_type
                    return
                }
            })
            return result
        }

        create_sampleimages_html(image_files) {
            let html = ""
            if (!image_files || !this.showImage) return html
            let image_index = 0
            for (let i = 0; i < image_files.length; i++) {
                let item_term = image_files[i]
                if (image_index >= this.MAX_SHOW_MAXIMAGES) {
                    break
                }
                image_index++
                html += `
                <a href="javascript:;" class="bg-warning-light rounded text-center overflow-hidden">
                    <img  src="${item_term.filename}" class="align-self-end" alt="" style="max-height:100%;">
                </a>
                `
            }
            if (html) {
                html = `
                <div class="d-flex box-bottom-10px">
                    <div class="d-flex-image" style="display:flex;">
                        ${html}
                    </div>
                </div>
                `
            }
            return html
        }

        create_translation_html(word, word_translation, isProject = false) {
            let html = ""
            if (word_translation.length == 0) {
                return html
            }
            let subtitleclassname = isProject ? "project_subtitle" : `word_subtitle`
            word_translation.forEach((item, index) => {
                let trans_type = this.get_array_plusvalue(item, 0)
                let trans_info
                try {
                    trans_info = item.slice(1).join("")
                } catch (e) {
                    trans_info = item
                    console.log(e)
                }
                let html_item = ""
                let html_css = "bg-primary-light"
                if (trans_type && trans_type.toLowerCase() == "web") {
                    html_css = "bg-success-light"
                }
                if (trans_type) {
                    html_item = `
                    <h6 class="box-subtitle ${subtitleclassname}">
                    <span class="pull-left ${html_css}">${trans_type}</span> 
                    <span class="translate_span" >${trans_info}</span><button type="button" onclick="window.MyDict.showpinyin(this)" class="waves-effect btn btn-circle btn-xs-py mb-0"><i class="mdi mdi-file-powerpoint-box"></i></button>
                    </h6>
                    `
                    if (typeof pinyinPro !== "undefined") {
                        let pinyin_text = pinyinPro.pinyin(trans_info)
                        html_item += `
                        <h6 class="box-pinyintitle ${subtitleclassname}" style="display:none;">
                        <span class="translate_pinyinspan" >${pinyin_text}</span>
                        </h6>
                        `
                    }
                    html += html_item
                }
            })
            return html
        }

        isNewPhoneticName(voice_static_key) {
            if (!voice_static_key) return ""
            if (voice_static_key.startsWith("gbEdge")) {
                return "uk"
            } else if (voice_static_key.startsWith("usEdge")) {
                return "us"
            } else if (voice_static_key.startsWith("ukBing")) {
                return "uk"
            } else if (voice_static_key.startsWith("usBing")) {
                return "us"
            } else {
                return ""
            }
        }

        create_phonetic_symbol_html(wordItem, voice_files, index, phonetic_symbol) {
            let html = ""
            if (!voice_files) return html
            const content = wordItem.content
            if (Object.keys(voice_files).length == 0) {
                return html
            }
            let voiceindex = 0



            let hasUs = false, hasUk = false
            let isonlyshow = this.PHONETIC_ONLY_SHOW ? true : false
            let isonlyAlreadyShow = false

            for (let [key, voice_static_val] of Object.entries(voice_files)) {
                if (
                    (!isonlyshow && voiceindex >= this.PHONETIC_SHOW_MAX)
                    ||
                    (isonlyshow && isonlyAlreadyShow)
                ) {
                    break
                }
                const voice_nickname = this.isNewPhoneticName(key)
                if (voice_nickname == "us" && hasUs) {
                    continue
                } else if (voice_nickname == "uk" && hasUk) {
                    continue
                } else if (voice_nickname != this.PHONETIC_ONLY_SHOW && isonlyshow) {
                    continue
                }
                if (voice_nickname == "us" && !hasUs) {
                    hasUs = true
                } else if (voice_nickname == "uk" && !hasUk) {
                    hasUk = true
                }
                if (isonlyshow && voice_nickname == this.PHONETIC_ONLY_SHOW) {
                    isonlyAlreadyShow = true
                }
                const static_url = this.joinUrl(this.BASE_STAIC_URL, `${this.STATIC_PATH}/${voice_static_val}`)
                html += `
                <span class="phonetic_span">${voice_nickname}</span>
                    <audio data-word="${content}" class="phoneticvoice" preload="auto" oncanplay="window.MyDict.audio_oncanplay(this)">
                        <source src="${static_url}" type="audio/mp3">
                    </audio>
                <a class="waves-effect waves-light btn btn-xs disabled"  href="javascript:;" onclick="MyDict.play_voice(this)">
                    <i class="fa fa-volume-up"></i>
                </a>
                `
                voiceindex++
            }
            if (html) {
                html = `
                <h6 class="box-subtitle" style="margin-top: 10px;margin-bottom: 10px;">
                    ${html}
                </h6>
                `
            }
            return html
        }

        get_word_propertytounicode(word_json, key, defult_value = [], default_valuenew) {
            let value = this.get_word_property(word_json, key, defult_value, default_valuenew)
            value = this.tounicode(value)
            return value
        }

        get_word_property(word_json, key, defult_value = [], default_valuenew) {
            if (word_json && key in word_json) {
                return word_json[key];
            }
            if (typeof defult_value == "string") {
                if (word_json) {
                    key = defult_value

                    defult_value = []
                } else {
                    defult_value = default_valuenew ? default_valuenew : defult_value
                    return defult_value
                }
            }
            if (word_json && typeof word_json == "object" && word_json[key]) {
                return word_json[key]
            }
            return defult_value
        }

        tounicode(obj) {
            if (Array.isArray(obj)) {
                obj = this.arraytounicode(obj)
            } else if (typeof obj === 'string') {
                obj = this.strtounicode(obj)
            }
            return obj
        }

        strtounicode(str) {
            if (Array.isArray(str)) {
                str = this.arraytounicode(str)
            } else if (typeof str === 'string' && str.indexOf("\\") == -1) {
                const pattern = /[\da-fA-F]{4}/g;
                const hasUnicode = pattern.test(str);
                if (hasUnicode) {
                    str = this.plainstrtounicode(str)
                }
            }
            return str
        }

        arraytounicode(arr) {
            for (let i = 0; i <= arr.length - 1; i++) {
                if (Array.isArray(arr[i])) {
                    arr[i] = this.arraytounicode(arr[i])
                } else if (typeof arr[i] === 'string') {
                    arr[i] = this.strtounicode(arr[i])
                }
            }
            return arr
        }


        plainstrtounicode(inputString) {
            if (inputString.indexOf("\\") != -1) {
                return inputString
            }
            const isUnicode = /^[a-zA-Z0-9]{4}$/i;
            let outputString = "";
            let i = 0;
            while (i < inputString.length) {
                const unicodeStr = inputString.substr(i + 1, 4);
                if (inputString[i] == "u" && isUnicode.test(unicodeStr)) {
                    const unicodeCode = parseInt(unicodeStr, 16);
                    outputString += String.fromCharCode(unicodeCode);
                    i += 5;
                } else {
                    outputString += inputString[i];
                    i += 1;
                }
            }
            return outputString;
        }

        get_origindata(word, key) {
            let origin = null
            for (let index = 0; index < this.origindata.length; index++) {
                let element = this.origindata[index];
                if (element[1] == word) {
                    origin = element
                    break
                }
            }
            if (key && origin) {
                switch (key) {
                    case "id":
                        return origin[0]
                    case "translation":
                        return origin[3]
                    case "read_time":
                        return origin[7]
                    case "word_sort":
                        return origin[8]
                    case "phonetic_us":
                        return origin[9]
                    case "phonetic_us_sort":
                        return origin[10]
                    case "phonetic_uk":
                        return origin[11]
                    case "phonetic_uk_sort":
                        return origin[12]
                    case "phonetic_uk_length":
                        return origin[14]
                    case "phonetic_us_length":
                        return origin[15]
                }
            }
            return origin
        }

        showpinyin(ele) {
            if (ele) {
                ele = ele.parentElement.nextElementSibling
                if (ele) {
                    let display = 'block'
                    if (ele.style.display == "block") {
                        display = 'none'
                    }
                    ele.style.display = display
                }
            }
        }

        initCSS(intoElement = document, cssText) {
            if (!cssText) cssText = this.createTextCSS()
            const target = intoElement === document ? document.head : intoElement;
            const cssHash = this.hashCode(cssText);
            const styleId = `injected-style-${cssHash}`;
            const existingStyle = target.querySelector(`style#${styleId}`);
            if (existingStyle) {
                return existingStyle;
            }
            const styleElement = document.createElement('style');
            styleElement.id = styleId;
            styleElement.type = 'text/css';
            if (styleElement.styleSheet) {
                styleElement.styleSheet.cssText = cssText;
            } else {
                styleElement.appendChild(document.createTextNode(cssText));
            }
            try {
                target.insertBefore(styleElement, target.firstChild);
            } catch (e) {
                target.appendChild(styleElement);
            }
            return styleElement;
        }

        hashCode(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0; // Convert to 32bit integer
            }
            return Math.abs(hash);
        }

        createTextCSS() {
            return `
    /* Bing Dictionary Card - Isolated Styles */
    .dict_wrap_p {
      overflow: hidden;
    }
    .dict_wrap_p .col-12 {
      font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
      margin-bottom: 16px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
      width: 100%;
    }
    
    .dict_wrap_p .box.box-default {
      border: none;
      background: transparent;
    }
    
    .dict_wrap_p .box-header-translate {
      padding: 16px 16px 8px;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .dict_wrap_p .project_title {
      font-size: 24px;
      font-weight: 600;
      color: #1a0dab;
      margin: 0 0 4px 0;
    }
    
    .dict_wrap_p .box-subtitle {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #666;
      margin: 6px 0;
      line-height: 1.4;
    }
    
    .dict_wrap_p .phonetic_span {
      margin-right: 8px;
      font-weight: 500;
    }
    
    .dict_wrap_p .btn-xs {
      padding: 2px 6px;
      margin-left: 8px;
      min-width: 24px;
    }
    
    .dict_wrap_p .pull-left {
      display: inline-block;
      width: 40px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
      margin-right: 8px;
      color: white;
    }
    
    .dict_wrap_p .bg-primary-light {
      background-color: #4a6baf;
    }
    
    .dict_wrap_p .bg-success-light {
      background-color: #3a8a3a;
    }
    
    .dict_wrap_p .bg-warning-light {
      background-color: #f8f9fa;
      border: 1px solid #eaeaea;
      display: inline-block;
      width: 120px;
      height: 120px;
      padding: 8px;
    }
    
    .dict_wrap_p .translate_span {
      flex: 1;
      color: #222;
    }
    
    .dict_wrap_p .box-body {
      padding: 0 16px;
    }
    
    .dict_wrap_p .d-flex-image {
      padding: 8px 0;
    }
    
    .dict_wrap_p .box-footer {
      display: flex;
      padding: 8px 16px;
      background: #f9f9f9;
      border-top: 1px solid #eee;
    }
    .dict_wrap_p .btn {   
     display: block;
        min-width: 20px;
        height: 20px;
    }
    .fa-volume-up {
        /* Basic icon styling */
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;  
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        background-color: #f0f0f0;  /* Light gray background */
        color: #333;  /* Dark text/icon color */
        transition: all 0.2s ease;

        /* Speaker icon (can be replaced with an SVG or font icon) */
        &::before {
            content: "🔊";  /* Default emoji, replace with your preferred icon */
            font-size: 14px;
        }

        /* Hover effect */
        &:hover {
            background-color: #e0e0e0;  /* Slightly darker on hover */
            transform: scale(1.05);
        }

        /* Active/pressed effect */
        &:active {
            transform: scale(0.95);
        }

        /* If using a custom SVG/icon font (recommended) */
        /* .icon { width: 16px; height: 16px; } */
    }
    .dict_wrap_p .box-footer button {
      margin-right: 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .dict_wrap_p .btn-success {
      background-color: #4CAF50;
      color: white;
    }
    
    .dict_wrap_p .btn-secondary {
      background-color: #e0e0e0;
      color: #555;
    }
    
    .dict_wrap_p .btn-light {
      background-color: transparent;
      color: #666;
    }
    
    /* Audio button hover effects */
    .dict_wrap_p .btn-xs:hover {
      opacity: 0.9;
      transform: scale(1.05);
    }
    
    /* Image styling */
    .dict_wrap_p img {
      max-width: 100%;
      height: auto;
      object-fit: contain;
    }
    .dict_wrap_p .last-read-time {
      font-size: 12px;
      color: #737373;
    }
    
    /* Ensure these styles take precedence */
    .dict_wrap_p * {
      box-sizing: border-box;
      line-height: 1.5;
    }
      .words-list {
    width: 100%; /* or your preferred width */
    height: 400px; /* or your preferred fixed height */
    overflow-y: auto; /* enables vertical scrolling */
    display: flex;
    flex-direction: column;
    align-items: center; /* centers horizontally */
    justify-content: flex-start; /* stacks items vertically from top */
    box-sizing: border-box; /* includes padding in height calculation */
    }

    /* Optional: Style the scrollbar */
    .words-list::-webkit-scrollbar {
    width: 8px;
    }

    .words-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    }

    .words-list::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
    }

    .words-list::-webkit-scrollbar-thumb:hover {
    background: #555;
    }
            `
        }

    }
    return BingWordParse;
}));
