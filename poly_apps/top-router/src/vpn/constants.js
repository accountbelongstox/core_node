'use strict'

module.exports = {
  MESSAGE_TYPES: {
    // Legacy vpn_* control messages (kept for backwards compatibility)
    SESSION_OPEN: 'vpn_session_open',
    SESSION_OPEN_ACK: 'vpn_session_open_ack',
    SESSION_CLOSE: 'vpn_session_close',
    SESSION_ERROR: 'vpn_session_error',
    SESSION_DATA: 'vpn_session_data',
    TUNNEL_STATS: 'vpn_tunnel_stats',
    // Modern tunnel_* control messages used by the service
    TUNNEL_START: 'tunnel_start',
    TUNNEL_START_ACK: 'tunnel_start_ack',
    TUNNEL_CONNECT: 'tunnel_connect',
    TUNNEL_CONNECT_ACK: 'tunnel_connect_ack',
    TUNNEL_DISCONNECT: 'tunnel_disconnect',
    TUNNEL_STOP: 'tunnel_stop',
    TUNNEL_STOP_ACK: 'tunnel_stop_ack'
  },
  FRAME_TYPES: {
    DATA: 0x01
  },
  DEFAULTS: {
    HEADER_LENGTH: 12,
    RESERVED_BYTES: 2
  }
}
