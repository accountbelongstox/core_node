#!/usr/bin/env node

/**
 * Worker Task Pull Test Script
 * Tests backend Worker API to pull and print untranslated word tasks
 * Does NOT submit results - for testing only
 */

const crypto = require('crypto');

const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';

const WORKER_ID = `test-worker-${crypto.randomUUID()}`;
const WORKER_NAME = 'Test Dictionary Worker';

let isRunning = true;

async function makeRequest(url, options = {}) {
  const fullUrl = `${API_BASE_URL}${url}`;

  console.log(`\n[REQUEST] ${options.method || 'GET'} ${fullUrl}`);
  if (options.body) {
    console.log('[REQUEST BODY]', JSON.stringify(JSON.parse(options.body), null, 2));
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    console.log(`[RESPONSE] Status: ${response.status}`);
    console.log('[RESPONSE BODY]', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.message || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error('[ERROR]', error.message);
    throw error;
  }
}

async function registerWorker() {
  console.log('\n========================================');
  console.log('STEP 1: Register Worker');
  console.log('========================================');

  const response = await makeRequest('/api/worker/register', {
    method: 'POST',
    body: JSON.stringify({
      worker_id: WORKER_ID,
      worker_name: WORKER_NAME,
      processor_types: ['remote_client'],
      platform: 'test-script',
      metadata: {
        version: '1.0.0',
        test: true,
      },
    }),
  });

  console.log(`✓ Worker registered successfully: ${response.data.worker_id}`);
  return response;
}

async function sendHeartbeat() {
  console.log('\n========================================');
  console.log('STEP 2: Send Heartbeat');
  console.log('========================================');

  const response = await makeRequest('/api/worker/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      worker_id: WORKER_ID,
    }),
  });

  console.log('✓ Heartbeat sent successfully');
  return response;
}

async function pullTasks() {
  console.log('\n========================================');
  console.log('STEP 3: Pull Tasks (Long Polling)');
  console.log('========================================');
  console.log('Waiting for tasks...');

  const response = await makeRequest(
    `/api/worker/tasks/pull?worker_id=${encodeURIComponent(WORKER_ID)}&limit=1&timeout=10`,
    {
      method: 'GET',
    }
  );

  if (response.data.count === 0) {
    console.log('✗ No tasks available');
    return null;
  }

  console.log(`✓ Pulled ${response.data.count} task(s)`);
  return response.data.tasks;
}

async function acceptTask(taskId) {
  console.log('\n========================================');
  console.log('STEP 4: Accept Task');
  console.log('========================================');

  const response = await makeRequest('/api/worker/tasks/accept', {
    method: 'POST',
    body: JSON.stringify({
      task_id: taskId,
      worker_id: WORKER_ID,
    }),
  });

  console.log(`✓ Task accepted: ${taskId}`);
  return response;
}

async function printTaskDetails(task) {
  console.log('\n========================================');
  console.log('TASK DETAILS');
  console.log('========================================');
  console.log(`Task ID: ${task.task_id}`);
  console.log(`App Name: ${task.app_name}`);
  console.log(`Task Type: ${task.task_type}`);
  console.log(`Execution Type: ${task.execution_type}`);
  console.log(`Status: ${task.status}`);
  console.log(`Priority: ${task.priority}`);
  console.log(`Timeout: ${task.timeout_seconds} seconds`);
  console.log(`Created At: ${task.created_at}`);

  console.log('\n--- Payload ---');
  console.log(`Language: ${task.payload.language}`);
  console.log(`Word Count: ${task.payload.word_count}`);
  console.log(`Demo Mode: ${task.payload.is_demo_mode}`);

  console.log('\n--- Words List ---');
  task.payload.words.forEach((word, index) => {
    console.log(`${index + 1}. ${word.word} (MD5: ${word.md5}, Query Count: ${word.query_count})`);
  });

  console.log('\n========================================');
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Worker Task Pull Test Script         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Worker ID: ${WORKER_ID}`);
  console.log(`Worker Name: ${WORKER_NAME}`);

  try {
    await registerWorker();

    await sendHeartbeat();

    const tasks = await pullTasks();

    if (!tasks || tasks.length === 0) {
      console.log('\n⚠️  No tasks available. Please create a translation task first.');
      console.log('\nTo create a task, use:');
      console.log('POST /api/app_qy_v1/dictionary/tasks/create-explanation');
      console.log('(Requires authentication)');
      process.exit(0);
    }

    const task = tasks[0];

    await acceptTask(task.task_id);

    await printTaskDetails(task);

    console.log('\n✓ Test completed successfully!');
    console.log('\nNote: Task has been accepted but NOT completed.');
    console.log('The task will timeout and return to pending status after timeout period.');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nTest interrupted by user');
  process.exit(0);
});

main();
