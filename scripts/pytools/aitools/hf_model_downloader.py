#!/usr/bin/env python3

import os
import sys
import time
from typing import Optional

# Authenticate to the HF Hub from the project secret store (.secret_keys/
# .secret_ignore: HF_TOKEN_1..5 then HF_TOKEN) before transformers runs, so model
# downloads are not rate-limited "unauthenticated" requests.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hf_secret import ensure_hf_token

ensure_hf_token()

def setup_hf_environment(cache_dir: Optional[str] = None):
    if cache_dir is None:
        cache_dir = os.path.join(os.path.expanduser('~'), '.cache', 'huggingface')

    os.environ['HF_HOME'] = cache_dir
    os.environ['TRANSFORMERS_CACHE'] = os.path.join(cache_dir, 'hub')
    os.environ['HF_HUB_CACHE'] = os.path.join(cache_dir, 'hub')

    os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '1'

    os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '3600'

    return cache_dir

def download_model_with_retry(model_name: str, max_retries: int = 3, retry_delay: int = 5):
    setup_hf_environment()

    print(f'[INFO] Downloading model: {model_name}')
    print(f'[INFO] Max retries: {max_retries}')
    print(f'[INFO] Cache directory: {os.environ["HF_HOME"]}')
    print('')

    from transformers import AutoModel, AutoTokenizer, AutoConfig

    for attempt in range(1, max_retries + 1):
        try:
            print(f'[ATTEMPT {attempt}/{max_retries}] Loading model config...')
            config = AutoConfig.from_pretrained(
                model_name,
                trust_remote_code=True,
                resume_download=True
            )
            print('[OK] Config loaded')

            print(f'[ATTEMPT {attempt}/{max_retries}] Loading tokenizer...')
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True,
                resume_download=True
            )
            print('[OK] Tokenizer loaded')

            print(f'[ATTEMPT {attempt}/{max_retries}] Loading model (this may take a while)...')
            model = AutoModel.from_pretrained(
                model_name,
                trust_remote_code=True,
                resume_download=True
            )
            print('[OK] Model loaded successfully')

            print('')
            print('[SUCCESS] ========================================')
            print(f'[SUCCESS]   {model_name} downloaded!')
            print('[SUCCESS] ========================================')
            print('')

            return True

        except Exception as e:
            error_msg = str(e)
            print(f'[ERROR] Attempt {attempt} failed: {error_msg}')

            if attempt < max_retries:
                print(f'[INFO] Retrying in {retry_delay} seconds...')
                print('')
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print('')
                print('[FAILED] ========================================')
                print(f'[FAILED]   Download failed after {max_retries} attempts')
                print('[FAILED] ========================================')
                print('')
                print('[INFO] Suggestions:')
                print('[INFO] 1. Check your internet connection')
                print('[INFO] 2. Try again later (HuggingFace servers may be busy)')
                print('[INFO] 3. Use HuggingFace mirror if available')
                print(f'[INFO] 4. Manually download model to: {os.environ["HF_HOME"]}')
                print('')
                return False

    return False

def check_model_cached(model_name: str) -> bool:
    setup_hf_environment()

    try:
        from transformers import AutoModel

        model = AutoModel.from_pretrained(
            model_name,
            trust_remote_code=True,
            local_files_only=True
        )
        print(f'[OK] Model {model_name} is cached locally')
        return True
    except Exception:
        print(f'[INFO] Model {model_name} not found in cache, will download')
        return False

def main():
    if len(sys.argv) < 2:
        print('Usage: python hf_model_downloader.py <model_name> [max_retries]')
        print('')
        print('Examples:')
        print('  python hf_model_downloader.py deepseek-ai/deepseek-vl-1.3b-chat')
        print('  python hf_model_downloader.py deepseek-ai/deepseek-vl-1.3b-chat 5')
        sys.exit(1)

    model_name = sys.argv[1]
    max_retries = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    if not check_model_cached(model_name):
        success = download_model_with_retry(model_name, max_retries=max_retries)
        sys.exit(0 if success else 1)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
