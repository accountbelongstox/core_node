#!/usr/bin/env python3

import json
import uuid
import requests

API_URL = 'http://localhost:9000'
WORKER_ID = f"test-{uuid.uuid4()}"

print("="*60)
print("Testing Real Untranslated Words")
print("="*60)

# Register
print("\n[1] Registering...")
requests.post(f"{API_URL}/api/worker/register", json={
    'worker_id': WORKER_ID,
    'worker_name': 'Test Worker',
    'processor_types': ['remote_client'],
    'platform': 'test'
})
print("✓ Registered")

# Pull tasks
print("\n[2] Pulling tasks...")
response = requests.get(f"{API_URL}/api/worker/tasks/pull", params={
    'worker_id': WORKER_ID,
    'limit': 5,
    'timeout': 10
})

data = response.json()
count = data['data']['count']

print(f"✓ Found {count} task(s)")

if count > 0:
    for i, task in enumerate(data['data']['tasks'], 1):
        print(f"\n{'='*60}")
        print(f"TASK #{i}")
        print(f"{'='*60}")
        print(f"Task ID: {task['task_id']}")
        print(f"Type: {task['task_type']}")
        print(f"Status: {task['status']}")

        payload = task['payload']
        print(f"\nWord Count: {payload['word_count']}")
        print(f"Demo Mode: {payload['is_demo_mode']}")

        print(f"\nWords:")
        for j, word in enumerate(payload['words'], 1):
            if isinstance(word, dict):
                print(f"  {j}. {word['word']}")
            else:
                print(f"  {j}. {word}")

        print(f"\n[3] Task already assigned (pull now auto-assigns)")
        print("✓ Task is ready for processing (will timeout since we're not submitting result)")

print(f"\n{'='*60}")
print("Test completed!")
print("="*60)
