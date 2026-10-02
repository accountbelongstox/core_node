#!/usr/bin/env node
'use strict';

process.env.MCP_MODE = 'mcp';

const fs = require('fs');
const path = require('path');
const clientKeyAuth = require('./client_key_auth');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVICE_CONTRACT = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'service_contract.json'), 'utf8'));
const RELAY_CONTRACT = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'pycore_relay_contract.json'), 'utf8'));
const CODE_SYNC = SERVICE_CONTRACT.code_sync;
const CONTENT_TYPE = 'application/json';
const MS_PER_SECOND = 1000;
const ARG_PREFIX = '--';
const TERMINAL_STATUSES = ['completed', 'failed'];
const LOG_PREFIX = '[laravel-signed] ';
const USAGE = 'usage: laravel_signed_cli.js request <GET|POST|PUT|DELETE> <path-with-query> [--json <body>] [--origin <url>]\n'
  + '       laravel_signed_cli.js code-sync [--origin <url>]\n'
  + '       laravel_signed_cli.js history [--limit <n>] [--origin <url>]';

let options;

function parseArgs(argv) {
  const parsed = { positional: [] };
  let i, arg;

  for (i = 0; i < argv.length; i++) {
    arg = argv[i];
    if (arg.startsWith(ARG_PREFIX) && i + 1 < argv.length) {
      parsed[arg.slice(ARG_PREFIX.length)] = argv[i + 1];
      i++;
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

function origin() {
  return String(options.origin || process.env.LARAVEL_API_URL || RELAY_CONTRACT.public_urls.laravel_api_origin).replace(/\/+$/, '');
}

function log(message) {
  process.stdout.write(LOG_PREFIX + message + '\n');
}

async function signedFetch(method, requestPath, rawBody) {
  const url = origin() + requestPath;
  const body = rawBody === undefined ? undefined : Buffer.from(rawBody, 'utf8');
  const signed = clientKeyAuth.signRequest({
    client: CODE_SYNC.client,
    method,
    url,
    body: body || Buffer.alloc(0),
    contentType: body ? CONTENT_TYPE : '',
  });
  const headers = { Accept: CONTENT_TYPE };
  let response, text;

  if (!signed.ok) {
    throw new Error('client key signing failed (' + (signed.code || signed.error || 'unknown') + '); run dd.sh / dd.cmd to restore the client key');
  }
  Object.assign(headers, signed.headers);
  if (body) {
    headers['Content-Type'] = CONTENT_TYPE;
  }
  response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(CODE_SYNC.request_timeout_seconds * MS_PER_SECOND) });
  text = await response.text();

  return { status: response.status, text };
}

function parseData(result) {
  try {
    return JSON.parse(result.text).data || {};
  } catch (error) {
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRequest() {
  const method = String(options.positional[1] || '').toUpperCase();
  const requestPath = options.positional[2];
  let result;

  if (!method || !requestPath) {
    process.stderr.write(USAGE + '\n');
    return 2;
  }
  result = await signedFetch(method, requestPath, options.json);
  process.stdout.write(result.text + '\n');

  return result.status >= 200 && result.status < 300 ? 0 : 1;
}

async function runCodeSync() {
  const deadline = Date.now() + CODE_SYNC.poll_timeout_seconds * MS_PER_SECOND;
  let started, job, jobId, lastPhase, result;

  started = await signedFetch('POST', CODE_SYNC.start_path, '{}');
  job = parseData(started);
  jobId = job.job_id;
  if (!jobId) {
    log('code sync was not started (HTTP ' + started.status + '): ' + started.text.slice(0, 300));
    return 1;
  }
  log('code sync job ' + jobId + (job.already_running ? ' (already running)' : ' started'));

  while (Date.now() < deadline) {
    await sleep(CODE_SYNC.poll_interval_seconds * MS_PER_SECOND);
    try {
      result = await signedFetch('GET', CODE_SYNC.status_path + '?job_id=' + encodeURIComponent(jobId));
    } catch (error) {
      log('status poll failed (' + error.message + '); retrying');
      continue;
    }
    job = parseData(result);
    if (job.phase && job.phase !== lastPhase) {
      lastPhase = job.phase;
      log('phase: ' + job.phase + ' (status: ' + job.status + ')');
    }
    if (TERMINAL_STATUSES.includes(job.status)) {
      log('finished: ' + job.status + (job.error ? ' - ' + job.error : '') + '; commit ' + (job.commit_before || '?') + ' -> ' + (job.commit_after || '?'));
      return job.status === 'completed' ? 0 : 1;
    }
  }
  log('timed out waiting for job ' + jobId + '; poll GET ' + CODE_SYNC.status_path + '?job_id=' + jobId);

  return 1;
}

async function runHistory() {
  const query = options.limit ? '?limit=' + encodeURIComponent(options.limit) : '';
  const result = await signedFetch('GET', CODE_SYNC.history_path + query);

  process.stdout.write(result.text + '\n');

  return result.status >= 200 && result.status < 300 ? 0 : 1;
}

async function main() {
  const command = options.positional[0];

  if (command === 'request') {
    return runRequest();
  }
  if (command === 'code-sync') {
    return runCodeSync();
  }
  if (command === 'history') {
    return runHistory();
  }
  process.stderr.write(USAGE + '\n');

  return 2;
}

options = parseArgs(process.argv.slice(2));
main().then((code) => process.exit(code), (error) => {
  process.stderr.write(LOG_PREFIX + error.message + '\n');
  process.exit(1);
});
