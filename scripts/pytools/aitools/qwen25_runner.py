#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen2.5-0.5B-Instruct Model Runner
Reusable script for Qwen2.5 model validation and interactive chat
"""

import os
import sys
from pathlib import Path

# Authenticate to the HF Hub from the project secret store (.secret_keys/
# .secret_ignore: HF_TOKEN_1..5 then HF_TOKEN) before transformers runs, so model
# downloads are not rate-limited "unauthenticated" requests.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hf_secret import ensure_hf_token

ensure_hf_token()


def test_model(model_name='Qwen/Qwen2.5-0.5B-Instruct', test_prompt=None):
    """
    Validate Qwen2.5 model loading and generation

    Args:
        model_name: HuggingFace model name
        test_prompt: Optional test prompt (defaults to a simple introduction)

    Returns:
        bool: True if validation succeeded, False otherwise
    """
    try:
        os.environ.setdefault('HF_HOME', os.environ.get('CORE_NODE_CACHE_DIR', '/var/_core_node/cache') + '/huggingface')
        os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '3600'

        print('[RUN] Importing transformers...')
        from transformers import AutoModelForCausalLM, AutoTokenizer

        print(f'[INFO] Model: {model_name}')
        print('[INFO] First run will download model from HuggingFace (~1GB)')
        print('[INFO] Download timeout: 3600s (1 hour)')
        print('[INFO] This may take a few minutes...')
        print()

        print('[RUN] Loading tokenizer...')
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        print('[OK] Tokenizer loaded successfully')

        print('[RUN] Loading model...')
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype='auto',
            device_map='auto'
        )
        print('[OK] Model loaded successfully')

        # Use provided prompt or default
        if test_prompt is None:
            test_prompt = 'Hello! Please introduce yourself briefly.'

        print('[RUN] Validating generation...')
        messages = [
            {'role': 'system', 'content': 'You are Qwen, created by Alibaba Cloud. You are a helpful assistant.'},
            {'role': 'user', 'content': test_prompt}
        ]
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        model_inputs = tokenizer([text], return_tensors='pt').to(model.device)

        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=256
        )
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
        print('[OK] Generation validation successful')
        print()
        print('[User]', test_prompt)
        print('[Qwen]', response)

        print()
        print('[SUCCESS] ========================================')
        print('[SUCCESS]   Qwen2.5-0.5B-Instruct is ready!')
        print('[SUCCESS] ========================================')

        return True

    except Exception as e:
        print(f'[ERROR] Validation failed: {e}')
        import traceback
        traceback.print_exc()
        return False


def interactive_chat(model_name='Qwen/Qwen2.5-0.5B-Instruct'):
    """
    Start an interactive chat session

    Args:
        model_name: HuggingFace model name
    """
    try:
        os.environ.setdefault('HF_HOME', os.environ.get('CORE_NODE_CACHE_DIR', '/var/_core_node/cache') + '/huggingface')

        print('Loading Qwen2.5-0.5B-Instruct model...')
        from transformers import AutoModelForCausalLM, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype='auto',
            device_map='auto'
        )

        print('Model loaded successfully!')
        print()
        print('========================================')
        print('  Qwen2.5-0.5B-Instruct Interactive Chat')
        print('========================================')
        print()
        print('Type your questions and press Enter')
        print("Type 'exit', 'quit', or 'q' to end chat")
        print('========================================')
        print()

        conversation_history = [
            {'role': 'system', 'content': 'You are Qwen, created by Alibaba Cloud. You are a helpful assistant.'}
        ]

        while True:
            try:
                user_input = input('User: ').strip()

                if user_input.lower() in ['exit', 'quit', 'q']:
                    print('Goodbye!')
                    break

                if not user_input:
                    continue

                conversation_history.append({'role': 'user', 'content': user_input})

                text = tokenizer.apply_chat_template(
                    conversation_history,
                    tokenize=False,
                    add_generation_prompt=True
                )
                model_inputs = tokenizer([text], return_tensors='pt').to(model.device)

                generated_ids = model.generate(
                    **model_inputs,
                    max_new_tokens=512
                )
                generated_ids = [
                    output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
                ]

                response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
                print(f'Qwen: {response}')
                print()

                conversation_history.append({'role': 'assistant', 'content': response})

            except KeyboardInterrupt:
                print()
                print('Chat interrupted. Goodbye!')
                break
            except Exception as e:
                print(f'Error: {e}')
                print()

    except Exception as e:
        print(f'[ERROR] Failed to start chat: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Qwen2.5-0.5B-Instruct Model Runner')
    parser.add_argument('--model', default='Qwen/Qwen2.5-0.5B-Instruct', help='Model name')
    parser.add_argument('--chat', action='store_true', help='Start interactive chat')
    parser.add_argument('--prompt', default=None, help='Validation prompt')

    args = parser.parse_args()

    if args.chat:
        interactive_chat(args.model)
    else:
        success = test_model(args.model, args.prompt)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

