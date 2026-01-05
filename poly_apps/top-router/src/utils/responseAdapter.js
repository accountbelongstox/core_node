'use strict'

/**
 * Prepare an SSE response by setting headers and returning a cleanup function.
 * The caller remains responsible for writing SSE chunks and closing the stream.
 */
function prepareStreamResponse(res) {
  if (!res || res.headersSent) {
    return () => {}
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  let cleaned = false
  const cleanup = () => {
    if (cleaned) {
      return
    }
    cleaned = true
    try {
      if (!res.writableEnded && !res.destroyed) {
        res.end()
      }
    } catch (_) {
      // ignore end errors
    }
  }

  res.on('close', cleanup)
  return cleanup
}

/**
 * Send a single SSE event line to the response stream.
 * @param {import('express').Response} res
 * @param {string} event
 * @param {object} data
 */
function sendSseEvent(res, event, data = {}) {
  if (!res || res.writableEnded || res.destroyed) {
    return
  }

  const lines = []
  if (event) {
    lines.push(`event: ${event}`)
  }
  if (data !== undefined) {
    lines.push(`data: ${JSON.stringify(data)}`)
  }
  lines.push('', '') // blank line terminator
  res.write(lines.join('\n'))
}

module.exports = {
  prepareStreamResponse,
  sendSseEvent
}
