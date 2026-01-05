#!/usr/bin/env node
'use strict'

/**
 * Minimal SOCKS5 → VPN tunnel smoke test.
 * Prereq: VPN server running with an active tunnel (socks5Port + token/password set).
 * Defaults are read from config.vpn.socks (or VPN_SOCKS_* envs).
 * Usage: node scripts/test-vpn-socks.js --host 127.0.0.1 --port 1080 --token YOUR_PWD --target example.com --tport 80
 */

const net = require('net')
const tls = require('tls')
const { argv } = require('process')
const config = require('../config/config')

function parseArgs() {
  const defaultHost = config.vpn?.socks?.host || process.env.VPN_SOCKS_HOST || '127.0.0.1'
  const defaultPort = config.vpn?.socks?.port || parseInt(process.env.VPN_SOCKS_PORT, 10) || 1080
  const defaultToken = config.vpn?.socks?.auth?.token || process.env.VPN_SOCKS_AUTH_TOKEN || ''
  const defaultTarget = process.env.VPN_TEST_TARGET || 'example.com'
  const defaultTargetPort = parseInt(process.env.VPN_TEST_TARGET_PORT, 10) || 80

  const params = {
    host: defaultHost,
    port: defaultPort,
    token: defaultToken,
    target: defaultTarget,
    tport: defaultTargetPort,
    secure: false,
    timeout: 10000
  }
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('--')) {
      continue
    }
    const [k, v] = arg.replace(/^--/, '').split('=')
    const key = k.toLowerCase()
    if (key === 'host') {
      params.host = v
    }
    if (key === 'port') {
      params.port = Number(v)
    }
    if (key === 'token' || key === 'password') {
      params.token = v
    }
    if (key === 'target') {
      params.target = v
    }
    if (key === 'tport') {
      params.tport = Number(v)
    }
    if (key === 'secure') {
      params.secure = v === 'true'
    }
    if (key === 'timeout') {
      params.timeout = Number(v)
    }
  }
  return params
}

function buildSocksRequest(host, port) {
  const hostBuf = Buffer.from(host)
  const req = Buffer.alloc(7 + hostBuf.length)
  req.writeUInt8(0x05, 0) // ver
  req.writeUInt8(0x01, 1) // cmd=connect
  req.writeUInt8(0x00, 2) // rsv
  req.writeUInt8(0x03, 3) // atyp=domain
  req.writeUInt8(hostBuf.length, 4)
  hostBuf.copy(req, 5)
  req.writeUInt16BE(port, 5 + hostBuf.length)
  return req
}

async function run() {
  const opts = parseArgs()
  console.log(`Connecting to SOCKS ${opts.host}:${opts.port}, target ${opts.target}:${opts.tport}`)

  const socket = opts.secure
    ? tls.connect({ host: opts.host, port: opts.port })
    : net.connect(opts.port, opts.host)

  const deadline = setTimeout(() => {
    console.error('Timeout during handshake')
    socket.destroy()
  }, opts.timeout)
  if (deadline.unref) {
    deadline.unref()
  }

  const sendAuth = () => {
    // method selection: username/password only
    socket.write(Buffer.from([0x05, 0x01, 0x02]))
  }

  const sendPassword = () => {
    const user = Buffer.from('vpn')
    const pwd = Buffer.from(opts.token || '')
    const buf = Buffer.alloc(3 + user.length + pwd.length)
    buf.writeUInt8(0x01, 0) // ver
    buf.writeUInt8(user.length, 1)
    user.copy(buf, 2)
    buf.writeUInt8(pwd.length, 2 + user.length)
    pwd.copy(buf, 3 + user.length)
    socket.write(buf)
  }

  const sendConnect = () => {
    const req = buildSocksRequest(opts.target, opts.tport)
    socket.write(req)
  }

  socket.once('connect', sendAuth)

  let stage = 'method'

  socket.on('data', (chunk) => {
    if (stage === 'method') {
      if (chunk[1] !== 0x02) {
        console.error('SOCKS server did not accept username/password')
        socket.destroy()
        return
      }
      stage = 'auth'
      sendPassword()
      return
    }
    if (stage === 'auth') {
      if (chunk[1] !== 0x00) {
        console.error('Auth failed')
        socket.destroy()
        return
      }
      stage = 'connect'
      sendConnect()
      return
    }
    if (stage === 'connect') {
      if (chunk[1] !== 0x00) {
        console.error('Connect failed, code', chunk[1])
        socket.destroy()
        return
      }
      stage = 'stream'
      clearTimeout(deadline)
      console.log('Handshake OK, sending HTTP request...')
      socket.write(`GET / HTTP/1.1\r\nHost: ${opts.target}\r\nConnection: close\r\n\r\n`)
      return
    }
    if (stage === 'stream') {
      console.log('Received data chunk:', chunk.length)
    }
  })

  socket.on('close', () => {
    console.log('Socket closed')
  })

  socket.on('error', (err) => {
    console.error('Socket error:', err.message)
  })
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
