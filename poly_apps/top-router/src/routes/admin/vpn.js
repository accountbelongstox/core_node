const express = require('express')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const vpn = require('../../vpn')

const router = express.Router()

function requireServer(res) {
  const service = vpn.getServerService ? vpn.getServerService() : null
  if (!service) {
    res.status(400).json({ success: false, error: 'VPN_SERVER_DISABLED' })
    return null
  }
  return service
}

// 列出隧道
router.get('/vpn/tunnels', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  const tunnels = service.listTunnels()
  const result = tunnels.map((t) => ({
    ...t,
    stats: service.getTunnelStats ? service.getTunnelStats(t.tunnelId) : null
  }))
  res.json({ success: true, data: result })
})

// 创建隧道
router.post('/vpn/tunnels', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  try {
    const created = await service.createTunnel(req.body || {})
    res.json({ success: true, data: created })
  } catch (err) {
    logger.warn('VPN tunnel create failed', { error: err.message })
    res.status(400).json({ success: false, error: err.message })
  }
})

// 更新隧道
router.patch('/vpn/tunnels/:id', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  try {
    const updated = await service.updateTunnel(req.params.id, req.body || {})
    res.json({ success: true, data: updated })
  } catch (err) {
    logger.warn('VPN tunnel update failed', { tunnelId: req.params.id, error: err.message })
    res.status(400).json({ success: false, error: err.message })
  }
})

// 删除隧道
router.delete('/vpn/tunnels/:id', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  try {
    await service.deleteTunnel(req.params.id, 'admin_delete')
    res.json({ success: true })
  } catch (err) {
    logger.warn('VPN tunnel delete failed', { tunnelId: req.params.id, error: err.message })
    res.status(400).json({ success: false, error: err.message })
  }
})

// 手动触发过期清理
router.post('/vpn/tunnels/purge', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  try {
    const removed = await service.purgeExpired(Date.now())
    res.json({ success: true, data: removed })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// 查询某隧道的活跃会话
router.get('/vpn/tunnels/:id/sessions', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  try {
    const sessions = service.listSessions(req.params.id)
    res.json({ success: true, data: sessions })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// 查询某隧道的近期事件/握手日志
router.get('/vpn/tunnels/:id/events', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
  try {
    const events = await service.getTunnelEvents(req.params.id, limit)
    res.json({ success: true, data: events })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// 清空某隧道的统计/事件
router.post('/vpn/tunnels/:id/reset', authenticateAdmin, async (req, res) => {
  const service = requireServer(res)
  if (!service) return
  try {
    const result = await service.clearStats(req.params.id)
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

module.exports = router
