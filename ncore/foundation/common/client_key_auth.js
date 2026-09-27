const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const logger = require('./logger');
const secretManager = require('./secret_manager');
const serviceContract = require('#@/config/service_contract.js');
const relayContract = require('#@/config/pycore_relay_contract.json');

const CONTRACT = serviceContract.document.client_key_auth || {};
const CANONICALIZATION = (relayContract.signature_profile || {}).canonicalization || {};
const REPO_ROOT = path.resolve(__dirname, '../../..');
const NCORE_CLIENT = 'ncore';
const HEX_DIGITS = '0123456789abcdefABCDEF';
const ENCODED_SEPARATORS = ['2f', '5c'];
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const TIMESTAMP_PATTERN = /^[0-9]{1,15}$/;
const KEY_ID_LENGTH_PATTERN = /first-(\d+)-chars/;
const NONCE_BYTES = 24;
const MACHINE_ID_DIGEST_LENGTH = 12;
const LINUX_MACHINE_ID_FILES = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
const WINDOWS_MACHINE_GUID_ARGS = ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'];
const WINDOWS_MACHINE_GUID_PATTERN = /MachineGuid\s+REG_SZ\s+(\S+)/i;
const KEY_RELOAD_INTERVAL_MS = 30000;
const KEY_MISSING_HINT = 'run dd.sh (Linux) or dd.cmd (Windows) to decrypt or generate it';
const STATUS_UNAUTHORIZED = 401;
const MS_PER_SECOND = 1000;
const QUERY_SPACE = '+';

let signingKeyCache, verifyKeysCache, verifyKeysLoadedAt, missingKeyLoggedAt;
let machineDigestCache, nonceStore, nonceSweepAt, keyIdLength, utf8Decoder, machineIdPattern, noncePattern;

signingKeyCache = null;
verifyKeysCache = new Map();
verifyKeysLoadedAt = 0;
missingKeyLoggedAt = 0;
machineDigestCache = null;
nonceStore = new Map();
nonceSweepAt = 0;
keyIdLength = Number((String(CONTRACT.key_id || '').match(KEY_ID_LENGTH_PATTERN) || [])[1]) || 0;
utf8Decoder = new TextDecoder('utf-8', { fatal: true });
machineIdPattern = new RegExp(CONTRACT.machine_id_pattern || '^$');
noncePattern = new RegExp(CONTRACT.nonce_pattern || '^$');

function getContract() {
  return CONTRACT;
}

function headerName(field) {
  return (CONTRACT.headers || {})[field] || null;
}

function errorCode(reason) {
  const codes = CONTRACT.error_codes || [];
  const suffix = '_' + reason;

  for (let i = 0; i < codes.length; i++) {
    if (codes[i].endsWith(suffix)) {
      return codes[i];
    }
  }

  return codes[0] || reason;
}

function failure(reason) {
  return { ok: false, status: STATUS_UNAUTHORIZED, code: errorCode(reason) };
}

function readHeader(headers, field) {
  let name, value;

  name = headerName(field);
  if (!name || !headers) {
    return '';
  }

  value = headers[name.toLowerCase()];
  if (value === undefined) {
    value = headers[name];
  }
  if (Array.isArray(value)) {
    value = value[0];
  }

  return value === undefined || value === null ? '' : String(value).trim();
}

function isUnreservedByte(byte, extraSafe) {
  if ((byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a)) {
    return true;
  }
  return extraSafe.indexOf(String.fromCharCode(byte)) !== -1;
}

function percentByte(byte) {
  return '%' + byte.toString(16).toUpperCase().padStart(2, '0');
}

function hasValidPercentTriplets(text, rejectSeparators) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '%') {
      continue;
    }

    const triplet = text.slice(i + 1, i + 3);
    if (triplet.length !== 2 || HEX_DIGITS.indexOf(triplet[0]) === -1 || HEX_DIGITS.indexOf(triplet[1]) === -1) {
      return false;
    }
    if (rejectSeparators && ENCODED_SEPARATORS.includes(triplet.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function percentDecodeToBytes(text) {
  let source, output, index;

  source = Buffer.from(text, 'utf8');
  output = [];
  index = 0;

  while (index < source.length) {
    if (source[index] === 0x25 && index + 2 < source.length) {
      output.push(parseInt(source.toString('latin1', index + 1, index + 3), 16));
      index += 3;
      continue;
    }
    output.push(source[index]);
    index += 1;
  }

  return Buffer.from(output);
}

function decodeUtf8Strict(bytes) {
  try {
    return utf8Decoder.decode(bytes);
  } catch (error) {
    return null;
  }
}

function canonicalPath(rawPath) {
  let value, decoded, bytes, safe, encoded;

  value = String(rawPath || '');
  safe = String(CANONICALIZATION.path_safe_characters || '');

  if (value.includes('?') || value.includes('#')) {
    return null;
  }
  if (value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  if (!hasValidPercentTriplets(value, true)) {
    return null;
  }

  decoded = decodeUtf8Strict(percentDecodeToBytes('/' + value.replace(/^\/+/, '')));
  if (decoded === null) {
    return null;
  }

  for (let i = 0; i < decoded.length; i++) {
    const code = decoded.charCodeAt(i);
    if (code < 32 || code === 127) {
      return null;
    }
  }

  bytes = Buffer.from(decoded, 'utf8');
  encoded = '';

  for (let i = 0; i < bytes.length; i++) {
    encoded += isUnreservedByte(bytes[i], safe) ? String.fromCharCode(bytes[i]) : percentByte(bytes[i]);
  }

  return encoded;
}

function formEncode(value) {
  let bytes, encoded;

  bytes = Buffer.from(String(value), 'utf8');
  encoded = '';

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x20) {
      encoded += QUERY_SPACE;
    } else if (isUnreservedByte(bytes[i], '-._~')) {
      encoded += String.fromCharCode(bytes[i]);
    } else {
      encoded += percentByte(bytes[i]);
    }
  }

  return encoded;
}

function formDecode(value) {
  if (!hasValidPercentTriplets(value, false)) {
    return null;
  }
  return percentDecodeToBytes(value.split(QUERY_SPACE).join(' ')).toString('utf8');
}

function comparePairs(left, right) {
  const keyOrder = Buffer.compare(Buffer.from(left[0], 'utf8'), Buffer.from(right[0], 'utf8'));
  return keyOrder !== 0 ? keyOrder : Buffer.compare(Buffer.from(left[1], 'utf8'), Buffer.from(right[1], 'utf8'));
}

function joinPairs(pairs) {
  pairs.sort(comparePairs);
  return pairs.map((pair) => formEncode(pair[0]) + '=' + formEncode(pair[1])).join('&');
}

function canonicalQuery(query) {
  let pairs, keys;

  pairs = [];
  keys = Object.keys(query || {});

  for (let i = 0; i < keys.length; i++) {
    const value = query[keys[i]];
    const values = Array.isArray(value) ? value : [value];

    for (let j = 0; j < values.length; j++) {
      if (typeof values[j] !== 'string') {
        return null;
      }
      pairs.push([keys[i], values[j]]);
    }
  }

  return joinPairs(pairs);
}

function canonicalRawQuery(rawQuery) {
  let segments, pairs;

  segments = rawQuery === null || rawQuery === undefined || rawQuery === '' ? [] : String(rawQuery).split('&');
  pairs = [];

  for (let i = 0; i < segments.length; i++) {
    const separator = segments[i].indexOf('=');
    const key = formDecode(separator === -1 ? segments[i] : segments[i].slice(0, separator));
    const value = formDecode(separator === -1 ? '' : segments[i].slice(separator + 1));

    if (key === null || value === null) {
      return null;
    }
    pairs.push([key, value]);
  }

  return joinPairs(pairs);
}

function mediaType(contentType) {
  return String(contentType || '').split(';')[0].trim().toLowerCase();
}

function isUnsignedContentType(contentType) {
  return (CONTRACT.unsigned_payload_content_types || []).includes(mediaType(contentType));
}

function toBodyBuffer(body) {
  if (body === null || body === undefined) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  return Buffer.from(String(body), 'utf8');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function contentSha256(body, contentType) {
  if (isUnsignedContentType(contentType)) {
    return CONTRACT.unsigned_payload;
  }
  return sha256Hex(toBodyBuffer(body));
}

function decodeKey(text) {
  let key;

  if (!text || !BASE64URL_PATTERN.test(text)) {
    return null;
  }

  key = Buffer.from(text, 'base64url');
  return key.length >= (CONTRACT.key_min_bytes || 0) ? key : null;
}

function keyIdOf(key) {
  return keyIdLength > 0 ? sha256Hex(key).slice(0, keyIdLength) : null;
}

function secretName(index) {
  return CONTRACT.secret_key_base + '_' + index;
}

function readKeyByName(name) {
  let text, key;

  text = secretManager.readRawSecret(name, path.join(REPO_ROOT, CONTRACT.secret_raw_dir || ''));
  if (!text) {
    return null;
  }

  key = decodeKey(text);
  if (!key) {
    logger.error('Client key ' + name + ' is not valid base64url of at least ' + CONTRACT.key_min_bytes + ' bytes');
    return null;
  }

  return { name, key, keyId: keyIdOf(key) };
}

function logMissingKey(name) {
  const now = Date.now();

  if (now - missingKeyLoggedAt < KEY_RELOAD_INTERVAL_MS) {
    return;
  }

  missingKeyLoggedAt = now;
  logger.error('Client key missing: ' + name + '; ' + KEY_MISSING_HINT);
}

function loadSigningKey() {
  if (signingKeyCache) {
    return signingKeyCache;
  }

  signingKeyCache = readKeyByName(CONTRACT.secret_key_sign_name);
  if (!signingKeyCache) {
    logMissingKey(CONTRACT.secret_key_sign_name);
  }

  return signingKeyCache;
}

function loadVerifyKeys(force) {
  let keys, entry, loaded;

  loaded = verifyKeysLoadedAt > 0;
  if (loaded && ((!force && verifyKeysCache.size > 0) || Date.now() - verifyKeysLoadedAt < KEY_RELOAD_INTERVAL_MS)) {
    return verifyKeysCache;
  }

  keys = new Map();
  for (let index = 1; index <= (CONTRACT.secret_key_max_index || 0); index++) {
    entry = readKeyByName(secretName(index));
    if (entry && entry.keyId) {
      keys.set(entry.keyId, entry.key);
    }
  }

  verifyKeysCache = keys;
  verifyKeysLoadedAt = Date.now();

  if (keys.size === 0) {
    logMissingKey(secretName(1) + '..' + secretName(CONTRACT.secret_key_max_index));
  }

  return verifyKeysCache;
}

function readLinuxMachineId() {
  for (let i = 0; i < LINUX_MACHINE_ID_FILES.length; i++) {
    try {
      const value = fs.readFileSync(LINUX_MACHINE_ID_FILES[i], 'utf8').trim();
      if (value) {
        return value;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function readWindowsMachineGuid() {
  let result, match;

  result = spawnSync('reg', WINDOWS_MACHINE_GUID_ARGS, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  match = result.stdout.match(WINDOWS_MACHINE_GUID_PATTERN);
  return match ? match[1] : null;
}

function readFallbackMachineSource() {
  const interfaces = os.networkInterfaces();
  const names = Object.keys(interfaces);

  for (let i = 0; i < names.length; i++) {
    const list = interfaces[names[i]] || [];
    for (let j = 0; j < list.length; j++) {
      if (!list[j].internal && list[j].mac && list[j].mac !== '00:00:00:00:00:00') {
        return os.hostname() + '|' + parseInt(list[j].mac.replace(/:/g, ''), 16);
      }
    }
  }

  return os.hostname();
}

function getMachineId(client) {
  let raw;

  if (!machineDigestCache) {
    if (process.platform === 'win32') {
      raw = readWindowsMachineGuid();
    } else if (process.platform === 'linux') {
      raw = readLinuxMachineId();
    }
    machineDigestCache = sha256Hex(raw || readFallbackMachineSource()).slice(0, MACHINE_ID_DIGEST_LENGTH);
  }

  return (client || NCORE_CLIENT) + '-' + machineDigestCache;
}

function createNonce() {
  return crypto.randomBytes(NONCE_BYTES).toString('base64url');
}

function buildCanonical(fields) {
  const names = CONTRACT.canonical_fields || [];
  const values = [];

  for (let i = 0; i < names.length; i++) {
    const value = fields[names[i]];
    if (value === undefined || value === null) {
      return null;
    }
    values.push(String(value));
  }

  return values.join(CONTRACT.canonical_joiner);
}

function signFields(key, fields) {
  const canonical = buildCanonical(fields);

  if (canonical === null) {
    return null;
  }
  return crypto.createHmac('sha256', key).update(canonical, 'utf8').digest('base64url');
}

function splitTarget(target) {
  let parsed;

  try {
    parsed = new URL(String(target || '/'), 'http://localhost');
  } catch (error) {
    return null;
  }

  return { path: parsed.pathname, rawQuery: parsed.search.replace(/^\?/, '') };
}

function resolveSignedDigest(request) {
  const digest = request.contentSha256;

  if (digest === undefined || digest === null) {
    return contentSha256(request.body, request.contentType);
  }
  if (digest === CONTRACT.unsigned_payload) {
    return isUnsignedContentType(request.contentType) ? digest : null;
  }
  return SHA256_HEX_PATTERN.test(String(digest)) ? String(digest) : null;
}

function signRequest(request) {
  let key, target, fields, signature, headers, query, client, digest;

  request = request || {};
  client = request.client || NCORE_CLIENT;

  if (!(CONTRACT.clients || []).includes(client)) {
    logger.error('Client key signer: unknown client ' + client);
    return failure('protocol_invalid');
  }

  key = loadSigningKey();
  if (!key) {
    return failure('missing');
  }

  target = request.url !== undefined ? splitTarget(request.url) : { path: request.path, rawQuery: request.rawQuery || '' };
  if (!target) {
    return failure('signature_invalid');
  }

  digest = resolveSignedDigest(request);
  if (!digest) {
    logger.error('Client key signer: contentSha256 must be lowercase sha256 hex, or the unsigned payload marker with an unsigned content type');
    return failure('body_digest_invalid');
  }

  query = request.query !== undefined ? canonicalQuery(request.query) : canonicalRawQuery(target.rawQuery);
  fields = {
    canonical_version: CONTRACT.canonical_version,
    protocol: CONTRACT.protocol_version,
    method: String(request.method || 'GET').toUpperCase(),
    path: canonicalPath(target.path),
    query,
    client,
    machine_id: request.machineId || getMachineId(client),
    key_id: key.keyId,
    timestamp: String(Math.floor(Date.now() / MS_PER_SECOND)),
    nonce: createNonce(),
    content_sha256: digest,
  };

  signature = signFields(key.key, fields);
  if (!signature) {
    logger.error('Client key signer: request path or query cannot be canonicalized');
    return failure('signature_invalid');
  }

  headers = {};
  headers[headerName('client')] = fields.client;
  headers[headerName('protocol')] = fields.protocol;
  headers[headerName('machine_id')] = fields.machine_id;
  headers[headerName('key_id')] = fields.key_id;
  headers[headerName('timestamp')] = fields.timestamp;
  headers[headerName('nonce')] = fields.nonce;
  headers[headerName('content_sha256')] = fields.content_sha256;
  headers[headerName('signature')] = signature;

  return { ok: true, headers };
}

function hasSignatureHeaders(headers) {
  return Boolean(readHeader(headers, 'signature') || readHeader(headers, 'key_id'));
}

function sweepNonces(now) {
  if (now < nonceSweepAt) {
    return;
  }

  nonceStore.forEach((expiresAt, nonceKey) => {
    if (expiresAt <= now) {
      nonceStore.delete(nonceKey);
    }
  });
  nonceSweepAt = now + (CONTRACT.nonce_ttl_seconds || 0) * MS_PER_SECOND;
}

function rememberNonce(keyId, nonce) {
  const now = Date.now();
  const nonceKey = keyId + ':' + nonce;
  const expiresAt = nonceStore.get(nonceKey);

  sweepNonces(now);
  if (expiresAt && expiresAt > now) {
    return false;
  }

  nonceStore.set(nonceKey, now + (CONTRACT.nonce_ttl_seconds || 0) * MS_PER_SECOND);
  return true;
}

function signaturesEqual(expected, provided) {
  const left = Buffer.from(String(expected), 'utf8');
  const right = Buffer.from(String(provided), 'utf8');

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyRequestHeaders(request) {
  let headers, fields, keys, key, signature, timestamp, digest, unsignedPayload, target;

  request = request || {};
  headers = request.headers || {};

  if (!hasSignatureHeaders(headers)) {
    return failure('missing');
  }

  fields = {
    canonical_version: CONTRACT.canonical_version,
    protocol: readHeader(headers, 'protocol'),
    method: String(request.method || 'GET').toUpperCase(),
    path: null,
    query: null,
    client: readHeader(headers, 'client'),
    machine_id: readHeader(headers, 'machine_id'),
    key_id: readHeader(headers, 'key_id'),
    timestamp: readHeader(headers, 'timestamp'),
    nonce: readHeader(headers, 'nonce'),
    content_sha256: readHeader(headers, 'content_sha256'),
  };
  signature = readHeader(headers, 'signature');

  if (fields.protocol !== CONTRACT.protocol_version
    || !(CONTRACT.clients || []).includes(fields.client)
    || !machineIdPattern.test(fields.machine_id)
    || !signature) {
    return failure('protocol_invalid');
  }

  timestamp = TIMESTAMP_PATTERN.test(fields.timestamp) ? Number(fields.timestamp) : NaN;
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / MS_PER_SECOND - timestamp) > CONTRACT.clock_skew_seconds) {
    return failure('timestamp_invalid');
  }

  if (!noncePattern.test(fields.nonce)) {
    return failure('nonce_invalid');
  }

  digest = fields.content_sha256;
  unsignedPayload = digest === CONTRACT.unsigned_payload;
  if (unsignedPayload ? !isUnsignedContentType(request.contentType) : !SHA256_HEX_PATTERN.test(digest)) {
    return failure('body_digest_invalid');
  }

  keys = loadVerifyKeys(false);
  if (keys.size === 0) {
    return failure('missing');
  }

  key = keys.get(fields.key_id);
  if (!key) {
    key = loadVerifyKeys(true).get(fields.key_id);
  }
  if (!key) {
    return failure('unknown');
  }

  target = request.url !== undefined ? splitTarget(request.url) : { path: request.path, rawQuery: request.rawQuery || '' };
  fields.path = target ? canonicalPath(target.path) : null;
  fields.query = target ? canonicalRawQuery(target.rawQuery) : null;

  if (fields.path === null || fields.query === null || !signaturesEqual(signFields(key, fields), signature)) {
    return failure('signature_invalid');
  }

  if (!rememberNonce(fields.key_id, fields.nonce)) {
    return failure('nonce_replayed');
  }

  return {
    ok: true,
    client: fields.client,
    machineId: fields.machine_id,
    keyId: fields.key_id,
    contentSha256: digest,
    unsignedPayload,
  };
}

function verifyBodyDigest(auth, body) {
  if (!auth || !auth.ok) {
    return failure('missing');
  }
  if (auth.unsignedPayload) {
    return auth;
  }
  return sha256Hex(toBodyBuffer(body)) === auth.contentSha256 ? auth : failure('body_digest_invalid');
}

function verifyRequest(request) {
  const auth = verifyRequestHeaders(request);

  return auth.ok ? verifyBodyDigest(auth, (request || {}).body) : auth;
}

function isSignedClientKeyRequest(headers) {
  return hasSignatureHeaders(headers);
}

module.exports = {
  getContract,
  headerName,
  errorCode,
  canonicalPath,
  canonicalQuery,
  canonicalRawQuery,
  contentSha256,
  isUnsignedContentType,
  decodeKey,
  keyIdOf,
  getMachineId,
  buildCanonical,
  signFields,
  signRequest,
  verifyRequestHeaders,
  verifyBodyDigest,
  verifyRequest,
  isSignedClientKeyRequest,
};
