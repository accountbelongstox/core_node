#!/usr/bin/env python3

"""
Continuous Worker Task Monitor
Continuously pulls and prints tasks from backend
Press Ctrl+C to stop
"""

import os
import json
import uuid
import time
import requests
from datetime import datetime

API_BASE_URL = 'http://localhost:9000'
WORKER_ID = f"worker-monitor-{uuid.uuid4()}"
POLL_TIMEOUT = 30
TASK_COUNTER = 0

def log(message, level='INFO'):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}")

def register_worker():
    log('Registering worker...')
    response = requests.post(f"{API_BASE_URL}/api/worker/register", json={
        'worker_id': WORKER_ID,
        'worker_name': 'Continuous Monitor Worker',
        'processor_types': ['remote_client'],
        'platform': 'monitor-script',
        'metadata': {'mode': 'continuous', 'monitor': True}
    })
    response.raise_for_status()
    log(f"✓ Worker registered: {WORKER_ID}")

def send_heartbeat():
    try:
        response = requests.post(f"{API_BASE_URL}/api/worker/heartbeat", json={
            'worker_id': WORKER_ID
        }, timeout=5)
        if response.status_code == 200:
            log('✓ Heartbeat sent', 'DEBUG')
        else:
            log(f'⚠ Heartbeat failed: {response.status_code}', 'WARN')
    except Exception as e:
        log(f'✗ Heartbeat error: {str(e)}', 'ERROR')

def pull_and_print_tasks():
    global TASK_COUNTER

    try:
        log(f'Polling for tasks (timeout: {POLL_TIMEOUT}s)...')

        response = requests.get(
            f"{API_BASE_URL}/api/worker/tasks/pull",
            params={
                'worker_id': WORKER_ID,
                'limit': 10,
                'timeout': POLL_TIMEOUT
            },
            timeout=POLL_TIMEOUT + 5
        )

        if response.status_code != 200:
            log(f'✗ Pull failed: HTTP {response.status_code}', 'ERROR')
            return 0

        data = response.json()
        task_count = data['data']['count']

        if task_count == 0:
            log('○ No tasks available')
            return 0

        log(f'✓ Found {task_count} task(s) (already assigned)', 'SUCCESS')

        for task in data['data']['tasks']:
            TASK_COUNTER += 1
            print_task(task)

        return task_count

    except requests.exceptions.Timeout:
        log('○ Poll timeout (no tasks)', 'DEBUG')
        return 0
    except Exception as e:
        log(f'✗ Error: {str(e)}', 'ERROR')
        return 0

def print_task(task):
    print('\n' + '=' * 70)
    print(f"TASK #{TASK_COUNTER} - {datetime.now().strftime('%H:%M:%S')}")
    print('=' * 70)
    print(f"Task ID       : {task['task_id']}")
    print(f"App Name      : {task['app_name']}")
    print(f"Task Type     : {task['task_type']}")
    print(f"Status        : {task['status']}")
    print(f"Priority      : {task['priority']}")
    print(f"Timeout       : {task['timeout_seconds']}s")
    print(f"Created       : {task['created_at']}")

    payload = task['payload']
    print(f"\n--- Payload ---")
    print(f"Language      : {payload.get('language', 'N/A')}")
    print(f"Word Count    : {payload.get('word_count', 0)}")
    print(f"Demo Mode     : {payload.get('is_demo_mode', False)}")

    if 'words' in payload:
        words = payload['words']
        print(f"\n--- Words ({len(words)} total) ---")

        if isinstance(words, list):
            display_limit = 15
            for i, word in enumerate(words[:display_limit], 1):
                if isinstance(word, dict):
                    word_text = word.get('word', 'N/A')
                    md5 = word.get('md5', 'N/A')[:12]
                    query_count = word.get('query_count', 0)
                    print(f"  {i:2d}. {word_text:20s} (MD5: {md5}... | Queries: {query_count})")
                else:
                    print(f"  {i:2d}. {word}")

            if len(words) > display_limit:
                print(f"  ... and {len(words) - display_limit} more words")

    print('=' * 70)

def main():
    print('╔════════════════════════════════════════════════════════════════════╗')
    print('║        Continuous Worker Task Monitor - Backend Port 9000         ║')
    print('╚════════════════════════════════════════════════════════════════════╝')
    print(f"API URL       : {API_BASE_URL}")
    print(f"Worker ID     : {WORKER_ID}")
    print(f"Poll Timeout  : {POLL_TIMEOUT}s")
    print(f"\nPress Ctrl+C to stop...\n")

    try:
        register_worker()

        heartbeat_counter = 0

        log('Starting continuous task polling...\n')

        while True:
            heartbeat_counter += 1

            if heartbeat_counter % 2 == 0:
                send_heartbeat()

            pulled_count = pull_and_print_tasks()

            if pulled_count == 0:
                time.sleep(1)

    except KeyboardInterrupt:
        print('\n\n' + '=' * 70)
        log('Monitor stopped by user', 'INFO')
        log(f'Total tasks processed: {TASK_COUNTER}', 'INFO')
        print('=' * 70)
    except Exception as e:
        log(f'Fatal error: {str(e)}', 'ERROR')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
