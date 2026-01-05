'use strict'

const axios = require('axios')
const config = require('../../config/config')
const logger = require('../utils/logger')

function resolveLocalHost() {
  const host = config.server?.host || '127.0.0.1'
  if (host === '0.0.0.0' || host === '::') {
    return '127.0.0.1'
  }
  return host
}

function getBaseUrl() {
  return `http://${resolveLocalHost()}:${config.server.port}`
}

function buildUrl(endpoint = '/') {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${getBaseUrl()}${normalized}`
}

async function callModelApi({
  endpoint,
  method = 'POST',
  headers = {},
  body = {},
  stream = false,
  timeout = config.websocketClient?.requestTimeout || 600000
}) {
  const url = buildUrl(endpoint)
  try {
    if (stream) {
      const resp = await axios({
        url,
        method,
        headers,
        data: body,
        responseType: 'stream',
        timeout
      })
      return { type: 'stream', response: resp }
    }
    const resp = await axios({ url, method, headers, data: body, timeout })
    const data = resp.data?.data || resp.data || {}
    return {
      type: 'json',
      statusCode: data.statusCode || resp.status || 200,
      headers: data.headers || resp.headers || {},
      body: data.body !== undefined ? data.body : data,
      usage: data.usage || data.body?.usage || null
    }
  } catch (error) {
    const msg = error.response?.data?.message || error.message || 'Model API request failed'
    logger.error('Model API call failed', { endpoint, error: msg })
    throw new Error(msg)
  }
}

async function callLocalApi({
  endpoint,
  method = 'POST',
  headers = {},
  body = {},
  stream = false,
  timeout = 30000
}) {
  const url = buildUrl(endpoint)
  try {
    if (stream) {
      const resp = await axios({
        url,
        method,
        headers,
        data: body,
        responseType: 'stream',
        timeout
      })
      return { type: 'stream', response: resp }
    }
    const resp = await axios({ url, method, headers, data: body, timeout })
    const data = resp.data?.data || resp.data || {}
    return {
      statusCode: data.statusCode || resp.status || 200,
      headers: data.headers || resp.headers || {},
      body: data.body !== undefined ? data.body : data
    }
  } catch (error) {
    const msg = error.response?.data?.message || error.message || 'Local API request failed'
    logger.error('Local API call failed', { endpoint, error: msg })
    throw new Error(msg)
  }
}

module.exports = { callModelApi, callLocalApi }
