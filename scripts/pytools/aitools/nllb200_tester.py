#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NLLB-200 Model Tester
Reusable testing script for Facebook's No Language Left Behind translation model
Supports 196 languages
"""

import os
import sys
from pathlib import Path


COMMON_LANGUAGES = {
    'eng_Latn': 'English',
    'zho_Hans': 'Chinese (Simplified)',
    'zho_Hant': 'Chinese (Traditional)',
    'spa_Latn': 'Spanish',
    'fra_Latn': 'French',
    'deu_Latn': 'German',
    'jpn_Jpan': 'Japanese',
    'kor_Hang': 'Korean',
    'rus_Cyrl': 'Russian',
    'ara_Arab': 'Arabic',
    'hin_Deva': 'Hindi',
    'por_Latn': 'Portuguese',
    'vie_Latn': 'Vietnamese',
    'tha_Thai': 'Thai',
    'ita_Latn': 'Italian',
    'tur_Latn': 'Turkish',
    'pol_Latn': 'Polish',
    'ukr_Cyrl': 'Ukrainian',
    'nld_Latn': 'Dutch',
    'swe_Latn': 'Swedish',
}


def test_model(model_name='facebook/nllb-200-distilled-600M', source_lang='eng_Latn', target_lang='zho_Hans', test_text=None):
    """
    Test NLLB-200 model loading and translation

    Args:
        model_name: HuggingFace model name
        source_lang: Source language code (e.g., 'eng_Latn')
        target_lang: Target language code (e.g., 'zho_Hans')
        test_text: Optional test text to translate

    Returns:
        bool: True if test succeeded, False otherwise
    """
    try:
        os.environ['HF_HOME'] = os.path.join(os.path.expanduser('~'), '.cache', 'huggingface')

        print('[TEST] Importing transformers...')
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

        print(f'[INFO] Model: {model_name}')
        print('[INFO] First run will download model from HuggingFace (~1.2GB)')
        print('[INFO] This may take a few minutes...')
        print()

        print('[TEST] Loading tokenizer...')
        tokenizer = AutoTokenizer.from_pretrained(model_name, src_lang=source_lang)
        print('[OK] Tokenizer loaded successfully')

        print('[TEST] Loading model...')
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        print('[OK] Model loaded successfully')

        if test_text is None:
            test_text = 'Hello! This is a test of the NLLB-200 translation model.'

        print('[TEST] Testing translation...')
        print(f'[INFO] Source language: {source_lang} ({COMMON_LANGUAGES.get(source_lang, "Unknown")})')
        print(f'[INFO] Target language: {target_lang} ({COMMON_LANGUAGES.get(target_lang, "Unknown")})')
        print(f'[Input] {test_text}')

        inputs = tokenizer(test_text, return_tensors='pt')

        forced_bos_token_id = tokenizer.convert_tokens_to_ids(target_lang)
        translated_tokens = model.generate(
            **inputs,
            forced_bos_token_id=forced_bos_token_id,
            max_length=512
        )

        translation = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
        print(f'[Output] {translation}')
        print('[OK] Translation test successful')

        print()
        print('[SUCCESS] ========================================')
        print('[SUCCESS]   NLLB-200 is ready!')
        print('[SUCCESS]   Supports 196 languages')
        print('[SUCCESS] ========================================')

        return True

    except Exception as e:
        print(f'[ERROR] Test failed: {e}')
        import traceback
        traceback.print_exc()
        return False


def interactive_translator(model_name='facebook/nllb-200-distilled-600M'):
    """
    Start an interactive translation session

    Args:
        model_name: HuggingFace model name
    """
    try:
        os.environ['HF_HOME'] = os.path.join(os.path.expanduser('~'), '.cache', 'huggingface')

        print('Loading NLLB-200 translation model...')
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

        print('[INFO] This may take a moment on first run...')
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

        print('Model loaded successfully!')
        print()
        print('========================================')
        print('  NLLB-200 Interactive Translator')
        print('  196 Languages Support')
        print('========================================')
        print()
        print('Common language codes:')
        for code, name in sorted(COMMON_LANGUAGES.items())[:10]:
            print(f'  {code}: {name}')
        print('  ... and 186 more languages')
        print()
        print('Commands:')
        print("  'help' - Show common language codes")
        print("  'exit', 'quit', 'q' - Exit translator")
        print('========================================')
        print()

        source_lang = 'eng_Latn'
        target_lang = 'zho_Hans'

        print(f'Default: {source_lang} -> {target_lang}')
        print("Change with: 'source <lang>' or 'target <lang>'")
        print()

        while True:
            try:
                user_input = input(f'{source_lang} > ').strip()

                if user_input.lower() in ['exit', 'quit', 'q']:
                    print('Goodbye!')
                    break

                if user_input.lower() == 'help':
                    print()
                    print('Common language codes:')
                    for code, name in sorted(COMMON_LANGUAGES.items()):
                        print(f'  {code}: {name}')
                    print()
                    continue

                if user_input.lower().startswith('source '):
                    new_lang = user_input[7:].strip()
                    source_lang = new_lang
                    print(f'Source language set to: {source_lang}')
                    print()
                    continue

                if user_input.lower().startswith('target '):
                    new_lang = user_input[7:].strip()
                    target_lang = new_lang
                    print(f'Target language set to: {target_lang}')
                    print()
                    continue

                if not user_input:
                    continue

                tokenizer.src_lang = source_lang
                inputs = tokenizer(user_input, return_tensors='pt')

                forced_bos_token_id = tokenizer.convert_tokens_to_ids(target_lang)
                translated_tokens = model.generate(
                    **inputs,
                    forced_bos_token_id=forced_bos_token_id,
                    max_length=512
                )

                translation = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
                print(f'{target_lang} < {translation}')
                print()

            except KeyboardInterrupt:
                print()
                print('Translation interrupted. Goodbye!')
                break
            except Exception as e:
                print(f'Error: {e}')
                print('Tip: Check language codes with "help" command')
                print()

    except Exception as e:
        print(f'[ERROR] Failed to start translator: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='NLLB-200 Model Tester and Translator')
    parser.add_argument('--model', default='facebook/nllb-200-distilled-600M', help='Model name')
    parser.add_argument('--interactive', action='store_true', help='Start interactive translator')
    parser.add_argument('--source', default='eng_Latn', help='Source language code')
    parser.add_argument('--target', default='zho_Hans', help='Target language code')
    parser.add_argument('--text', default=None, help='Text to translate')

    args = parser.parse_args()

    if args.interactive:
        interactive_translator(args.model)
    else:
        success = test_model(args.model, args.source, args.target, args.text)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
