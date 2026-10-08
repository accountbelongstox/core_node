#!/usr/bin/env node
'use strict';

process.env.MCP_MODE = 'mcp';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const clientKeyAuth = require('../../foundation/common/client_key_auth');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BUS_CONTRACT = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'agent_bus_contract.json'), 'utf8'));
const RELAY_CONTRACT = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'pycore_relay_contract.json'), 'utf8'));
const CONTENT_TYPE = 'application/json';
const ACCEPT = 'application/json, text/event-stream';
const JSONRPC_VERSION = '2.0';
const JSONRPC_TRANSPORT_ERROR = -32000;
const HTTP_ACCEPTED = 202;
const HTTP_UNAUTHORIZED = 401;
const REQUEST_TIMEOUT_MS = 60000;
const SEGMENT_MAX = 64;
const SSE_DATA_PREFIX = 'data:';
const CALL_COMMAND = 'call';
const ARG_PREFIX = '--';
const REGISTER_TOOL = 'register';

let options, agentName, machine, endpoint;

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

function segment(value) {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._-]/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(0, SEGMENT_MAX);

  return cleaned || 'agent';
}

function resolveEndpoint() {
  const origin = options.url || process.env.AGENT_BUS_URL || RELAY_CONTRACT.public_urls.laravel_api_origin;

  return origin.replace(/\/+$/, '') + BUS_CONTRACT.mcp_path;
}

function agentId() {
  return machine + BUS_CONTRACT.identity.separator + agentName;
}

function log(message) {
  process.stderr.write('[agent-bus] ' + message + '\n');
}

function rememberRegisteredName(message) {
  const params = message && message.params;
  const name = params && params.arguments && params.arguments.agent;

  if (message.method !== 'tools/call' || !params || params.name !== REGISTER_TOOL || typeof name !== 'string' || name === '') {
    return;
  }
  agentName = segment(name.includes(BUS_CONTRACT.identity.separator) ? name.split(BUS_CONTRACT.identity.separator)[1] : name);
}

function errorReply(id, text) {
  return JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, error: { code: JSONRPC_TRANSPORT_ERROR, message: text } });
}

function bodyLines(text, contentType) {
  if (!String(contentType || '').includes('text/event-stream')) {
    return [text.trim()].filter(Boolean);
  }

  return text.split(/\r?\n/)
    .filter((line) => line.startsWith(SSE_DATA_PREFIX))
    .map((line) => line.slice(SSE_DATA_PREFIX.length).trim())
    .filter(Boolean);
}

async function post(rawBody) {
  const sentAt = Date.now();
  const response = await postOnce(rawBody);
  const clockMoved = clientKeyAuth.observeServerDate(endpoint, response.headers.get('date'), sentAt, Date.now());

  // A drifted local clock: one more attempt signed with the server time learned from the answer.
  if (clockMoved && response.status === HTTP_UNAUTHORIZED
    && clientKeyAuth.isTimestampRejection(response.status, await response.clone().text())) {
    return postOnce(rawBody);
  }
  return response;
}

async function postOnce(rawBody) {
  const signed = clientKeyAuth.signRequest({
    client: BUS_CONTRACT.identity.bridge_client,
    method: 'POST',
    url: endpoint,
    body: Buffer.from(rawBody, 'utf8'),
    contentType: CONTENT_TYPE,
    machineId: machine,
  });
  const headers = { 'Content-Type': CONTENT_TYPE, Accept: ACCEPT };

  if (!signed.ok) {
    throw new Error('client key signing failed (' + (signed.code || signed.error || 'unknown') + '); run dd.sh / dd.cmd to restore CORE_NODE_CLIENT_KEY_1');
  }
  Object.assign(headers, signed.headers);
  headers[BUS_CONTRACT.identity.agent_header] = agentId();

  return fetch(endpoint, { method: 'POST', headers, body: rawBody, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function forward(rawLine) {
  let message, response, text;

  try {
    message = JSON.parse(rawLine);
  } catch (error) {
    log('ignored non-JSON input line');
    return [];
  }
  rememberRegisteredName(message);

  try {
    response = await post(rawLine);
    text = await response.text();
  } catch (error) {
    return message.id === undefined ? [] : [errorReply(message.id, error.message)];
  }
  if (response.status === HTTP_ACCEPTED) {
    return [];
  }
  if (!response.ok) {
    return message.id === undefined ? [] : [errorReply(message.id, 'HTTP ' + response.status + ' ' + text.slice(0, 500))];
  }

  return bodyLines(text, response.headers.get('content-type'));
}

function runStdio() {
  const input = readline.createInterface({ input: process.stdin, terminal: false });

  input.on('line', (line) => {
    if (!line.trim()) {
      return;
    }
    forward(line).then((replies) => {
      replies.forEach((reply) => process.stdout.write(reply + '\n'));
    });
  });
  log('bridging stdio to ' + endpoint + ' as ' + agentId());
}

async function runCall(tool, argsJson) {
  const args = argsJson ? JSON.parse(argsJson) : {};
  const request = JSON.stringify({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/call', params: { name: tool, arguments: args } });
  const replies = await forward(request);
  const reply = replies.length ? JSON.parse(replies[0]) : null;
  const result = reply && reply.result;

  if (!result || result.isError) {
    process.stderr.write((reply && reply.error ? reply.error.message : (result && result.content && result.content[0] ? result.content[0].text : 'no reply')) + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(JSON.stringify(result.structuredContent || result, null, 2) + '\n');
}

options = parseArgs(process.argv.slice(2));
machine = segment(options.machine || process.env.AGENT_BUS_MACHINE || os.hostname());
agentName = segment(options.agent || process.env.AGENT_BUS_AGENT || ('agent-' + process.ppid));
endpoint = resolveEndpoint();

if (options.positional[0] === CALL_COMMAND) {
  runCall(options.positional[1], options.positional[2]).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
} else {
  runStdio();
}
