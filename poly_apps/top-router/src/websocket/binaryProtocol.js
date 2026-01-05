'use strict'

const HEADER_LENGTH = 12

const MESSAGE_TYPES = Object.freeze({
  TUNNEL_DATA: 0x01,
  TUNNEL_CLOSE: 0x02,
  TUNNEL_CONTROL: 0x03
})

class BinaryProtocolError extends Error {
  details

  constructor(message, details = {}) {
    super(message)
    this.name = 'BinaryProtocolError'
    this.details = details
  }
}

function normalizePayload(payload) {
  if (!payload) {
    return Buffer.alloc(0)
  }

  if (Buffer.isBuffer(payload)) {
    return payload
  }

  if (payload instanceof Uint8Array) {
    return Buffer.from(payload)
  }

  if (typeof payload === 'string') {
    return Buffer.from(payload, 'utf8')
  }

  throw new BinaryProtocolError('Invalid payload type', { payloadType: typeof payload })
}

function buildBinaryFrame(sessionId, sequence, payload, options = {}) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new BinaryProtocolError('SessionId is required')
  }

  const sessionIdBuffer = Buffer.from(sessionId)
  if (sessionIdBuffer.length > 255) {
    throw new BinaryProtocolError('SessionId length exceeds 255 bytes', {
      length: sessionIdBuffer.length
    })
  }

  const messageType = options.messageType ?? MESSAGE_TYPES.TUNNEL_DATA
  if (!Object.values(MESSAGE_TYPES).includes(messageType)) {
    throw new BinaryProtocolError('Invalid message type', { messageType })
  }

  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new BinaryProtocolError('Sequence must be a non-negative integer', { sequence })
  }

  const payloadBuffer = normalizePayload(payload)
  const reserved = options.flags || 0

  const header = Buffer.alloc(HEADER_LENGTH)
  header.writeUInt8(messageType, 0)
  header.writeUInt8(sessionIdBuffer.length, 1)
  header.writeUInt32BE(sequence >>> 0, 2)
  header.writeUInt32BE(payloadBuffer.length >>> 0, 6)
  header.writeUInt16BE(reserved & 0xffff, 10)

  return Buffer.concat([header, sessionIdBuffer, payloadBuffer])
}

function parseBinaryFrame(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new BinaryProtocolError('Binary frame must be a Buffer')
  }

  if (buffer.length < HEADER_LENGTH) {
    throw new BinaryProtocolError('Binary frame too short', { length: buffer.length })
  }

  const messageType = buffer.readUInt8(0)
  const sessionIdLength = buffer.readUInt8(1)
  const sequence = buffer.readUInt32BE(2)
  const dataLength = buffer.readUInt32BE(6)
  const flags = buffer.readUInt16BE(10)

  if (!Object.values(MESSAGE_TYPES).includes(messageType)) {
    throw new BinaryProtocolError('Unknown binary message type', { messageType })
  }

  const expectedLength = HEADER_LENGTH + sessionIdLength + dataLength
  if (buffer.length < expectedLength) {
    throw new BinaryProtocolError('Binary frame truncated', {
      expectedLength,
      actualLength: buffer.length
    })
  }

  const sessionIdStart = HEADER_LENGTH
  const payloadStart = sessionIdStart + sessionIdLength
  const sessionIdBuffer = buffer.subarray(sessionIdStart, payloadStart)
  const payloadBuffer = buffer.subarray(payloadStart, payloadStart + dataLength)

  return {
    messageType,
    sessionId: sessionIdBuffer.toString('utf8'),
    sequence,
    dataLength,
    flags,
    payload: payloadBuffer
  }
}

function isBinaryFrame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_LENGTH) {
    return false
  }
  const messageType = buffer.readUInt8(0)
  const sessionIdLength = buffer.readUInt8(1)
  const dataLength = buffer.readUInt32BE(6)
  const expectedLength = HEADER_LENGTH + sessionIdLength + dataLength
  return Object.values(MESSAGE_TYPES).includes(messageType) && buffer.length >= expectedLength
}

module.exports = {
  HEADER_LENGTH,
  MESSAGE_TYPES,
  BinaryProtocolError,
  buildBinaryFrame,
  parseBinaryFrame,
  isBinaryFrame
}
