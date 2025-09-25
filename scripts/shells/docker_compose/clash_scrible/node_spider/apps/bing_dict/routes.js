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

const Util = require('../../node_provider/utils.js');

const dict = async (data, spider) => {
    const { dict: word } = data;
    const browser = await spider.getBrowser();
    console.log(data);
    console.log(word);
    let result = {};

    if (word) {
        await browser.page.open_single('https://www.bing.com/dict');
        await browser.handle.type('#sb_form_q', word, true);
        await browser.handle.clickElementBySelector('#sb_form_go');
        await browser.page.wait();

        result = await browser.page.evaluate(async () => {
            const wordTrans = {};

            wordTrans.word = document.querySelector('.hd_div strong')?.textContent.trim();

            wordTrans.word_translation = Array.from(document.querySelectorAll('.qdef .hd_area'))
                .map(el => el.nextElementSibling?.textContent.trim())
                .filter(Boolean);

            // 获取音标和发音
            const phoneticElements = document.querySelectorAll('.hd_area [lang]');
            wordTrans.voice_files = {};
            wordTrans.phonetic_dict = {};
            Array.from(phoneticElements).forEach((el, index) => {
                const phonetic = el.textContent.trim();
                const audioUrl = el.querySelector('audio')?.src;
                if (audioUrl) {
                    wordTrans.voice_files[audioUrl] = {
                        url: audioUrl,
                        phonetic: phonetic
                    };
                    wordTrans.phonetic_dict[`phonetic_${index + 1}`] = {
                        url: audioUrl,
                        phonetic: phonetic
                    };
                }
            });

            // 获取复数形式
            wordTrans.plural_form = Array.from(document.querySelectorAll('.qdef .hd_if'))
                .map(el => el.textContent.trim());

            // 获取示例图片
            wordTrans.sample_images = Array.from(document.querySelectorAll('.qdef .simg img'))
                .map(img => img.src);

            // 获取同义词类型
            wordTrans.synonyms_type = Array.from(document.querySelectorAll('.wd_div .tb_div h2'))
                .map(el => el.textContent.trim());

            // 获取同义词
            wordTrans.synonyms = Array.from(document.querySelectorAll('.wd_div .tb_div'))
                .map(el => el.nextElementSibling?.textContent.trim())
                .filter(Boolean);

            // 获取高级翻译类型
            wordTrans.advanced_translate_type = Array.from(document.querySelectorAll('.df_div .tb_div h2'))
                .map(el => el.textContent.trim());

            // 获取高级翻译
            wordTrans.advanced_translate = Array.from(document.querySelectorAll('.df_div .tb_div'))
                .map(el => el.nextElementSibling?.textContent.trim())
                .filter(Boolean);

            return wordTrans;
        });

        if (result.sample_images && result.sample_images.length > 0) {
            result.sample_images = result.sample_images.map(async (url) => ({
                url,
                download: {
                    save_filename: await Util.urltool.savefile(url, url),
                    url: url,
                    dynamic_url: false,
                }
            }));
        }

        const youdaoVoiceUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=1`;
        result.voice_files['voice_youdao'] = {
            save_filename: await Util.urltool.savefile(youdaoVoiceUrl,`${word}_youdao`),
            url: youdaoVoiceUrl,
            dynamic_url: false,
        };
    }

    return result;
};

module.exports = {
    dict
};