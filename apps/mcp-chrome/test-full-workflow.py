#!/usr/bin/env python3

"""
Full Worker Workflow Test with Demo Mode
- Pulls tasks with real untranslated words
- Generates fake translation data
- Frontend decides demo mode (submits is_demo_mode: true)
- Backend will NOT write to database when is_demo_mode=true
"""

import json
import uuid
import time
import requests
from datetime import datetime

API_URL = 'http://localhost:9000'
WORKER_ID = f"demo-worker-{uuid.uuid4()}"
TASK_COUNTER = 0

def log(msg, level='INFO'):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] [{level}] {msg}")

def generate_fake_translation(word, word_md5):
    """Generate fake translation data for demo mode"""
    fake_translations = {
        'apple': 'n. 苹果\nadj. 苹果的',
        'banana': 'n. 香蕉',
        'computer': 'n. 计算机；电脑',
        'mountain': 'n. 山；山脉',
        'river': 'n. 河流；江',
        'desert': 'n. 沙漠\nv. 遗弃',
        'forest': 'n. 森林',
        'ocean': 'n. 海洋',
        'algorithm': 'n. 算法',
        'network': 'n. 网络',
        'database': 'n. 数据库',
        'server': 'n. 服务器',
        'security': 'n. 安全；保障',
    }

    explanation = fake_translations.get(word.lower(), f'n. {word}的中文翻译\nv. {word}的动词形式')

    return {
        'word': word,
        'md5': word_md5,
        'explanation': explanation,
        'phonetic': f'/{word[:3]}/',
        'us_phonetic': f'/{word[:3]}ʊ/',
        'uk_phonetic': f'/{word[:3]}ə/',
        'provider': 'demo_fake'
    }

def register_worker():
    log('Registering worker...')
    response = requests.post(f"{API_URL}/api/worker/register", json={
        'worker_id': WORKER_ID,
        'worker_name': 'Demo Full Workflow Worker',
        'processor_types': ['remote_client'],
        'platform': 'demo-test',
        'metadata': {'mode': 'full_workflow', 'demo': True}
    })
    response.raise_for_status()
    log(f"✓ Worker registered: {WORKER_ID[:30]}...")

def send_heartbeat():
    requests.post(f"{API_URL}/api/worker/heartbeat", json={
        'worker_id': WORKER_ID
    }, timeout=5)

def pull_tasks():
    response = requests.get(f"{API_URL}/api/worker/tasks/pull", params={
        'worker_id': WORKER_ID,
        'limit': 1,
        'timeout': 10
    }, timeout=15)

    if response.status_code != 200:
        return []

    data = response.json()
    return data['data']['tasks'] if data['data']['count'] > 0 else []

def process_task(task):
    global TASK_COUNTER
    TASK_COUNTER += 1

    task_id = task['task_id']
    payload = task['payload']

    log(f'Processing task #{TASK_COUNTER}: {task_id[:20]}...')
    log(f"  Words: {payload['word_count']}")
    log(f"  Demo mode: {payload['is_demo_mode']}")

    print('\n' + '='*70)
    print(f"TASK #{TASK_COUNTER}")
    print('='*70)
    print(f"Task ID: {task_id}")
    print(f"Type: {task['task_type']}")
    print(f"Word Count: {payload['word_count']}")
    print(f"Demo Mode: {payload['is_demo_mode']}")

    # Generate fake translations
    explanations = []

    print("\nGenerating fake translations...")
    for word_data in payload['words']:
        word = word_data['word']
        word_md5 = word_data['md5']

        fake_translation = generate_fake_translation(word, word_md5)
        explanations.append(fake_translation)

        print(f"  ✓ {word}: {fake_translation['explanation'].split(chr(10))[0]}")

    return explanations

def submit_result(task_id, explanations, is_demo_mode=True):
    """
    Submit result to backend
    is_demo_mode: True = Demo模式，后端不写数据库
                  False = 真实模式，后端写入数据库
    """
    log(f'Submitting result for task {task_id[:20]}... (Demo: {is_demo_mode})')

    result_data = {
        'explanations': explanations,
        'is_demo_mode': is_demo_mode  # 前端控制demo模式
    }

    response = requests.post(f"{API_URL}/api/worker/tasks/result", json={
        'task_id': task_id,
        'worker_id': WORKER_ID,
        'status': 'completed',
        'progress': 100,
        'result': result_data
    }, timeout=10)

    if response.status_code == 200:
        log('✓ Result submitted successfully', 'SUCCESS')
        return True
    else:
        log(f'✗ Submit failed: HTTP {response.status_code}', 'ERROR')
        try:
            error_data = response.json()
            log(f'  Error: {error_data.get("message", "Unknown error")}', 'ERROR')
        except:
            pass
        return False

def main():
    print('='*70)
    print('Full Worker Workflow Test - Demo Mode (10 Cycles)')
    print('='*70)
    print(f"API URL: {API_URL}")
    print(f"Worker ID: {WORKER_ID[:40]}...")
    print("\n说明：")
    print("- 后端返回真实未翻译单词")
    print("- 前端生成模拟翻译数据（DEMO数据）")
    print("- 前端提交时标记 is_demo_mode=True")
    print("- 后端检测到demo模式，接收但不写入数据库")
    print("- 测试10个周期后验证未翻译词数不变")
    print("\nPress Ctrl+C to stop...\n")

    try:
        register_worker()

        processed_count = 0
        max_tasks = 10  # 测试10个周期

        while processed_count < max_tasks:
            log('Polling for tasks...')
            send_heartbeat()

            tasks = pull_tasks()

            if not tasks:
                log('No tasks available, waiting...')
                time.sleep(5)
                continue

            task = tasks[0]
            log(f'✓ Task pulled and assigned: {task["task_id"][:20]}...', 'SUCCESS')

            # Process task (generate fake translations)
            explanations = process_task(task)

            # Simulate processing time
            log('Simulating translation time (2s)...')
            time.sleep(2)

            # Submit result with demo mode flag
            # is_demo_mode=True: 前端控制，后端不写数据库
            success = submit_result(task['task_id'], explanations, is_demo_mode=True)

            if success:
                processed_count += 1
                print('\n' + '='*70)
                log(f'Task completed! ({processed_count}/{max_tasks})', 'SUCCESS')
                print('='*70 + '\n')

            time.sleep(1)

        print('\n' + '='*70)
        log(f'All {max_tasks} tasks completed!', 'SUCCESS')
        print('='*70)

        # 验证Demo模式：检查未翻译词数是否仍然是25
        print('\n' + '='*70)
        log('验证Demo模式效果...', 'INFO')
        print('='*70)

        try:
            import subprocess
            result = subprocess.run([
                'php', 'artisan', 'tinker', '--execute',
                "$stats = App\\Apps\\AppQyV1\\AppQyV1Services\\AppQyV1DictionaryService::getStatistics('english');" +
                "echo '验证结果：' . PHP_EOL;" +
                "echo '总词数: ' . $stats['total_words'] . PHP_EOL;" +
                "echo '已翻译: ' . $stats['translated'] . PHP_EOL;" +
                "echo '未翻译: ' . $stats['untranslated'] . PHP_EOL;" +
                "echo '翻译进度: ' . $stats['translation_progress'] . '%' . PHP_EOL;"
            ], cwd='/www/programing/core_node/poly_apps/laravel_main', capture_output=True, text=True)

            print(result.stdout)

            if '未翻译: 25' in result.stdout:
                log('✓ Demo模式验证成功：未翻译词数未改变（仍为25）', 'SUCCESS')
                log('✓ 后端正确处理了Demo模式，没有写入数据库', 'SUCCESS')
            else:
                log('⚠ 警告：未翻译词数发生了变化', 'WARN')

        except Exception as e:
            log(f'验证失败: {str(e)}', 'ERROR')

        print('='*70)

    except KeyboardInterrupt:
        print('\n\nTest interrupted by user')
    except Exception as e:
        log(f'Error: {str(e)}', 'ERROR')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
