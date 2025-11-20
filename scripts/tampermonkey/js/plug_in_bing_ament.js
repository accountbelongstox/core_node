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

(() => {
    const base_remote_url = window.location.origin
    class WordListParse {
        global_config = {
            group: {
                current_id: null,
                current_page: {
                    //id:0
                },
            },
            settings: {
                per_words: { name: "每页词数", value: 100 },
                per_dayreads: { name: "每天阅读", value: 2000 },
                maxplays: { name: "播放", value: 1 },
                maxreview: { name: "复习", value: 1 },
                glimpse: { name: "闪读", value: 0 },
                duration_delay: { name: "延迟倍数(s)", value: 0.5 },
                pre_delay: { name: "前置等待", value: 0.5 },
                reviewday: { name: "复习天数", value: 60 },
                wordliky: { name: "单词相似(%)", value: 30 },
                phoneticliky: { name: "音标相似(%)", value: 30 },
                show_maxphonetic: { name: "音标显示数", value: 1 },
                show_maximages: { name: "图片显示数", value: 2 },
                pre_load: { name: "预加载余词", value: 50 },
                pre_render: { name: "预渲染余词", value: 50 },
            }
            ,
            reviewlist: {
                time: "value"
            },
            daily_readed: [],
            autoplay: false,
        }

        origindata = null
        init_global_settingstoken = false
        voice_playevent = null //语音播放事件
        is_getgrouping = false
        current_wordshowed = null
        review_model = null
        tailshowing = null
        //最在复习天数
        re_translatewordsarray = []
        regetwordsvoice = []
        reloadjstoken = null
        wordstatus = {}
        wordstatus_length = 0
        voice_autoplaying = false
        preloadgroupdata = null
        downhalf_preloadgroupdata = null
        waitrealrender = false
        audiocanplays = []
        test_network_status = 0

        #canplay = false
        wordshasreaded = {}//已读提交
        submit_hasreadedwords = []//已读提交临时文件

        constructor() {

            if (typeof pinyinPro == 'undefined') {

                this.load_js([
                    "js/pinyin-pro.js",
                    "js/JSLINQ.js",
                    "js/pako.min.js",
                ])
            }
        }

        init_browser() {
            this.full_pally()
            if (typeof pinyinPro == 'undefined') {
                setTimeout(() => {
                    this.init_browser()
                }, 1000)
            } else {
                // this.schedule(10000)
                if (!window.reloadjstoken) {
                    this.init_global_settings()
                    this.listing_init()
                    this.get_groups()
                }
            }
            window.onerror = function (message, url, line, column, error) {
                alert("Error: " + message + "\nURL: " + url + "\nLine: " + line + "\nColumn: " + column + "\nStackTrace: " + error.stack);
                return true;
            }
        }


        remote_url(method) { let url = `${this.get_remove_url()}/api?method=${method}&key=9LrQN0~14,dSmoO^&module=com_translate`; return url; }
        get_remove_url() { if (typeof base_remote_url == 'string') { this.base_remote_url = base_remote_url; } if (!this.base_remote_url) { this.base_remote_url = window.location.origin; } this.base_remote_url = this.base_remote_url.replace(/\/+$/, ''); return this.base_remote_url; }
        authenticate(request_data) {
            let userid = this.get_currentuserid();
            let username = this.get_currentusername();
            if (!userid || !username) {
                alert("登陆已过期,请重新登陆")
                window.location.href = '/login'
                return null
            }
            if (!request_data) {
                request_data = {}
            }
            request_data.userid = userid
            request_data.username = username
            request_data.compress = true
            return request_data
        }
        get(method, request_data) { request_data = this.authenticate(request_data); if (!request_data) return; let url = this.remote_url(method); return new Promise((resolve, reject) => { $$.get(url, request_data, (data) => { data = this.to_json(data); resolve(data) }) }) }
        post(method, data) { data = this.authenticate(data); if (!data) return; let url = this.remote_url(method); return new Promise((resolve, reject) => { $$.post(url, data, (data) => { data = this.to_json(data); resolve(data) }) }) }
        to_json(obj) {
            if (typeof obj === 'string') {
                obj = this.uncompress_string(obj)
                if (this.is_json_str(obj)) {
                    try {
                        obj = JSON.parse(obj);
                    } catch (e) {
                        return obj;
                    }
                } else {
                    return obj;
                }
            }
            if (typeof obj === 'object' && obj !== null) {
                for (let key in obj) {
                    obj[key] = this.to_json(obj[key]);
                }
            } else {
                return obj
            }
            return obj;
        }
        is_json_str(str) {
            let is_json_reg = /^\s*[\{\[]/
            if (is_json_reg.test(str)) {
                return true
            }
            return false
        }
        remote_resourceurl(suffix) { return `${this.get_remove_url()}/static/${suffix}`; }
        split_html(html) { html = html.replaceAll(/<.+?>/g, ''); return html }
        create_id(word) { if ($ && $.md5 && word) { word = word.toString(); word = $.md5(word); word = `id${word}` } return word }
        gen_randomstring(len = 32) { let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_"; var result = ''; for (var i = len; i > 0; --i) { result += chars[Math.floor(Math.random() * chars.length)] } return result }
        get_array_value(array, index) { if (array.length >= index + 1) { return array[index] } return null }
        timestamp_todate(time, format = 'Y-M-D h:m:s') { let date; if (typeof time == 'object') { date = time } else { if (this.numeric(time)) { time = parseInt(time) } date = new Date(time) } let Y = date.getFullYear(); let M = this.fill_alphabet(date.getMonth() + 1, 2, '0'); let D = this.fill_alphabet(date.getDate(), 2, '0'); let h = this.fill_alphabet(date.getHours(), 2, '0'); let m = this.fill_alphabet(date.getMinutes(), 2, '0'); let s = this.fill_alphabet(date.getSeconds(), 2, '0'); format = format.replace('Y', Y); format = format.replace('M', M); format = format.replace('D', D); format = format.replace('h', h); format = format.replace('m', m); format = format.replace('s', s); return format }
        date_totimestamp(time) { if (!time) { time = new Date() } else if (typeof time == 'string' || typeof time == 'number') { time = new Date(time) } let timesdamp = Date.parse(time); return timesdamp }
        numeric(n) { let numbric = /^\d+$/; if (numbric.test(n)) { return true } return false }
        fill_alphabet(s, l, fill_s = "0") { s = s + ""; s = s.padStart(l, fill_s); return s }
        create_time(format, index = 0) { let dateTime = new Date(); if (typeof format === 'string') { let date_format = format.split(' '); date_format = date_format[0]; date_format = date_format.split('-'); let year = date_format[0]; let month = date_format[1]; let day = date_format[2]; let is_int = /^\d+$/; if (is_int.test(year) && is_int.test(month) && is_int.test(day)) { year = parseInt(year); month = parseInt(month); day = parseInt(day); dateTime.setFullYear(year, month, day); if (date_format.length > 1) { format = `yyyy-MM-dd hh:mm:ss` } else { format = `yyyy-MM-dd` } } } else { format = `yyyy-MM-dd hh:mm:ss` } var z = { y: dateTime.getFullYear(), M: dateTime.getMonth() + 1, d: dateTime.getDate() + index, h: dateTime.getHours(), m: dateTime.getMinutes(), s: dateTime.getSeconds() }; return format.replace(/(y+|M+|d+|h+|m+|s+)/g, function (v) { return ((v.length > 1 ? "0" : "") + eval("z." + v.slice(-1))).slice(-(v.length > 2 ? v.length : 2)) }) }
        replace_class(ele, original_class, target_class) { this.remove_class(ele, original_class); this.add_class(ele, target_class); }
        add_class(ele, class_name) { ele = this.get_removeclassandaddclasselements(ele); for (let i = 0; i < ele.length; i++) { let child = ele[i]; let class_names = child.className; if (!class_names) { class_names = `` } class_names = class_names.split(/\s+/); if (!class_names.includes(class_name)) { class_names.push(class_name) } child.className = class_names.join(` `) } }
        remove_class(ele, class_name) { ele = this.get_removeclassandaddclasselements(ele); for (let i = 0; i < ele.length; i++) { let child = ele[i]; let class_names = child.className; if (!class_names) { class_names = `` } class_names = class_names.split(/\s+/); class_names = this.array_remove(class_names, class_name); child.className = class_names.join(` `) } }
        array_remove(array, val) { for (var i = 0; i < array.length; i++) { if (array[i] == val) { array.splice(i, 1); i-- } } return array }
        get_removeclassandaddclasselements(ele) { if (typeof ele == 'string') { ele = this.queryElementAll(ele) } if (!ele.length) { ele = [ele] } return ele }
        get_query_selector(selector) { selector = selector.trim();/*console.log(`selector ${selector}`); */return selector; }
        queryElement(selector) { selector = this.get_query_selector(selector); let ele = document.querySelector(selector); return ele }
        queryElementAll(selector) { selector = this.get_query_selector(selector); let eles = []; document.querySelectorAll(selector).forEach(ele => { eles.push(ele) }); return eles }
        get_parameter(name) { var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)"); var r = window.location.search.substr(1).match(reg); if (r != null) { return decodeURI(r[2]) } return null }
        next_element(ele, safe = false) { if (ele && ele.nextElementSibling) { return ele.nextElementSibling } if (safe) { return ele } return null }
        prev_element(ele, safe = false) { if (ele && ele.previousElementSibling) { return ele.previousElementSibling } if (safe) { return ele } return null }
        get_grouptojson(data) { let translateindex = 3; data.forEach((item, index) => { let translate = item[translateindex]; translate = this.to_json(translate); data[index][translateindex] = translate; }); return data; }
        // array_remove(arr, value) { return arr.filter((ele)=>{ return ele != value;});}
        unescape(str) { return str }
        list_sortbytime(arr) {
            arr.sort((a, b) => {
                let timeA = a[1] ? a[1] : '1970-01-01'
                let timeB = b[1] ? b[1] : '1970-01-01'
                timeA = Date.parse(timeA);
                timeB = Date.parse(timeB);
                return timeA - timeB;
            });
            return arr
        }
        schedule(interval) {
            if (!this.schedule_tasktoken) {
                this.schedule_tasktoken = setInterval(() => {
                    let net_statuscode = this.updateNetworkStatus()
                    if (net_statuscode >= 3) {
                        this.submit_hasreadedexec()
                    }

                }, interval)
            }
        }

        obj_tolistandsort(obj) {
            obj = this.obj_tolist(obj)
            obj = this.list_sortbytime(obj)
            return obj
        }
        obj_tolist(obj) {
            var newArray = [];
            for (var key in obj) {
                let val = obj[key]
                newArray.push({
                    id: key,
                    read_time: val,
                });
            }
            return newArray
        }
        trim(str, char, type) {
            if (char) {
                if (type == 'left') {
                    return str.replace(new RegExp('^\s*\\' + char + '+', 'g'), '');
                } else if (type == 'right') {
                    return str.replace(new RegExp('\\' + char + '+\s*$', 'g'), '');
                }
                return str.replace(new RegExp('^\s*\\' + char + '+|\\' + char + '+\s*$', 'g'), '');
            }
            return str.replace(/^\s+|\s+$/g, '');
        };

        htmlEncode(str) {
            // 创建一个文本节点，并将要转义的字符串作为其文本内容
            let textNode = document.createTextNode(str);
            // 创建一个临时 div 元素，并将文本节点添加到该元素中
            let div = document.createElement('div');
            div.appendChild(textNode);
            let text = div.innerHTML
            // 获取 div 元素的 innerHTML 属性，它会将字符串转义为 HTML 实体
            div.remove()
            return text;
        }

        is_array(a) {
            if (typeof a === 'object' && Array.isArray(a)) {
                return true
            }
        }

        is_obj(a) {
            if (typeof a === 'object' && !Array.isArray(a)) {
                return true
            }
        }

        is_str(a) {
            if (typeof a === 'string') {
                return true
            }
        }


        dictionarymap_parse(arr) {
            if (!arr) arr = this.get_dictionarymap()
            if (typeof arr == 'string') {
                arr = arr.split(',')
            }
            arr = arr.map(item => {
                let [id, timestamp] = item.split('|');
                let date = new Date(parseInt(timestamp) * 1000); // 乘以1000将秒转换为毫秒
                let formattedTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                return { id: id, time: formattedTime };
            });
            arr = arr.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return arr
        }

        replaceValue(arr, key, value) {
            for (let i = 0; i < arr.length; i++) {
                const [k, v] = arr[i].split("|");
                if (k === key) {
                    arr[i] = `${key}|${value}`;
                    return arr;
                }
            }
            arr.push(`${key}|${value}`);
            return arr;
        }

        find_list_from_obj(ids, obj) {
            let objs = obj.filter((obj) => ids.includes(obj.id)); // 查找数据B中的对象集
            return objs
        }

        find_middle_values(arr, value, n) {
            let startIndex = arr.indexOf(value);
            if (startIndex === -1) {
                return []; // 如果数组中不存在该值，返回 null
            }
            n = parseInt(n)
            startIndex = startIndex + 1
            let find_end = startIndex + n
            let endIndex = (find_end) % arr.length; // 取模操作以支持循环查找
            if (startIndex < endIndex) {
                return arr.slice(startIndex, endIndex);
            } else if (startIndex > endIndex) {
                return [...arr.slice(startIndex + 1), ...arr.slice(0, endIndex)];
            } else {
                return [];
            }
        }


        csort() {
            // Given time in milliseconds
            const givenTime = 1676577188674;

            // Example array
            const array = [
                { 'Alice': { time: 1676577188674, price: 86 }, 'Bob': { time: 1676577188674, price: 86 } },
                { 'Alice': { time: 1676577198674, price: 88 }, 'Bob': { time: 1676577198674, price: 88 } },
                { 'Alice': { time: 1676577208674, price: 90 }, 'Bob': { time: 1676577208674, price: 90 } }
            ];

            // Find the first array that has a time earlier than xx seconds ago
            const xxSecondsAgo = Date.now() - (xx * 1000);
            const firstArray = array.find(item => item['Alice'].time < xxSecondsAgo);

            console.log(firstArray);

        }

        get_wordsbygroup(group_id, limit, preload = false, callback) {
            if (this.is_getgrouping) {
                console.log('get_words by group requisting.')
                return
            }
            this.origindata = []
            this.is_getgrouping = true
            if (!group_id) group_id = this.get_global_settings('group.current_id')

            console.log(`get_words by group start`)
            // let linkedids = this.get_grouplinkedids(group_id)
            // let group_cursor = this.get_cursorbymap(group_id)
            // let dictionarymap = this.dictionarymap_parse()
            // // console.log(`linkedids`, linkedids)
            // // // console.log(`dictionarymap`, dictionarymap)
            // dictionarymap = this.find_list_from_obj(linkedids,dictionarymap)
            // console.log(`dictionarymap`, dictionarymap)
            // // console.log(dictionarymap)
            // dictionarymap = this.dictionarymap_parse(dictionarymap)

            this.wordshasreaded = []
            if (!limit) limit = this.get_grouplimit(group_id)
            let word_end = limit.split(',')[1]
            // let wordids = this.find_middle_values(linkedids, group_cursor, word_end)
            // wordids = wordids.join(',')
            // console.log(`words`, wordids)
            let groupname = this.get_groupname(group_id)
            if (!this.is_existgroup(group_id) || !groupname) {
                this.is_getgrouping = false
                alert('当前组不存在.')
                return
            }
            // let per_words = this.get_global_settings('settings.per_words.value')
            // let group_count = this.get_groupcount(group_id)
            $('.current_group_tab').html(groupname)
            if (!preload) {
                $("#loader").show()
                $("#loader").css('opacity', 0.6)
            }
            this.post("get_wordsbygroup", {
                group_id,
                load_external: group_id,
                // wordids,
                limit,
            }).then((data) => {
                if (data.length > 0) {
                    this.is_getgrouping = false
                    console.log(`words-group(gid:${group_id}) data:`)
                    console.log(data)
                    if (!preload) {
                        try {
                            let group_data = this.get_resolvegroup_words(data)
                            if (
                                group_data.message == "No user"
                            ) {
                                this.is_getgrouping = false
                                $("#loader").hide()
                                alert('当前用户数据不存在.')
                                return
                            }
                        } catch (e) { }
                        this.set_groupwords(data, group_id, preload, callback)
                    } else {
                        if (callback) callback(data, group_id);
                    }
                } else {
                    if (this.get_currentpage() > 0) {
                        this.set_currentpage(0)
                        this.get_wordsbygroup(group_id, limit, preload, callback)
                    } else {
                        this.is_getgrouping = false
                        console.log('not more data!')
                        if (callback) callback(null)
                    }
                }
            })
        }

        wait(m = 1000, callback = null) {
            if (!callback) return
            if (typeof callback == "number") {
                let temp_m = callback
                callback = m
                m = temp_m
            }
            setTimeout(() => {
                if (callback) callback()
            }, m)
        }

        is_translate(item) {
            if (
                item.word_translation ||
                item.advanced_translate ||
                item.advanced_translate_type ||
                item.translate_text ||
                item.plural_form
            ) {
                return true
            }
            return false
        }

        get_readtimefromdata(id, read_time) {
            for (let i = 0; i < read_time.length; i++) {
                let time = read_time[i]
                if (id == time[0]) {
                    return this.timestamp_todate(time[1])
                }
            }
            return this.timestamp_todate(0)
        }
        get_readtimefromtimastamp(timastamp) {
            if (!timastamp) timastamp = 0;
            return this.timestamp_todate(timastamp)
        }

        is2DArray(arr) {
            if (!Array.isArray(arr)) {
                return false;
            }

            for (let i = 0; i < arr.length; i++) {
                if (!Array.isArray(arr[i])) {
                    return false;
                }
            }
            return true;
        }

        get_resolvedata(data) {
            if (data.data) {
                data = data.data
                if (this.is_array(data)) {
                    if (this.is2DArray(data)) {
                        return data
                    }
                    data = data[0]
                }
            }
            return data
        }

        get_resolvegroup_words(data) {
            data = this.get_resolvedata(data)
            if (data.group_words) {
                data = data.group_words
            }
            return data
        }

        set_groupwords(data, group_id, pre_render = false, callback = null) {
            if (!data) {
                console.log("Please provide correct data")
                if (callback) callback()
                return
            } else {
                data = this.get_resolvedata(data)
            }
            if (!group_id) group_id = group_id = this.get_global_settings('group.current_id')
            if (!pre_render) {
                this.origindata = data
                this.set_global_settings(`group.current_id`, group_id)
                this.set_review(false)
            }
            let project_mode = this.get_project_mode()
            let brief_mode = this.get_brief_mode()
            let wordbox_html = "";
            let count = this.get_groupcount()
            let read_allrate = 0
            let unread_count = data.unread_count
            let read_time = data.read_time
            let read_count = count - unread_count
            if (read_count < 0) read_count = 0
            if (read_count > count) read_count = count
            let group_data = this.get_resolvegroup_words(data)
            group_data = this.get_grouptojson(group_data)
            group_data.forEach((item, index) => {
                let
                    id = item[0],
                    word = item[1],
                    word_id = this.create_id(id),
                    read = item[5],
                    word_json = item[3],
                    word_index = index + 1
                    ;
                let last_readtime = item.pop()
                last_readtime = this.get_readtimefromtimastamp(last_readtime)
                let advanced_translate = this.get_word_propertytounicode(word_json, "advanced_translate"),
                    advanced_translate_type = this.get_word_propertytounicode(word_json, "advanced_translate_type"),
                    phonetic_symbol = this.get_word_propertytounicode(word_json, "phonetic_symbol"),
                    plural_form = this.get_word_propertytounicode(word_json, "plural_form"),
                    sample_images = this.get_word_propertytounicode(word_json, "sample_images"),
                    synonyms = this.get_word_propertytounicode(word_json, "synonyms"),
                    synonyms_type = this.get_word_propertytounicode(word_json, "synonyms_type"),
                    voice_files = this.get_word_propertytounicode(word_json, "voice_files"),
                    word_translation = this.get_word_propertytounicode(word_json, "word_translation", "translate_text", [])
                    ;
                let translation_html = this.create_translation_html(word, word_translation)
                let phonetic_symbol_html = this.create_phonetic_symbol_html(word, word_id, voice_files, index)
                let sampleimages_html = this.create_sampleimages_html(word, sample_images)
                let haveread_html = this.create_haveread_html(word, id, word_translation, last_readtime)
                let advanced_translate_html = ``
                let synonyms_html = ``
                let plural_html = ``
                if (!brief_mode && !project_mode) {
                    // haveread_html = this.create_haveread_html(word, word_translation)
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
                )
            })
            let wordbox_contents_html = this.queryElement("#wordbox_contents_html")
            if (pre_render) {
                wordbox_contents_html.innerHTML += wordbox_html
            } else {
                let force = true
                this.clear_beforerendereddata(force)
                wordbox_contents_html.innerHTML = wordbox_html
            }

            document.querySelector(".control-sidebar").setAttribute("class", 'control-sidebar')
            $("#loader").hide()

            if (!pre_render) {
                this.set_readcount(unread_count, read_allrate)
                this.update_groupdata(callback)
            } else {
                if (callback) {
                    callback()
                }
            }
        }

        update_groupdata(callback) {
            this.set_review_count()
            this.re_translatewords()
            this.set_pageprogress()
            this.set_allwordstatus()
            this.wait_allwordstatus(() => {
                $("#loader").hide()
                if (callback) {
                    callback()
                }
            })
        }

        get_project_mode() {
            let mx = 750
            let mn = 740
            let w = window.innerWidth
            if (w > mn && w < mx) {
                return true
            }
            let project_mode = this.local_storage(`project_mode`)
            return project_mode
        }

        set_project_mode() {
            let project_mode = this.get_project_mode()
            project_mode = !project_mode
            let word_title = `.box-header-translate .box-title`
            let word_subtitle = `.box-header-translate .word_subtitle`

            if (project_mode) {
                this.add_class(word_title, `project_title`)
                this.add_class(word_subtitle, `project_subtitle`)
            } else {
                this.remove_class(word_title, `project_title`)
                this.remove_class(word_subtitle, `project_subtitle`)
            }
            this.set_brief_mode(project_mode, null)
            this.set_project_bar(project_mode)
            this.local_storage(`project_mode`, project_mode)
        }

        get_project_mode() {
            let project_mode = this.local_storage(`project_mode`)
            return project_mode
        }

        set_brief_show(brief_mode) {
            let customvtab = `.box-body .customvtab`
            // let box_footer = `.box-body .box-footer`

            if (brief_mode) {
                this.add_class(customvtab, `project_hide`)
                // this.add_class(box_footer, `project_hide`)
            } else {
                this.remove_class(customvtab, `project_hide`)
                // this.remove_class(box_footer, `project_hide`)
            }
        }

        set_project_bar(project_mode) {
            let chat_box_body = `#chat-box-body`
            let sticky_toolbar_bar = `.sticky-toolbar-bar`
            let sticky_toolbar_left = `sticky-toolbar-left`
            let sticky_toolbar_left_toggle = `sticky-toolbar-project-screen`
            // let sticky_toolbar_left_bar = `sticky-toolbar-left-bar`
            // let sticky_toolbar_screen = `sticky-toolbar-screen`
            // let sticky_toolbar = `sticky-toolbar`
            let main_header = `main-header`
            let main_header_app_menu = `${main_header} .app-menu`

            if (project_mode) {
                // this.add_class(chat_box_body, `project_hide`)
                this.add_class(sticky_toolbar_bar, sticky_toolbar_left_toggle)
                this.remove_class(sticky_toolbar_bar, sticky_toolbar_left)
                // this.add_class(sticky_toolbar_left_bar, sticky_toolbar_screen)
                // this.remove_class(sticky_toolbar_left_bar, sticky_toolbar)
                this.add_class(main_header, `main-header-screen`)
                this.add_class(main_header_app_menu, `project_visible`)
            } else {
                // this.remove_class(chat_box_body, `project_hide`)
                this.add_class(sticky_toolbar_bar, sticky_toolbar_left)
                this.remove_class(sticky_toolbar_bar, sticky_toolbar_left_toggle)
                // this.add_class(sticky_toolbar_left_bar, sticky_toolbar)
                // this.remove_class(sticky_toolbar_left_bar, sticky_toolbar_screen)
                this.remove_class(main_header, `main-header-screen`)
                this.remove_class(main_header_app_menu, `project_visible`)
            }
        }

        get_brief_mode() {
            let brief_mode = this.get_global_settings(`group.brief_mode`)
            return brief_mode
        }

        set_brief_mode(brief_mode = undefined, notice = true) {
            if (notice) {
                if (!confirm('是否设置简洁模式')) {
                    return false
                }
            }
            if (brief_mode === undefined || brief_mode.tagName) {
                brief_mode = this.get_brief_mode()
                brief_mode = !brief_mode
                this.set_global_settings(`group.brief_mode`, brief_mode)
            }
            this.set_brief_show(brief_mode)
        }

        set_reviewscount(counts) {
            if (!counts) counts = this.get_global_settings(`reviewlist.count`)
            let count_num = 0
            for (let read_time in counts) {
                let count = counts[read_time]
                count_num += count
            }
            this.queryElement('#reviews-count').innerHTML = `(${count_num})`
        }

        set_reviewhtmlall(counts) {
            if (!counts) counts = this.get_global_settings(`reviewlist.count`)
            let html = ``
            for (let time in counts) {
                let count = counts[time]
                let review_html = this.add_reviewhtml(count, time, true)
                if (review_html) {
                    html += review_html
                }
            }
            if (html) $('.review-list').append(html)
            this.set_reviewscount(counts)
        }

        clear_reviewhtml() {
            $('.review-list').html(``)
        }

        add_reviewhtml(count, time, return_html = false) {
            let review_class = `review-${time}`
            let reviewtime_class = `reviewtime-${time}`
            let review_item = this.queryElement(`.${review_class}`)
            if (review_item) {
                if (!count) {
                    this.set_global_settings(`reviewlist.count.${time}`, count)
                    review_item.remove()
                    return null
                }
                this.queryElement(`.${reviewtime_class}`).innerHTML = `[${count}]`
                this.queryElement(`.${review_class}`).style.display = 'block'
                return null
            }
            if (!count) {
                return null
            }
            let count_text = ' - '
            let display = 'none'
            if (count) {
                count_text = `[${count}]`
                display = 'block'
            }
            let html = `<li class="${review_class}" style='display:${display}'>
                    <a href="javascript:;" data-readtime="${time}" onclick="window.MyDict.get_reviewgroup(this.dataset.readtime)">
                        <i class="fa fa-users text-info"></i> ${time} <span style="color:red;" class="${reviewtime_class}">${count_text}</span>
                    </a>
                </li>`
            if (return_html) {
                return html
            }
            $('.review-list').append(html)

        }

        set_readcount(unread_count, read_allrate) {
            let count = this.get_groupcount()
            let ele = this.queryElement(`.allreadedcount`)
            if (ele) {
                ele.style.width = `${read_allrate}%`
            }
            ele = this.queryElement(`.word_count`)
            if (ele) {
                ele.innerHTML = count
            }
            ele = this.queryElement(`.unread_count`)
            if (ele) {
                ele.innerHTML = unread_count
            }
        }

        get_reviewgroup(read_time) {
            let limit = this.get_grouplimit()
            this.get(`get_review`, { read_time, limit }).then((data) => {
                let group_id = this.get_global_settings("group.current_id")
                let count
                try {
                    count = data.data.length
                } catch (e) {
                    console.log(e)
                }
                if (!count) count = 0
                this.add_reviewhtml(count, read_time)
                this.set_groupwords(data, group_id)
                this.scroll_top()
            })
        }


        set_review_count() {
            let gid = this.get_global_settings("group.current_id")
            let c_timastamp = this.date_totimestamp()
            let day = 60 * 60 * 24 * 1000
            let max_reviewday = c_timastamp - day * this.get_global_settings(`settings.reviewday.value`)
            let counts = {}

            let request = 0
            let response = 0

            this.set_reviewhtmlall()
            let continue_getreviewcount = () => {
                if (c_timastamp <= max_reviewday || this.is_getgrouping) {
                    return
                }
                c_timastamp -= day
                let read_time = this.timestamp_todate(c_timastamp, 'Y-M-D')
                // if (is_noreview) {
                //     this.add_reviewhtml(0, read_time)
                //     setTimeout(() => {
                //         continue_getreviewcount()
                //     }, 200)
                //     return
                // }
                let is_noreview = this.get_global_settings(`reviewlist.noreview.${read_time}`)
                let count = this.get_global_settings(`reviewlist.count.${read_time}`)
                if (is_noreview || count) {
                    this.add_reviewhtml(count, read_time)
                    continue_getreviewcount()
                    return
                }
                request++
                this.get("get_review_count", {
                    gid,
                    read_time,
                }).then((result_data) => {
                    result_data = result_data.data
                    let count = result_data[1]
                    this.add_reviewhtml(count, read_time)
                    this.set_global_settings(`reviewlist.count.${read_time}`, count)
                    if (count > 0) {
                        counts[read_time] = count
                    } else {
                        this.set_global_settings(`reviewlist.noreview.${read_time}`, true)
                    }
                    response++
                    if (response == request) {
                        this.set_global_settings(`reviewlist.count`, null)
                        Object.keys(counts).sort((a, b) => {
                            b = this.date_totimestamp(b)
                            a = this.date_totimestamp(a)
                            return b - a
                        })
                        this.set_global_settings(`reviewlist.count`, counts)
                        this.set_reviewhtmlall(counts)
                    }
                    if (c_timastamp > max_reviewday && !this.is_getgrouping) {
                        setTimeout(() => {
                            continue_getreviewcount()
                        }, 200)
                    }
                })
            }
            continue_getreviewcount()
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
            pre_render
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
            let title_class = this.get_wordtitleclass()
            let html = `
            <div class="col-12" id="${word_id}" data-word="${word}" data-preload="${preload_data}" data-index="${word_index}" data-wordid="${id}" style="${visibility_html}">
			  <div class="box box-default">
				<div class="box-header-translate">
				  <h5 class="${title_class} word_h5">${word}</h5>
				  ${phonetic_symbol_html}
				  ${translation_html}
				  ${plural_html}
				</div>
				<!-- /.box-header -->
				<div class="box-body">
                    ${sampleimages_html}
                    ${synonyms_html}
                    ${advanced_translate_html}
                    ${haveread_html}
					<!-- Nav tabs -->
				</div>
				<!-- /.box-body -->
			  </div>
			  <!-- /.box -->
			</div>
            `
            return html
        }

        get_wordtitleclass() {
            let class_name = `box-title`
            if (this.get_project_mode()) {
                class_name += ` project_title`
            }
            return class_name
        }

        get_wordsubtitleclass() {
            let class_name = `word_subtitle`
            if (this.get_project_mode()) {
                class_name += ` project_subtitle`
            }
            return class_name
        }

        create_haveread_html(word, id, word_translation, last_readtime) {
            let html = ``
            if (!last_readtime || last_readtime.startsWith('1970')) {
                last_readtime = ''
            }
            if (last_readtime) {
                last_readtime = `<p style="color: #737373;">last-read-time: ${last_readtime}</p>`
            }
            //if (word_translation.length > 0) {
            html += `
                <div class="box-footer" style="padding:0px;">
                    <button onclick="window.MyDict.submit_hasreaded('${id}','+1',true)" class="btn btn-success btn-flat"><i class="fa fa-check-circle" aria-hidden="true"></i> </button>
                    <button onclick="window.MyDict.submit_hasreaded('${id}','-1',true)" class="btn btn-flat btn-secondary"><i class="fa fa-coffee" aria-hidden="true"></i> </button>
                    <button onclick="window.MyDict.get_like(this)" class="btn btn-flat btn-secondary"><i class="fa fa-external-link-square" aria-hidden="true"></i>Like</button>
                    <button onclick="window.MyDict.re_translatewords(this.dataset.word)" style="float: right;" class="btn btn-flat btn-light"><i class="fa fa-refresh" aria-hidden="true"></i> re-t</button>
                    ${last_readtime}
                </div>
                `
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

        is_word_redandancy(word_type) {
            word_type = word_type.trim()
            if (word_type == "Show examples") {
                return true
            }
            return null
        }

        is_word_self(index, word, word_type) {
            word_type = word_type.trim()
            if (word_type == word && index == 0) {
                return true
            }
            return null
        }

        is_word_notes(word_type) {
            word_type = word_type.trim()
            if (/^\[.+\]$/.test(word_type)) {
                return word_type
            }
            return null
        }

        is_word_number(word_type) {
            word_type = word_type.trim()
            if (/^[0-9]+\./.test(word_type)) {
                return word_type
            }
            return null
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

        create_sampleimages_html(word, sample_images) {
            let html = ""
            let image_index = 0
            let show_maximages = this.get_global_settings('settings.show_maximages.value')
            if (!show_maximages) {
                show_maximages = 1
            }
            for (let item in sample_images) {
                if (image_index >= show_maximages) {
                    break
                }
                image_index++
                let item_term = sample_images[item]
                let src = item_term.save_filename
                if (src.split(/\./).pop().toLowerCase() == 'none') {
                    this.add_retranslatewords(word)
                } else {
                    html += `
                    <a href="javascript:;" class="bg-warning-light rounded text-center overflow-hidden">
                        <img  src="${item_term.save_filename}" class="align-self-end" alt="" style="max-height:100%;">
                    </a>
                    `
                }
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

        scroll_top() {
            window.scrollTo(document.body.scrollHeight, 0)
        }

        scroll_bottom() {
            window.scrollTo(0, document.body.scrollHeight)
        }

        scroll_to(top) {
            if (typeof top == "string") {
                top = this.queryElement(top).offsetTop
            }
            else if (typeof top == "object") {
                top = top.offsetTop
            }
            top = top + 10
            window.scrollTo(document.body.scrollHeight, top)
        }

        get_firstshowing() {
            if (this.tailshowing) {
                return this.tailshowing
            }
            let showing = this.get_showings()
            if (showing.length > 0) {
                return showing[0]
            }
            let showscreen = this.get_showscreens()
            if (showscreen.length > 0) {
                return showscreen[0]
            }

            let allwordeles = this.get_allwordeles()
            if (allwordeles.length == 0) {
                alert("Not found the first showing-word.")
                return null
            } else {
                return allwordeles[0]
            }
        }

        is_tailshowing() {
            let tail = this.get_allwordeles()
            tail = tail.pop()
            if (tail && this.is_showscreen(tail)) {
                return true
            } else {
                return false
            }
        }

        get_showing(direction = "next") {
            let showing = this.get_firstshowing()
            let is_tailshowing = this.is_tailshowing()
            if (is_tailshowing) {
                if (!this.tailshowing) {
                    this.tailshowing = showing
                } else {
                    showing = this.tailshowing
                }
            } else {
                this.tailshowing = null
            }
            let ids = this.get_wordelement(showing)

            let len
            if (direction == "next") {
                len = this.get_allwordeles().length
            } else {
                len = 1
            }
            if (ids.index == len) {
                return showing
            } else {
                if (direction == "next") {
                    showing = showing.nextElementSibling
                } else {
                    showing = showing.previousElementSibling
                }
            }
            if (is_tailshowing && this.tailshowing) {
                this.tailshowing = showing
            }
            this.current_wordshowed = showing
            return showing
        }


        get_nextshowing() {
            return this.get_showing('next')
        }

        get_prevshowing() {
            return this.get_showing('prev')
        }

        get_showings() {
            let we = this.get_allwordeles()
            let showing = []
            we.forEach(ele => {
                if (this.is_showscreen(ele)) {
                    showing.push(ele)
                }
            })
            return showing
        }

        get_showscreens() {
            let we = this.get_allwordeles()
            let showscreen = []
            we.forEach(ele => {
                if (showscreen.length > 0 && !this.is_showscreen(ele)) {
                    return
                }
                if (this.is_showscreen(ele)) {
                    showscreen.push(ele)
                }
            })
            return showscreen
        }

        get_lastshowing() {
            let showscreens = this.get_showscreens()
            return showscreens.pop()
        }

        is_showscreen(el) {
            if (typeof el == 'string') {
                el = document.querySelector(el)
            }
            let wh = window.innerHeight
            let client_rect = el.getBoundingClientRect()
            let top = client_rect.top
            let bottom = client_rect.bottom
            if (top > 0 && top < wh) {
                return true
            }
            if (bottom > 1 && bottom < wh) {
                return true
            }
            if (top < 0 && bottom > wh) {
                return true
            }
            return false
        }

        getElementTop(el, target_ele) {
            if (!target_ele) target_ele = document.querySelector('html')
            let parent = el.offsetParent;
            let top = el.offsetTop;
            return parent && parent !== target_ele ? this.getElementTop(parent, target_ele) + top : top;
        }

        set_todayprogress(word) {
            let time = this.create_time("yyyy-MM-dd")
            let key = `daily_readed.${time}`
            let daily_readed = this.get_global_settings(key)
            if (!daily_readed) {
                this.set_global_settings(`daily_readed`, null)
                daily_readed = []
            }
            //to Int array.
            for (let i = 0; i < daily_readed.length; i++) {
                daily_readed[i] = parseInt(daily_readed[i])
            }
            let wordid = this.get_idbyword(word)
            if (!daily_readed.includes(wordid)) {
                daily_readed.push(wordid)
                this.set_global_settings(key, daily_readed)
                let today_process = (daily_readed.length / this.get_global_settings(`settings.per_dayreads.value`)) * 100
                let ele = this.queryElement(`.dailyreadedcount`)
                if (ele) {
                    ele.style.width = `${today_process}%`
                }
            }
        }

        set_pageprogress() {
            let ele = this.queryElement(`.pagereadcount`)
            if (!ele) {
                return false
            }
            let readed = 0
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (wordstatus.played) {
                    readed++
                }
            }

            readed = (readed / this.wordstatus_length) * 100
            if (!readed) {
                readed = 0
            }
            ele.style.width = `${readed}%`
        }

        is_voice(ele) {
            let audio = this.get_voicebyelement(ele)
            if (!audio) {
                return false
            }
            return true
        }

        get_prevread() {
            let word_ele = null
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (wordstatus.is_played) {
                    word_ele = wordstatus
                }
            }
            if (word_ele && word_ele.ele && word_ele.ele.previousElementSibling) {
                let word = this.get_wordbyelement(word_ele.ele.previousElementSibling)
                word_ele = this.wordstatus[word]
                return word_ele
            }
            return null
        }

        surplus_unplay() {
            let unplay = 0
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (!wordstatus.is_played) {
                    unplay++
                }
            }
            return unplay
        }

        surplus_unreviewe() {
            let unreviewe = 0
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (!wordstatus.is_reviewed) {
                    unreviewe++
                }
            }
            return unreviewe
        }

        get_firstnotread() {
            let word_ele = null
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (!wordstatus.is_played) {
                    word_ele = wordstatus
                    return word_ele
                }
            }
            return word_ele
        }

        get_firstnotreview() {
            let word_ele = null
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (!wordstatus.is_reviewed) {
                    word_ele = wordstatus
                    return word_ele
                }
            }
            return word_ele
        }

        is_allplayed() {
            let is_allplayed = true
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (!wordstatus.is_played) {
                    is_allplayed = false
                    return is_allplayed
                }
            }
            return is_allplayed
        }

        get_allreviewed() {
            let allreviewed = []
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (wordstatus.is_reviewed) {
                    allreviewed.push(wordstatus)
                }
            }
            return allreviewed
        }

        is_allreviewed() {
            let is_allreviewed = true
            for (let key in this.wordstatus) {
                let wordstatus = this.wordstatus[key]
                if (!wordstatus.is_reviewed) {
                    is_allreviewed = false
                    return is_allreviewed
                }
            }
            return this.is_allplayed() && is_allreviewed
        }

        get_wordelement(ele) {
            if (!ele.dataset || !ele.dataset.word) {
                return this.get_wordelement(ele.parentElement)
            }
            return ele
        }

        wait_voicepaused(voice, callback, index = 0) {
            let max_waittime = 5
            if (index >= max_waittime) {
                return callback(null)
            }
            let voicewaitdelay = 500
            if (!voice.paused) {
                index += voicewaitdelay / 1000//未重载过资源时则叠加加载时长
                setTimeout(() => {
                    return this.wait_voicepaused(voice, callback, index)
                }, voicewaitdelay)
            } else {
                callback(voice)
            }
        }

        wait_voiceready(voice, callback,) {
            let voicewaitdelay = 200
            if (voice.readyState == 4) {
                console.log(`voice installed: readyState ${voice.readyState}`)
                return callback(voice)
            } else {
                setTimeout(() => {
                    return this.wait_voiceready(voice, callback)
                }, voicewaitdelay)
            }
        }

        uninstallvoicebyword(word) {
            delete this.wordstatus[word]
            this.audiocanplays = this.array_remove(this.audiocanplays, word)
            let ele = this.get_elementbyword(word)
            if (ele) ele.remove()
        }

        get_voicesrc(voice) {
            let src = voice.currentSrc
            src = src.replace(window.location.origin, ``)
            return src
        }

        get_voicehtml(src, word) {
            let data_html = ''
            if (word) {
                data_html = `data-word="${word}"`
            }
            // let id = this.create_id(src)
            let voice_html = `<audio ${data_html} class="phoneticvoice" preload="auto" oncanplay="window.MyDict.audio_oncanplay(this)">
                <source src="${src}" type="audio/mp3">
            </audio>`
            return voice_html
        }

        audio_oncanplay(aoduelement) {
            let word = aoduelement.dataset.word
            let a = aoduelement.nextElementSibling
            this.replace_class(a, 'disabled', 'btn-warning-light')
            if (!this.audiocanplays.includes(word)) {
                this.audiocanplays.push(word)
            }
        }

        installvoice(voice_obj, callback) {
            let voicehtml = this.get_voicehtml(voice_obj.src)
            voice_obj.previou.insertAdjacentHTML("afterend", voicehtml)
            let voice = voice_obj.previou.nextElementSibling
            voice.load()
            return this.wait_voiceready(voice, callback)
        }

        play_voice(ele, callback) {
            if (this.check_voiceplaying()) {
                if (callback) callback(true)
                return
            }
            ele = this.get_wordelement(ele)
            let voice = this.get_voicebyelement(ele)
            let word = this.get_wordbyelement(ele)
            if (!voice) {
                this.re_translatewordbyvoice(word)
                this.uninstallvoicebyword(word)
                if (callback) return callback(null)
                return
            }
            this.increment_wordstatus(word)
            this.set_voiceplayingstatus(true)
            this.wait_voicepaused(voice, (wait_voice) => {
                if (wait_voice == null) {
                    this.set_voiceplayingstatus(false)
                    if (callback) callback(null)
                } else {
                    wait_voice.play()
                    this.set_wordstatus(word, 'played', true)
                    this.set_pageprogress()
                    this.wait_voicepaused(voice, () => {
                        this.set_voiceplayingstatus(false)
                        if (callback) callback(wait_voice)
                    })
                }
            })
        }

        set_voiceplayingstatus(status) {
            this.voice_autoplaying = status
            this.voice_autoplayingtime = this.date_totimestamp()
        }

        check_voiceplaying() {
            if (this.voice_autoplaying) {
                let nowtime = this.date_totimestamp()
                let differ_time = nowtime - this.voice_autoplayingtime
                let max_waitseconds = 10 * 1000
                if (differ_time >= max_waitseconds) {
                    this.set_voiceplayingstatus(false)
                    return false
                }
                return true
            } else {
                return false
            }
        }

        is_wordreviewed(word) {
            let wordstatus = this.get_wordstatus(word)
            if (wordstatus.is_reviewed) {
                return true
            }
            return false
        }

        increment_wordstatus(word, key) {
            let wordstatus = this.get_wordstatus(word)
            if (key) {
                wordstatus[key]++
                return this.set_wordstatus(word, key, wordstatus[key])
            }
            let reviewmode = this.is_reviewmode()
            if (!reviewmode) {
                wordstatus.maxplays++
                this.set_wordstatus(word, "maxplays", wordstatus.maxplays)
            } else {
                wordstatus.maxreview++
                this.set_wordstatus(word, "maxreview", wordstatus.maxreview)
            }
            this.equalandset_wordstatus(wordstatus, reviewmode)
        }

        equalandset_wordstatus(word, reviewmode = undefined) {
            let wordstatus
            if (typeof word == "string") {
                wordstatus = this.get_wordstatus(word)
            } else {
                wordstatus = word
                word = wordstatus.word
            }
            if (reviewmode === undefined) {
                reviewmode = this.is_reviewmode()
            }
            if (!reviewmode) {
                if (wordstatus.maxplays >= this.get_global_settings(`settings.maxplays.value`)) {
                    this.set_wordstatus(word, "is_played", true)
                }
            } else {
                if (wordstatus.maxreview >= this.get_global_settings(`settings.maxreview.value`)) {
                    this.set_wordstatus(word, "is_reviewed", true)
                    this.set_todayprogress(word)
                    this.submit_hasreaded(wordstatus.wordid, "-0.1")
                }
            }
            return wordstatus
        }

        set_wordstatus(word, key, value) {
            if (!this.wordstatus[word]) {
                this.get_wordstatus(word)
            }
            if (key && value) {
                this.wordstatus[word][key] = value
            }
        }

        is_wordstatus(ele) {
            if (ele.word && ele.ele) {
                return true
            } else {
                return false
            }
        }

        get_wordstatus(word, index, ele, wordid) {
            if (!this.wordstatus[word]) {
                if (!ele) ele = this.get_elementbyword(word)
                if (!index) index = this.get_indexbyword(word)
                if (!wordid) wordid = this.get_idbyword(word)
                this.wordstatus[word] = {
                    word,
                    wordid,
                    maxglimpse: 0,
                    maxplays: 0,
                    maxreview: 0,
                    canplay: false,
                    voice: this.get_voicebyelement(ele),
                    is_played: false,
                    played: false,
                    is_reviewed: false,
                    index,
                    ele
                }
            }
            return this.wordstatus[word]
        }

        get_voicebyelement(ele) {
            let audio
            if (ele.tagName.toLowerCase() == "a") {
                audio = ele.previousElementSibling
            } else {
                audio = ele.querySelector(`audio`)
            }
            return audio
        }

        get_wordbyelement(ele) {
            if (typeof ele == "string" || !ele) {
                return ele
            }
            ele = this.get_wordelement(ele)
            let word = ele.dataset.word
            return word
        }

        get_elementbyword(word) {
            word = word.replace('"', '\\"')
            word = word.replace("'", "\\'")
            let selector = `div[data-word="${word}"]`
            let ele = document.querySelector(selector)
            return ele
        }

        get_idbyword(word) {
            let id = this.get_elementbyword(word).dataset.wordid
            id = parseInt(id)
            return id
        }

        get_indexbyword(word) {
            let allwordeles = this.get_allwordeles();
            let word_index = 0
            allwordeles.forEach((ele, index) => {
                if (this.get_wordbyelement(ele) == word) {
                    word_index = index
                    return index
                }
            })
            return word_index
        }

        set_allwordstatus() {
            this.wordstatus = {}
            this.wordstatus_length = 0
            let allwordeles = this.get_allwordeles();
            allwordeles.forEach((ele, index) => {
                if (this.is_voice(ele)) {
                    this.wordstatus_length++
                    let word = this.get_wordbyelement(ele)
                    this.get_wordstatus(word, index, ele)
                }
            })
        }

        wait_allwordstatus(callback) {
            if (this.audiocanplays.length > 0) {
                let audiocanplays = this.audiocanplays.slice()
                audiocanplays.forEach((word, index) => {
                    if (this.wordstatus[word]) {
                        this.set_wordstatus(word, "canplay", true)
                        this.audiocanplays = this.array_remove(this.audiocanplays, word)
                    }
                })
            }
            for (let word in this.wordstatus) {
                this._canplay = true
                let wordstatus = this.wordstatus[word]
                if (wordstatus.canplay) {
                    if (callback) {
                        callback()
                    }
                    return
                }
                break
            }
            setTimeout(() => {
                this.wait_allwordstatus(callback)
            }, 1000)
        }

        get_allwordelesandpreload() {
            let we = this.queryElementAll(`div[data-word]`)
            return we
        }

        get_allwordeles() {
            let we = this.queryElementAll(`div[data-preload="false"]`)
            return we
        }

        get_allwordelesbypreload() {
            let we = this.queryElementAll(`div[data-preload="true"]`)
            return we
        }

        allwordelesrender() {
            let we = this.queryElementAll(`div[data-word]`)
            we.forEach((ele) => {
                ele.setAttribute('data-preload', false)
                ele.setAttribute('style', '')
            })
        }

        voice_playtoggle(voice_autoplaytoken = undefined) {
            if (voice_autoplaytoken === true || voice_autoplaytoken === false) {
                this.voice_autoplaytoken = voice_autoplaytoken
            } else {
                this.voice_autoplaytoken = !this.voice_autoplaytoken
            }
            let ele_icon = document.querySelector('#click_voice_playtoggle span')
            if (this.voice_autoplaytoken) {
                this.remove_class(ele_icon, 'si-control-play')
                this.add_class(ele_icon, 'si-control-pause')
                this.wait_allwordstatus(() => {
                    this.voice_autoplay("next")
                })
            } else {
                this.remove_class(ele_icon, 'si-control-pause')
                this.add_class(ele_icon, 'si-control-play')
            }
            this.set_global_settings('autoplay', this.voice_autoplaytoken)
        }

        set_voice_autoplay_timeout(duration, ele) {
            this.voice_playevent = setTimeout(() => {
                clearTimeout(this.voice_playevent)
                this.voice_playevent = null
                this.voice_autoplay(ele)
            }, duration)
        }

        isWebObject(element) {
            return element instanceof HTMLElement;
        }

        isJSONObject() {
            try {
                JSON.parse(JSON.stringify(this.obj));
                return true;
            } catch (e) {
                return false;
            }
        }

        autoplay_getelement(selector) {
            let result = null
            this.message(`${this.message_trim(selector)}`, `autoplay selector:`)
            if (this.isWebObject(selector)) {
                result = selector
            } else {
                if (selector === "prev") {
                    let prevread = this.get_prevread()
                    if (prevread) {
                        result = prevread
                    } else {
                        result = this.get_firstnotread()
                    }
                } else {
                    let firstnotread = this.get_firstnotread()
                    if (firstnotread) {
                        result = firstnotread
                    } else {
                        result = this.get_firstnotreview()
                    }

                }
            }
            console.log("selector", selector, "result", result)
            return result
        }

        get_duration(voice, callback) {
            if (voice.duration) {
                return callback(voice.duration)
            } else {
                setTimeout(() => {
                    this.get_duration(voice, callback)
                }, 500)
            }
        }

        watch_duration(voice) {
            console.dir(voice)
            console.log(voice.paused)
            console.log(voice.played.length)
            setTimeout(() => {
                this.watch_duration(voice)
            }, 500)
        }

        is_preload() {
            let surplus = this.surplus_unplay()
            let preload = this.get_global_settings(`settings.pre_load.value`)
            if (surplus <= preload) {
                return true
            }
            return false
        }

        is_prerender() {
            let surplus = this.surplus_unreviewe()
            let preload = this.get_global_settings(`settings.pre_render.value`)
            if (surplus <= preload) {
                return true
            }
            return false
        }

        is_realrender() {
            let surplus = this.surplus_unreviewe()
            if (surplus == 0) {
                return true
            }
            return false
        }

        clear_alreadyreviewdata() {
            let allreviewed = this.get_allreviewed()
            allreviewed.forEach((wordstatus) => {
                let word = wordstatus.word;
                let ele = wordstatus.ele;
                delete this.wordstatus[word]
                ele.remove()
            })
        }

        clear_beforerendereddata(all = false) {
            let before_renderdata
            if (all) {
                before_renderdata = this.get_allwordelesandpreload()
                this.audiocanplays = []
            } else {
                before_renderdata = this.get_allwordeles()
            }
            before_renderdata.forEach((ele) => {
                let word = this.get_wordbyelement(ele)
                this.array_remove(this.audiocanplays, word)
                ele.remove()
            })
        }

        realrender(callback) {
            if (this.downhalf_preloadgroupdata) {
                this.message(this.downhalf_preloadgroupdata, `prerender down halfdata`)
                let pre_render = true
                this.set_groupwords(this.downhalf_preloadgroupdata, null, pre_render, () => {
                    this.downhalf_preloadgroupdata = null
                })
            }

            this.set_review(false)
            this.waitrealrender = false
            this.clear_beforerendereddata()
            this.allwordelesrender()
            this.update_groupdata(callback)
        }

        preload_prerender() {
            if (this.is_preload() && !this.preloadgroupdata && !this.waitrealrender) {
                let pre_load = true,
                    group_id = null,
                    per_words = this.get_global_settings('settings.per_words.value'),
                    groupwords = Object.keys(this.wordstatus).length,
                    limit = `${per_words},${groupwords}`
                    ;
                //group_id,limit,preload=false
                this.message(`preload group data: limit-${limit}`)
                this.get_wordsbygroup(group_id, limit, pre_load, (data, group_id) => {
                    this.waitrealrender = true
                    this.preloadgroupdata = this.get_resolvedata(data)
                })
            }

            if (this.is_prerender() && this.preloadgroupdata) {
                let group_id = null
                let pre_render = true
                let pre_rendervalue = this.get_global_settings(`settings.pre_render.value`)
                let current_words = Object.keys(this.wordstatus).length
                let halfdata_len = current_words - pre_rendervalue
                if (halfdata_len < 0) halfdata_len = 1

                let group_data = this.get_resolvegroup_words(this.preloadgroupdata)
                let up_halfdata = group_data.splice(0, halfdata_len)
                this.downhalf_preloadgroupdata = group_data
                this.preloadgroupdata = null
                this.message(up_halfdata, `prerender up_halfdata`)
                //尽可能多的删除已经复习过的数据
                this.clear_alreadyreviewdata()
                this.set_groupwords(up_halfdata, group_id, pre_render, () => {
                    this.preloadgroupdata = null
                })
            }
        }

        message_trim(msg, max = 50) {
            if (typeof msg != "string") {
                try {
                    msg = JSON.stringify(msg)
                } catch (e) {
                    msg = "" + msg
                }
            }
            if (msg && msg.length > max) {
                msg.substr(0, max)
            }
            return msg
        }

        voice_autoplay(selector = "next") {
            if (!this.voice_autoplaytoken) {
                return
            }
            if (this.check_voiceplaying()) {
                return this.set_voice_autoplay_timeout(2000, selector)
            }
            let wordstatus = this.autoplay_getelement(selector)

            if (!wordstatus || this.is_realrender()) {
                return this.realrender(() => {
                    this.submit_hasreadedexec()
                    return this.set_voice_autoplay_timeout(500, null)
                })
            }

            this.preload_prerender()

            let word = wordstatus.word
            let ele = this.get_elementbyword(word)
            let ele_id = ele.id
            let is_allreviewed = this.is_allreviewed();
            let is_allplayed = this.is_allplayed();
            let message = []
            message.push(`allreviewed:${this.message_trim(is_allreviewed)}`)
            message.push(`allplayed:${this.message_trim(is_allplayed)}`)
            if (is_allplayed && !this.is_reviewmode()) {//全部读完,并且还不是复习模式,则切换到复习模式并跳转置顶.
                this.set_review(true)
                return this.set_voice_autoplay_timeout(500, null)
            }

            let voice = this.get_voicebyelement(ele)

            message.push(`voice_muted:${this.message_trim(voice.muted)}`)
            this.scroll_to(`#${ele_id}`)
            let pre_time = this.get_global_settings(`settings.pre_delay.value`) * 1000
            setTimeout(() => {
                this.get_duration(voice, (duration) => {
                    duration = this.get_durationdelay(word)
                    this.play_voice(ele, (voice) => {
                        if (!voice) {
                            this.uninstallvoicebyword(word)
                            return this.autoplayskipplayed(duration, null, null, message)
                        }

                        this.equalandset_wordstatus(word, wordstatus)

                        if (wordstatus.is_reviewed) {
                            return this.autoplayskipreviewed(duration, ele, wordstatus, message)
                        }
                        if (wordstatus.is_played) {
                            return this.autoplayskipplayed(duration, ele, wordstatus, message)
                        }
                        return this.set_voice_autoplay_timeout(duration, ele)
                    })
                })
            }, pre_time)
        }

        get_durationdelay(word) {
            let base_seconde = word.length > 10 ? 1500 : 1000
            base_seconde = base_seconde * this.get_global_settings('settings.duration_delay.value')
            return base_seconde
        }

        autoplayskipreviewed(duration, ele, wordstatus, message) {
            message = message.join('<br />')
            this.message(message, `autoplayskipreviewed:`)
            return this.set_voice_autoplay_timeout(duration, "next")
        }

        autoplayskipplayed(duration, ele, wordstatus, message) {
            if (wordstatus && wordstatus.maxglimpse < this.get_global_settings('settings.glimpse.value')) {
                this.increment_wordstatus(wordstatus.word, "maxglimpse")
                return this.set_voice_autoplay_timeout(duration, "prev")
            } else {
                ele = this.next_element(ele, true)
                message = message.join('<br />')
                this.message(message, `autoplayskipplayed`)
                return this.set_voice_autoplay_timeout(duration, "next")
            }
        }

        create_translation_html(word, word_translation) {
            let html = ""
            if (word_translation.length == 0) {
                this.add_retranslatewords(word)
                return html
            }
            let subtitleclassname = this.get_wordsubtitleclass()
            word_translation.forEach((item, index) => {
                let trans_type = this.get_array_value(item, 0)
                let trans_info
                try {
                    trans_info = item.slice(1).join("")
                } catch (e) {
                    trans_info = item
                    this.re_translatewords(word)
                    console.log(e)
                }
                let html_item = ""
                let html_css = "bg-primary-light"
                if (trans_type && trans_type.toLowerCase() == "web") {
                    html_css = "bg-success-light"
                }
                if (trans_type) {
                    let pinyin_text = pinyinPro.pinyin(trans_info)
                    html_item = `
                    <h6 class="box-subtitle ${subtitleclassname}">
                    <span class="pull-left ${html_css}">${trans_type}</span> 
                    <span class="translate_span" >${trans_info}</span><button type="button" onclick="window.MyDict.showpinyin(this)" class="waves-effect btn btn-circle btn-xs-py mb-0"><i class="mdi mdi-file-powerpoint-box"></i></button>
                    </h6>
                    <h6 class="box-pinyintitle ${subtitleclassname}" style="display:none;">
                    <span class="translate_pinyinspan" >${pinyin_text}</span>
                    </h6>
                    `
                    html += html_item
                }
            })
            return html
        }

        create_phonetic_symbol_html(word, word_id, voice_files, index) {
            let html = ""
            if (Object.keys(voice_files).length == 0) {
                this.re_translatewordbyvoice(word)
                return html
            }
            let third_party = false
            let voiceindex = 0

            let show_max = this.get_global_settings('settings.show_maxphonetic.value')
            if (!show_max) {
                show_max = 1
            }

            for (let item in voice_files) {
                if (voiceindex >= show_max) {
                    break
                }
                let voice = voice_files[item]
                let voice_name
                if (voice.iterate_name) {
                    voice_name = voice.iterate_name.replace(/(?<=[a-zA-Z]{2}).+/, "").toLowerCase()
                }
                if (!voice_name) {
                    voice_name = item
                }
                let file_suffixname = voice.save_filename.split('.').pop()
                let filesuffixisnone = file_suffixname == "None"
                if (!voice.save_filename || filesuffixisnone) {
                    this.add_retranslatewords(word)
                    continue
                }
                if (filesuffixisnone) {
                    continue
                }
                let voice_nickname = voice.iterate_name ? voice.iterate_name : ""
                if (!voice_nickname && voice_name) {
                    third_party = true
                    voice_nickname = voice_name.split('_').pop().substr(0, 2)
                }
                html += `
                <span class="phonetic_span">${voice_nickname}</span>
                ${this.get_voicehtml(voice.save_filename, word)}
                <a class="waves-effect waves-light btn btn-xs disabled"  href="javascript:;" onclick="MyDict.play_voice(this)">
                    <i class="fa fa-volume-up"></i>
                </a>
                `
                voiceindex++
            }
            // //没有第三方音频时,重新翻译
            // if (!third_party) {
            //     this.re_translatewordbyvoice(word)
            // }
            if (html) {
                html = `
                <h6 class="box-subtitle" style="margin-top: 10px;margin-bottom: 10px;">
                    ${html}
                </h6>
                `
            }
            return html
        }

        _add_retranslateword(word) {
            if (!this.re_translatewordsarray.includes(word)) {
                this.re_translatewordsarray.push(word)
            }
        }

        add_retranslatewords(words) {
            if (typeof words == 'string') {
                this._add_retranslateword(words)
            } else {
                words.forEach(word => {
                    this._add_retranslateword(word)
                })
            }
        }

        re_translatewords(words) {
            words = this.get_wordbyelement(words)
            if (typeof words == 'string') {
                this.add_retranslatewords(words)
            }
            if (this.retranslatewords_timeout) {
                return
            }
            this.retranslatewords_timeout = setTimeout(() => {
                if (this.re_translatewordsarray.length == 0) {
                    return null
                }
                words = this.re_translatewordsarray.toString()
                this.re_translatewordsarray = []
                this.retranslatewords_timeout = null
                console.log('re-translate: ', words)
                this.post('retranslate_word', {
                    words: words
                }, (data) => {
                    console.log(data)
                })
            }, 5000)
        }

        re_translatewordbyvoice(words) {
            if (typeof words == 'string') {
                this.regetwordsvoice.push(words)
            }
            if (this.regetwordsvoice_timeout) {
                return
            }
            this.regetwordsvoice_timeout = setTimeout(() => {
                if (this.regetwordsvoice.length == 0) {
                    return null
                }
                words = this.regetwordsvoice.toString()
                this.regetwordsvoice = []
                this.regetwordsvoice_timeout = null
                console.log('re-getwordvoice: ', words)
                this.post('add_voice', {
                    words: words
                }, (data) => {
                    console.log(data)
                })
            }, 1000)
        }

        get_word_propertytounicode(word_json, key, defult_value = [], default_valuenew) {
            let value = this.get_word_property(word_json, key, defult_value, default_valuenew)
            value = this.tounicode(value)
            return value
        }

        tounicode(obj) {
            if (this.is_array(obj)) {
                obj = this.arraytounicode(obj)
            } else if (this.is_str(obj)) {
                obj = this.strtounicode(obj)
            }
            return obj
        }

        arraytounicode(arr) {
            for (let i = 0; i <= arr.length - 1; i++) {
                if (this.is_array(arr[i])) {
                    arr[i] = this.arraytounicode(arr[i])
                } else if (this.is_str(arr[i])) {
                    arr[i] = this.strtounicode(arr[i])
                }
            }
            return arr
        }

        strtounicode(str) {
            if (this.is_array(str)) {
                str = this.arraytounicode(str)
            } else if (this.is_str(str) && str.indexOf("\\") == -1) {
                const pattern = /[\da-fA-F]{4}/g;
                const hasUnicode = pattern.test(str);
                if (hasUnicode) {
                    str = this.plainstrtounicode(str)
                }
            }
            return str
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


        get_word_property(word_json, key, defult_value = [], default_valuenew) {
            if (word_json && key in word_json) {
                return word_json[key];
            }
            if (typeof defult_value == "string") {
                if (word_json) {
                    key = defult_value
                    if (word_json.word) {
                        this.re_translatewords(word_json.word)
                    }
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


        message(msg, user = "system", icon = "") {
            // console.log(user, msg)
            let chat_msg = this.queryElement(`#chat-box-body .chat-msg`)
            let prev_class = "self"
            if (chat_msg) {
                prev_class = chat_msg.getAttribute('class')
            }
            let message_type = 'user'
            let message_body_class = ''
            if (prev_class.endsWith('user')) {
                message_type = 'self'
                message_body_class = `justify-content-end`
            }
            if (!msg) return
            let send_time = this.create_time()
            switch (icon) {
                case 'women':
                    icon = `static/picture/2.jpg`
                    break
                case 'man':
                    icon = `static/picture/3.jpg`
                    break
                default:
                    icon = `static/picture/002-google.svg`
                    break
            }
            let msg_html = `<div class="chat-msg ${message_type}">
                <div class="d-flex align-items-center ${message_body_class}">
                    <span class="msg-avatar">
                        <img src="${icon}" class="avatar avatar-lg">
                    </span>
                    <div class="mx-10">
                        <a href="#" class="text-dark hover-primary font-weight-bold">${user}</a>
                        <p class="text-muted font-size-12 mb-0" data-time="${send_time}">${send_time}</p>
                    </div>
                </div>
                <div class="cm-msg-text">
                    ${msg}
                </div>
            </div>`
            this.add_message(msg_html)

        }

        simple_message(msg) {
            if (!msg) return
            let msg_html = `<div class="chat-msg user">
                <div class="cm-msg-text">
                    ${msg}
                </div>
            </div>`
            this.add_message(msg_html)
        }

        add_message(html) {
            let chat_logs = this.queryElement(`#chat-box-body .chat-logs`)
            chat_logs.insertAdjacentHTML("afterbegin", html)
            let chats = this.queryElementAll(`#chat-box-body .chat-msg`)
            let max_chat = 10
            if (chats.length > max_chat) {
                let diference_l = max_chat - chats.length
                chats.forEach((chat, index) => {
                    if (index < diference_l) {
                        chat.remove()
                    }
                })
            }
        }

        trans_refresh() {
            if (!confirm('是否刷新')) {
                return false
            }
            window.location.reload()
            this.scroll_top()
        }

        previou_page_group() {
            let gid = this.get_deraultgid()
            let page = this.get_currentpage(gid)
            if (page == 0) {
                alert(`already is the first page`)
                return
            }
            this.set_global_settings(`group.current_page.${gid}.page`, --page)
            this.get_wordsbygroup()
        }

        next_page_group() {
            let gid = this.get_deraultgid()
            let page = this.get_currentpage(gid)
            let max_page = this.get_groupcount()
            max_page = max_page / this.get_global_settings('settings.per_words.value')
            max_page = Math.ceil(max_page)
            if (page >= max_page) {
                alert(`already is the last page`)
                return
            }
            this.set_global_settings(`group.current_page.${gid}.page`, ++page)
            this.get_wordsbygroup()
        }

        word_skip(action = "next") {
            if (this.voice_autoplaytoken) {//如果当前有自动播放事件
                this.voice_autoplaytoken = false
                this.voice_playtoggle(false)
            }

            let topheight = 60
            if (this.get_project_mode()) {
                topheight = 0
            }

            let next
            if (action == "next") {
                next = this.get_nextshowing()
            } else if (action == "prev") {
                next = this.get_prevshowing()
            }
            next.scrollIntoView()

            let scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            window.scrollTo(0, scrollTop - topheight)
            this.play_voice(next)
        }

        previou_word() {
            this.word_skip("prev")
        }

        next_word() {
            this.word_skip("next")
        }

        get_like(ele) {
            ele = this.get_wordelement(ele)
            let word = this.get_wordbyelement(ele)
            let wordsort = this.get_originwordsort(word)
            let phonetic_ussort = this.get_originphoneticussort(word)
            let phonetic_length = this.get_originphoneticuslength(word)
            if (phonetic_length && phonetic_ussort && wordsort) {
                let wordliky = this.get_global_settings('settings.wordliky.value')
                let phoneticliky = this.get_global_settings('settings.phoneticliky.value')
                console.log(`wordliky`, wordliky)
                console.log(`phonetic_uslength`, phonetic_length)

                let word_length = word.length + Math.ceil((word.length * wordliky) / 100)
                let word_trimlength = Math.ceil((word.length * wordliky) / 100)
                let word_maxlength = word_length + word_length
                let word_trim = word.substr(0, word_trimlength)


                let phonetic_maxlength = phonetic_length + Math.ceil((phonetic_length * phoneticliky) / 100)
                let phonetic_trim = phonetic_ussort.substr(0, phonetic_length)
                let likely = {
                    phonetic_length,
                    phonetic_maxlength,
                    phonetic_trim,
                    word_maxlength,
                    word_trim,
                    word,
                }
                this.get('get_likebyphonetic', likely).then((data) => {
                    data = this.get_grouptojson(data)
                    console.log('get_likebyphonetic')
                    console.log(data)
                })
                this.get('get_likebyword', likely).then((data) => {
                    data = this.get_grouptojson(data)
                    console.log('get_likebyword')
                    console.log(data)
                })
            }
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

        get_origintranslation(word) {
            return this.get_origindata(word, "translation")
        }
        get_originreadtime(word) {
            return this.get_origindata(word, "read_time")
        }
        get_originid(word) {
            return this.get_origindata(word, "id")
        }
        get_originwordsort(word) {
            return this.get_origindata(word, "word_sort")
        }
        get_originphoneticus(word) {
            return this.get_origindata(word, "phonetic_us")
        }
        get_originphoneticuk(word) {
            return this.get_origindata(word, "phonetic_uk")
        }
        get_originphoneticussort(word) {
            return this.get_origindata(word, "phonetic_us_sort")
        }
        get_originphoneticuklength(word) {
            return this.get_origindata(word, "phonetic_uk_length")
        }
        get_originphoneticuslength(word) {
            return this.get_origindata(word, "phonetic_us_length")
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

    }
    const wordListParse = new WordListParse()
})()