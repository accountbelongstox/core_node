'use strict'

const { DEFAULTS } = require('./constants')
const { HEADER_LENGTH } = DEFAULTS

/**
 * Encode VPN tunnel data into a binary frame.
 * @param {Object} options
 * @param {number} options.type - Frame type (1 byte)
 * @param {string} options.sessionId - Unique session identifier
 * @param {number} options.sequence - Sequence number (uint32)
 * @param {Buffer} options.payload - Payload buffer
 * @returns {Buffer}
 */
function buildFrame({ type, sessionId, sequence, payload }) {
  if (!Buffer.isBuffer(payload)) {
    throw new TypeError('Payload must be a Buffer')
  }

  const sessionIdBuffer = Buffer.from(sessionId || '', 'utf8')
  const frame = Buffer.allocUnsafe(HEADER_LENGTH + sessionIdBuffer.length + payload.length)

  let offset = 0
  frame.writeUInt8(type & 0xff, offset)
  offset += 1

  frame.writeUInt8(sessionIdBuffer.length & 0xff, offset)
  offset += 1

  frame.writeUInt32BE(sequence >>> 0, offset)
  offset += 4

  frame.writeUInt32BE(payload.length >>> 0, offset)
  offset += 4

  frame.writeUInt16BE(0, offset)
  offset += 2

  sessionIdBuffer.copy(frame, offset)
  offset += sessionIdBuffer.length

  payload.copy(frame, offset)

  return frame
}

/**
 * Decode a binary frame into its components.
 * @param {Buffer} buffer - Binary frame buffer
 * @returns {{ type: number, sessionId: string, sequence: number, payload: Buffer }}
 */
function parseFrame(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Buffer must be a Buffer')
  }

  if (buffer.length < HEADER_LENGTH) {
    throw new Error('Frame too short')
  }

  let offset = 0
  const type = buffer.readUInt8(offset)
  offset += 1

  const sessionIdLength = buffer.readUInt8(offset)
  offset += 1

  const sequence = buffer.readUInt32BE(offset)
  offset += 4

  const payloadLength = buffer.readUInt32BE(offset)
  offset += 4

  offset += 2 // reserved

  if (buffer.length < HEADER_LENGTH + sessionIdLength) {
    throw new Error('Frame sessionId length exceeds buffer length')
  }

  const sessionId = buffer.toString('utf8', offset, offset + sessionIdLength)
  offset += sessionIdLength

  const expectedLength = HEADER_LENGTH + sessionIdLength + payloadLength
  if (buffer.length !== expectedLength) {
    const error = new Error('Frame payload length mismatch')
    error.details = {
      bufferLength: buffer.length,
      headerLength: HEADER_LENGTH,
      sessionIdLength,
      payloadLength,
      expectedLength,
      difference: buffer.length - expectedLength
    }
    throw error
  }

  const payload = buffer.subarray(offset)

  return { type, sessionId, sequence, payload }
}

module.exports = {
  buildFrame,
  parseFrame
}
