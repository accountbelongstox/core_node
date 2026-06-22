'use strict'

const STATUS = {
  SUCCESS: 'success',
  ERROR: 'error'
}

const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  CONNECT_FAILED: 'CONNECT_FAILED',
  CLIENT_CONNECT_FAILED: 'CLIENT_CONNECT_FAILED',
  CLIENT_CONNECT_TIMEOUT: 'CLIENT_CONNECT_TIMEOUT',
  TARGET_UNREACHABLE: 'TARGET_UNREACHABLE',
  TARGET_CONNECTION_REFUSED: 'TARGET_CONNECTION_REFUSED',
  TARGET_TIMEOUT: 'TARGET_TIMEOUT',
  SOCKET_CLOSED: 'SOCKET_CLOSED',
  DOWNSTREAM_OVERFLOW: 'DOWNSTREAM_OVERFLOW',
  PARSE_ERROR: 'PARSE_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
}

function normalizeControlPayload(message = {}) {
  return (
    message?.payload ||
    message?.data ||
    message?.body ||
    {
      // 空对象保证调用方不需要判空
    }
  )
}

function normalizeErrorCode(input) {
  if (!input) {
    return null
  }

  if (typeof input === 'object' && input.code) {
    return normalizeErrorCode(input.code)
  }

  const code = String(input).trim()
  if (!code) {
    return null
  }
  const upper = code.toUpperCase()

  switch (upper) {
    case 'ECONNREFUSED':
      return ERROR_CODES.TARGET_CONNECTION_REFUSED
    case 'ENETUNREACH':
    case 'EHOSTUNREACH':
      return ERROR_CODES.TARGET_UNREACHABLE
    case 'ETIMEDOUT':
      return ERROR_CODES.TARGET_TIMEOUT
    case 'CLIENT_CONNECT_TIMEOUT':
    case 'ETIMEOUT':
    case 'TIMEOUT':
      return ERROR_CODES.CLIENT_CONNECT_TIMEOUT
    case 'SOCKET_CLOSED':
    case 'EPIPE':
    case 'ECONNRESET':
      return ERROR_CODES.SOCKET_CLOSED
    case 'BUFFER_LIMIT':
    case 'DOWNSTREAM_OVERFLOW':
      return ERROR_CODES.DOWNSTREAM_OVERFLOW
    case 'INVALID_REQUEST':
      return ERROR_CODES.INVALID_REQUEST
    default:
      return upper
  }
}

function normalizeAckPayload(payload = {}) {
  const statusValue = String(payload.status || payload.result || payload.state || '').toLowerCase()
  const success =
    payload.success === true ||
    statusValue === STATUS.SUCCESS ||
    statusValue === 'ok' ||
    statusValue === 'connected' ||
    statusValue === 'ready'

  const errorCode = normalizeErrorCode(payload.errorCode || payload.code || payload.statusCode)

  const base = {
    sessionId: payload.sessionId || payload.id || null,
    tunnelId: payload.tunnelId || null,
    targetHost: payload.targetHost || null,
    targetPort: payload.targetPort || null,
    assignedAddress:
      payload.assignedAddress ||
      payload.localAddress ||
      payload.clientAddress ||
      payload.address ||
      null,
    assignedPort:
      payload.assignedPort || payload.localPort || payload.clientPort || payload.port || null,
    receivedAt: Date.now()
  }

  if (success) {
    return {
      ...base,
      status: STATUS.SUCCESS,
      success: true,
      errorCode: null,
      message: null
    }
  }

  return {
    ...base,
    status: STATUS.ERROR,
    success: false,
    errorCode: errorCode || ERROR_CODES.CLIENT_CONNECT_FAILED,
    message: payload.message || payload.error || payload.reason || null
  }
}

module.exports = {
  STATUS,
  ERROR_CODES,
  normalizeControlPayload,
  normalizeAckPayload,
  normalizeErrorCode
}
