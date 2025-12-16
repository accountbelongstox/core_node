#!/usr/bin/env python3

"""
Simple Worker Task Pull Test - Only pulls and prints tasks
Does NOT accept or submit results
"""

import os
import json
import uuid
import requests

API_BASE_URL = os.getenv('API_URL', 'http://localhost:9000')
WORKER_ID = f"test-worker-{uuid.uuid4()}"

print('=' * 60)
print('Worker Task Pull Test - Port 9000')
print('=' * 60)
print(f"Worker ID: {WORKER_ID}\n")

try:
    print('[1] Registering Worker...')
    response = requests.post(f"{API_BASE_URL}/api/worker/register", json={
        'worker_id': WORKER_ID,
        'worker_name': 'Test Worker',
        'processor_types': ['remote_client'],
        'platform': 'test-script'
    })
    print(f"✓ Registered (Status: {response.status_code})\n")

    print('[2] Sending Heartbeat...')
    response = requests.post(f"{API_BASE_URL}/api/worker/heartbeat", json={
        'worker_id': WORKER_ID
    })
    print(f"✓ Heartbeat sent (Status: {response.status_code})\n")

    print('[3] Pulling Tasks (10s timeout)...')
    response = requests.get(
        f"{API_BASE_URL}/api/worker/tasks/pull",
        params={'worker_id': WORKER_ID, 'limit': 5, 'timeout': 10}
    )
    data = response.json()

    if data['data']['count'] == 0:
        print('✗ No tasks available\n')
        print('To create a task, use:')
        print('POST /api/app_qy_v1/dictionary/tasks/create-explanation')
    else:
        print(f"✓ Found {data['data']['count']} task(s)\n")
        print('=' * 60)
        print('TASK DETAILS')
        print('=' * 60)

        for idx, task in enumerate(data['data']['tasks'], 1):
            print(f"\n[Task #{idx}]")
            print(f"Task ID      : {task['task_id']}")
            print(f"App Name     : {task['app_name']}")
            print(f"Task Type    : {task['task_type']}")
            print(f"Status       : {task['status']}")
            print(f"Priority     : {task['priority']}")
            print(f"Timeout      : {task['timeout_seconds']}s")
            print(f"Created      : {task['created_at']}")

            payload = task['payload']
            print(f"\nPayload:")
            print(f"  Language   : {payload.get('language', 'N/A')}")
            print(f"  Word Count : {payload.get('word_count', 0)}")
            print(f"  Demo Mode  : {payload.get('is_demo_mode', False)}")

            if 'words' in payload:
                print(f"\nWords List:")
                words = payload['words']
                if isinstance(words, list):
                    for i, word in enumerate(words[:10], 1):
                        if isinstance(word, dict):
                            print(f"  {i}. {word.get('word', 'N/A')} (MD5: {word.get('md5', 'N/A')[:8]}...)")
                        else:
                            print(f"  {i}. {word}")
                    if len(words) > 10:
                        print(f"  ... and {len(words) - 10} more words")

            print('\n' + '-' * 60)

        print('\n✓ Test completed successfully!')

except Exception as e:
    print(f'\n✗ Error: {str(e)}')
    import traceback
    traceback.print_exc()
