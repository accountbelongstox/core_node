'use strict'

/**
 * Minimal smoke script to sanity-check WS/VPN message contract normalization.
 * Run with: `node scripts/test-vpn-contract.js`
 */

const {
  STATUS,
  ERROR_CODES,
  normalizeControlPayload,
  normalizeAckPayload,
  normalizeErrorCode
} = require('../src/vpn/messageContract')

function demoContractNormalization() {
  const connectMessage = {
    type: 'tunnel_connect',
    payload: {
      tunnelId: 'demo-tunnel',
      sessionId: 'sess-1',
      targetHost: 'example.com',
      targetPort: 443,
      sourceIp: '10.0.0.2',
      sourcePort: 51000
    }
  }

  const normalizedRequest = normalizeControlPayload(connectMessage)
  const successAck = normalizeAckPayload({
    sessionId: 'sess-1',
    status: STATUS.SUCCESS,
    assignedAddress: '127.0.0.1',
    assignedPort: 1081
  })
  const failedAck = normalizeAckPayload({
    sessionId: 'sess-2',
    status: STATUS.ERROR,
    errorCode: 'ECONNREFUSED',
    message: 'Target refused connection'
  })

  console.log('Normalized connect payload ->', normalizedRequest)
  console.log('Normalized success ack   ->', successAck)
  console.log('Normalized failed ack    ->', failedAck)
  console.log(
    'Error code mapping example ->',
    normalizeErrorCode('downstream_overflow') || ERROR_CODES.UNKNOWN
  )
}

if (require.main === module) {
  demoContractNormalization()
}
