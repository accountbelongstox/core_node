// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const net = require('net');
const { Readable } = require('stream');
const logger = require('./logger');
const clientKeyAuth = require('./client_key_auth');
const serviceContract = require('#@/config/service_contract.js');

const LOCAL_RPC = clientKeyAuth.getContract().local_rpc || {};
const IPV4_LOOPBACK_PREFIX = '127.';
const IPV4_MAPPED_PREFIX = '::ffff:';
const ORIGIN_SCHEMES = ['http:', 'https:'];
const CORS_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const CORS_BASE_HEADERS = ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Session-ID', 'Mcp-Session-Id', 'Last-Event-ID'];
const CORS_EXPOSE_HEADERS = ['Mcp-Session-Id'];
const CORS_MAX_AGE_SECONDS = '600';
const STATUS_NO_CONTENT = 204;
const STATUS_FORBIDDEN = 403;
const DEFAULT_BODY_LIMIT_BYTES = 52428800;
const TRUST_LOOPBACK = 'loopback';
const TRUST_CLIENT_KEY = 'client_key';

let loopbackHosts, corsAllowHeaders;

loopbackHosts = resolveLoopbackHosts();
corsAllowHeaders = CORS_BASE_HEADERS.concat(Object.values(clientKeyAuth.getContract().headers || {})).join(', ');

function resolveLoopbackHosts() {
  const hosts = [];
  const names = LOCAL_RPC.loopback_hosts || [];

  for (let i = 0; i < names.length; i++) {
    try {
      hosts.push(serviceContract.host(names[i]).toLowerCase());
    } catch (error) {
      logger.error('Local RPC guard: unknown loopback host key ' + names[i]);
    }
  }

  return hosts;
}

function defaultBindHost() {
  try {
    return serviceContract.host(LOCAL_RPC.bind_default);
  } catch (error) {
    logger.error('Local RPC guard: unknown bind default ' + LOCAL_RPC.bind_default);
    return loopbackHosts.find((host) => host.includes('.')) || loopbackHosts[0];
  }
}

function resolveBindHost(requestedHost) {
  return requestedHost || defaultBindHost();
}

function isLoopbackBind(host) {
  return isLoopbackAddress(host) || loopbackHosts.includes(String(host || '').toLowerCase());
}

// Peer or bind address: a real IPv4 in 127.0.0.0/8 (also IPv4-mapped), the IPv6 loopback, or an exact contract loopback name
function isLoopbackAddress(address) {
  let value;

  value = String(address || '').trim().toLowerCase();
  if (value.startsWith(IPV4_MAPPED_PREFIX) && net.isIP(value.slice(IPV4_MAPPED_PREFIX.length)) === 4) {
    value = value.slice(IPV4_MAPPED_PREFIX.length);
  }
  if (net.isIP(value) === 4) {
    return value.startsWith(IPV4_LOOPBACK_PREFIX);
  }
  if (net.isIP(value) === 6) {
    return loopbackHosts.includes(value);
  }

  return loopbackHosts.includes(value);
}

// Hostname of a Host header or Origin host, lower-case, one trailing dot removed; a bare IPv6 address stays whole
function hostnameOf(hostHeader) {
  let value, hostname;

  value = String(hostHeader || '').trim().toLowerCase();
  if (value.startsWith('[')) {
    hostname = value.slice(1, value.indexOf(']') === -1 ? value.length : value.indexOf(']'));
  } else if (value.split(':').length > 2) {
    hostname = value;
  } else {
    hostname = value.split(':')[0];
  }

  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

// Host header and Origin hostname: exact contract loopback names only, never a prefix test (DNS rebinding)
function isLoopbackHostHeader(hostHeader) {
  const hostname = hostnameOf(hostHeader);

  return Boolean(hostname) && loopbackHosts.includes(hostname);
}

function isAllowedOrigin(origin, allowedOrigins, allowLoopbackOrigins) {
  let parsed;

  if (!origin) {
    return false;
  }
  if ((allowedOrigins || []).includes(origin)) {
    return true;
  }
  if (allowLoopbackOrigins === false) {
    return false;
  }

  try {
    parsed = new URL(origin);
  } catch (error) {
    return false;
  }

  return ORIGIN_SCHEMES.includes(parsed.protocol) && isLoopbackHostHeader(parsed.host);
}

function splitUrl(url) {
  const value = String(url || '/');
  const index = value.indexOf('?');

  return index === -1 ? { path: value, rawQuery: '' } : { path: value.slice(0, index), rawQuery: value.slice(index + 1) };
}

function forbidden(request, reason) {
  const code = (LOCAL_RPC.error_codes || {})[reason] || reason;

  logger.warn('Local RPC guard rejected ' + request.method + ' from ' + request.remoteAddress + ': ' + code);
  return { ok: false, status: STATUS_FORBIDDEN, code };
}

function authorizeRequest(request, options) {
  let headers, origin, originAllowed, target, auth;

  options = options || {};
  headers = request.headers || {};
  origin = headers.origin || '';
  originAllowed = !origin || isAllowedOrigin(origin, options.allowedOrigins, options.allowLoopbackOrigins);

  // Loopback peer: DNS rebinding (Host) and foreign pages (Origin) are refused with 403, as in pycore's gate
  if (isLoopbackAddress(request.remoteAddress)) {
    if (!isLoopbackHostHeader(headers.host)) {
      return forbidden(request, 'host_forbidden');
    }
    if (!originAllowed) {
      return forbidden(request, 'origin_forbidden');
    }
    return { ok: true, trust: TRUST_LOOPBACK, origin: origin || null };
  }

  target = splitUrl(request.url);
  auth = clientKeyAuth.verifyRequestHeaders({
    method: request.method,
    path: target.path,
    rawQuery: target.rawQuery,
    headers,
    contentType: headers['content-type'],
  });

  if (!auth.ok) {
    logger.warn('Local RPC guard rejected ' + request.method + ' ' + target.path + ' from ' + request.remoteAddress + ': ' + auth.code);
    return auth;
  }

  return { ok: true, trust: TRUST_CLIENT_KEY, auth, origin: originAllowed && origin ? origin : null };
}

function corsHeaders(decision, options) {
  const headers = {};

  if (!decision.origin) {
    return headers;
  }

  headers['Access-Control-Allow-Origin'] = decision.origin;
  headers['Vary'] = 'Origin';
  headers['Access-Control-Allow-Methods'] = CORS_METHODS;
  headers['Access-Control-Allow-Headers'] = corsAllowHeaders;
  headers['Access-Control-Expose-Headers'] = CORS_EXPOSE_HEADERS.join(', ');
  headers['Access-Control-Max-Age'] = CORS_MAX_AGE_SECONDS;
  if (options && options.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

function rejectionBody(decision) {
  return { success: false, code: decision.code, error: decision.code };
}

function isPreflight(method, headers) {
  return method === 'OPTIONS' && Boolean(headers.origin) && Boolean(headers['access-control-request-method']);
}

function requestFields(req) {
  return {
    remoteAddress: req.socket ? req.socket.remoteAddress : '',
    method: req.method,
    url: req.originalUrl || req.url,
    headers: req.headers,
  };
}

function createExpressGuard(options) {
  return function localRpcGuard(req, res, next) {
    const decision = authorizeRequest(requestFields(req), options);

    if (!decision.ok) {
      res.status(decision.status).json(rejectionBody(decision));
      return;
    }

    req.localRpcTrust = decision.trust;
    req.clientKeyAuth = decision.auth || null;
    res.set(corsHeaders(decision, options));

    if (isPreflight(req.method, req.headers)) {
      res.status(STATUS_NO_CONTENT).end();
      return;
    }

    next();
  };
}

function captureRawBody(req, res, buffer) {
  req.rawBody = buffer;
}

function readStreamBody(stream, limit) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;

    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        stream.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', () => resolve(null));
  });
}

function createExpressBodyDigestCheck(options) {
  const limit = (options && options.bodyLimitBytes) || DEFAULT_BODY_LIMIT_BYTES;

  return async function clientKeyBodyDigest(req, res, next) {
    let body, result;

    if (!req.clientKeyAuth || req.clientKeyAuth.unsignedPayload) {
      next();
      return;
    }

    body = req.rawBody;
    if (body === undefined && !req._body && req.readable) {
      body = await readStreamBody(req, limit);
      req.rawBody = body;
    }

    result = clientKeyAuth.verifyBodyDigest(req.clientKeyAuth, body);
    if (!result.ok || body === null) {
      const decision = result.ok ? { status: 401, code: clientKeyAuth.errorCode('body_digest_invalid') } : result;
      res.status(decision.status).json(rejectionBody(decision));
      return;
    }

    next();
  };
}

function createFastifyGuard(options) {
  const limit = (options && options.bodyLimitBytes) || DEFAULT_BODY_LIMIT_BYTES;

  return {
    onRequest: async (request, reply) => {
      const decision = authorizeRequest(requestFields(request.raw), options);

      if (!decision.ok) {
        reply.code(decision.status).send(rejectionBody(decision));
        return reply;
      }

      request.clientKeyAuth = decision.auth || null;
      Object.entries(corsHeaders(decision, options)).forEach(([name, value]) => reply.raw.setHeader(name, value));

      if (isPreflight(request.method, request.headers)) {
        reply.code(STATUS_NO_CONTENT).send();
        return reply;
      }

      return undefined;
    },
    preParsing: async (request, reply, payload) => {
      let body, result;

      if (!request.clientKeyAuth || request.clientKeyAuth.unsignedPayload) {
        return payload;
      }

      body = await readStreamBody(payload, limit);
      result = clientKeyAuth.verifyBodyDigest(request.clientKeyAuth, body);
      if (body === null || !result.ok) {
        const decision = result.ok ? { status: 401, code: clientKeyAuth.errorCode('body_digest_invalid') } : result;
        reply.code(decision.status).send(rejectionBody(decision));
        return Readable.from([]);
      }

      return Readable.from([body]);
    },
  };
}

function createWsVerifyClient(options) {
  return function verifyClient(info, callback) {
    const decision = authorizeRequest(requestFields(info.req), options);

    if (!decision.ok) {
      callback(false, decision.status, decision.code);
      return;
    }

    info.req.localRpcTrust = decision.trust;
    info.req.clientKeyAuth = decision.auth || null;
    callback(true);
  };
}

module.exports = {
  resolveBindHost,
  defaultBindHost,
  isLoopbackBind,
  isLoopbackAddress,
  isLoopbackHostHeader,
  isAllowedOrigin,
  authorizeRequest,
  corsHeaders,
  captureRawBody,
  createExpressGuard,
  createExpressBodyDigestCheck,
  createFastifyGuard,
  createWsVerifyClient,
};
