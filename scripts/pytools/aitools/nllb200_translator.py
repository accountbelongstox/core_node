#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json

# Authenticate to the HF Hub from the project secret store (.secret_keys/
# .secret_ignore: HF_TOKEN_1..5 then HF_TOKEN) before transformers runs, so model
# downloads are not rate-limited "unauthenticated" requests.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hf_secret import ensure_hf_token

ensure_hf_token()


LANGUAGE_CODE_MAP = {
    'zh': 'zho_Hans',
    'zh-CN': 'zho_Hans',
    'zh-TW': 'zho_Hant',
    'en': 'eng_Latn',
    'ja': 'jpn_Jpan',
    'ko': 'kor_Hang',
    'fr': 'fra_Latn',
    'de': 'deu_Latn',
    'es': 'spa_Latn',
    'ru': 'rus_Cyrl',
    'ar': 'ara_Arab',
    'pt': 'por_Latn',
    'it': 'ita_Latn',
    'nl': 'nld_Latn',
    'pl': 'pol_Latn',
    'tr': 'tur_Latn',
    'vi': 'vie_Latn',
    'th': 'tha_Thai',
    'hi': 'hin_Deva',
    'uk': 'ukr_Cyrl',
    'sv': 'swe_Latn',
}


def normalize_language_code(lang_code):
    if lang_code in LANGUAGE_CODE_MAP:
        return LANGUAGE_CODE_MAP[lang_code]
    return lang_code


def translate_text(text, source_lang='auto', target_lang='zh', model_name='facebook/nllb-200-distilled-600M'):
    try:
        os.environ['HF_HOME'] = os.path.join(os.path.expanduser('~'), '.cache', 'huggingface')

        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

        source_lang_code = 'eng_Latn' if source_lang == 'auto' else normalize_language_code(source_lang)
        target_lang_code = normalize_language_code(target_lang)

        tokenizer = AutoTokenizer.from_pretrained(model_name, src_lang=source_lang_code)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

        tokenizer.src_lang = source_lang_code
        inputs = tokenizer(text, return_tensors='pt')

        forced_bos_token_id = tokenizer.convert_tokens_to_ids(target_lang_code)
        translated_tokens = model.generate(
            **inputs,
            forced_bos_token_id=forced_bos_token_id,
            max_length=512
        )

        translation = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

        return {
            'success': True,
            'translation': translation,
            'source_lang': source_lang_code,
            'target_lang': target_lang_code,
            'model': model_name
        }

    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }


def main():
    if len(sys.argv) > 1:
        params = json.loads(sys.argv[1])
        text = params.get('text', '')
        source_lang = params.get('source_lang', 'auto')
        target_lang = params.get('target_lang', 'zh')
        model_name = params.get('model_name', 'facebook/nllb-200-distilled-600M')

        result = translate_text(text, source_lang, target_lang, model_name)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({'success': False, 'error': 'No parameters provided'}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
