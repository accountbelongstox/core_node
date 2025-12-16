#!/usr/bin/env python3

"""
Worker Task Pull Test Script
Tests backend Worker API to pull and print untranslated word tasks
Does NOT submit results - for testing only
"""

import os
import sys
import json
import uuid
import requests
from datetime import datetime

API_BASE_URL = os.getenv('API_URL', 'http://localhost:9000')

WORKER_ID = f"test-worker-{uuid.uuid4()}"
WORKER_NAME = "Test Dictionary Worker"


def make_request(url, method='GET', data=None):
    full_url = f"{API_BASE_URL}{url}"

    print(f"\n[REQUEST] {method} {full_url}")
    if data:
        print(f"[REQUEST BODY] {json.dumps(data, indent=2)}")

    try:
        if method == 'GET':
            response = requests.get(full_url, timeout=60)
        elif method == 'POST':
            response = requests.post(
                full_url,
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=60
            )
        else:
            raise ValueError(f"Unsupported method: {method}")

        response_data = response.json()

        print(f"[RESPONSE] Status: {response.status_code}")
        print(f"[RESPONSE BODY] {json.dumps(response_data, indent=2)}")

        if not response.ok:
            raise Exception(f"HTTP {response.status_code}: {response_data.get('message', 'Unknown error')}")

        return response_data

    except requests.exceptions.RequestException as e:
        print(f"[ERROR] {str(e)}")
        raise


def register_worker():
    print('\n' + '=' * 40)
    print('STEP 1: Register Worker')
    print('=' * 40)

    response = make_request('/api/worker/register', 'POST', {
        'worker_id': WORKER_ID,
        'worker_name': WORKER_NAME,
        'processor_types': ['remote_client'],
        'platform': 'test-script-python',
        'metadata': {
            'version': '1.0.0',
            'test': True
        }
    })

    print(f"✓ Worker registered successfully: {response['data']['worker_id']}")
    return response


def send_heartbeat():
    print('\n' + '=' * 40)
    print('STEP 2: Send Heartbeat')
    print('=' * 40)

    response = make_request('/api/worker/heartbeat', 'POST', {
        'worker_id': WORKER_ID
    })

    print('✓ Heartbeat sent successfully')
    return response


def pull_tasks():
    print('\n' + '=' * 40)
    print('STEP 3: Pull Tasks (Long Polling)')
    print('=' * 40)
    print('Waiting for tasks...')

    response = make_request(
        f'/api/worker/tasks/pull?worker_id={WORKER_ID}&limit=1&timeout=10',
        'GET'
    )

    if response['data']['count'] == 0:
        print('✗ No tasks available')
        return None

    print(f"✓ Pulled {response['data']['count']} task(s)")
    return response['data']['tasks']


def accept_task(task_id):
    print('\n' + '=' * 40)
    print('STEP 4: Accept Task')
    print('=' * 40)

    response = make_request('/api/worker/tasks/accept', 'POST', {
        'task_id': task_id,
        'worker_id': WORKER_ID
    })

    print(f"✓ Task accepted: {task_id}")
    return response


def print_task_details(task):
    print('\n' + '=' * 40)
    print('TASK DETAILS')
    print('=' * 40)
    print(f"Task ID: {task['task_id']}")
    print(f"App Name: {task['app_name']}")
    print(f"Task Type: {task['task_type']}")
    print(f"Execution Type: {task['execution_type']}")
    print(f"Status: {task['status']}")
    print(f"Priority: {task['priority']}")
    print(f"Timeout: {task['timeout_seconds']} seconds")
    print(f"Created At: {task['created_at']}")

    print('\n--- Payload ---')
    print(f"Language: {task['payload']['language']}")
    print(f"Word Count: {task['payload']['word_count']}")
    print(f"Demo Mode: {task['payload']['is_demo_mode']}")

    print('\n--- Words List ---')
    for index, word in enumerate(task['payload']['words'], 1):
        print(f"{index}. {word['word']} (MD5: {word['md5']}, Query Count: {word['query_count']})")

    print('\n' + '=' * 40)


def main():
    print('╔════════════════════════════════════════╗')
    print('║  Worker Task Pull Test Script         ║')
    print('╚════════════════════════════════════════╝')
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Worker ID: {WORKER_ID}")
    print(f"Worker Name: {WORKER_NAME}")

    try:
        register_worker()

        send_heartbeat()

        tasks = pull_tasks()

        if not tasks or len(tasks) == 0:
            print('\n⚠️  No tasks available. Please create a translation task first.')
            print('\nTo create a task, use:')
            print('POST /api/app_qy_v1/dictionary/tasks/create-explanation')
            print('(Requires authentication)')
            sys.exit(0)

        task = tasks[0]

        accept_task(task['task_id'])

        print_task_details(task)

        print('\n✓ Test completed successfully!')
        print('\nNote: Task has been accepted but NOT completed.')
        print('The task will timeout and return to pending status after timeout period.')

    except Exception as e:
        print(f'\n✗ Test failed: {str(e)}')
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\nTest interrupted by user')
        sys.exit(0)
