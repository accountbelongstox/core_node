const os = require('os')
const logger = require('../utils/logger')

/**
 * 获取系统健康状态信息
 * @returns {Object} 系统健康状态数据
 */
function getSystemHealth() {
  try {
    // 内存信息
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2)

    // 进程内存信息
    const processMemory = process.memoryUsage()

    // CPU 信息
    const cpus = os.cpus()
    const cpuCount = cpus.length
    const cpuModel = cpus[0]?.model || 'Unknown'

    // 系统负载（1分钟、5分钟、15分钟平均负载）
    const loadAvg = os.loadavg()

    // 运行时间
    const systemUptime = os.uptime()
    const processUptime = process.uptime()

    // 磁盘使用情况（需要读取文件系统，这里简单处理）
    let diskInfo = null
    try {
      const { execSync } = require('child_process')
      // macOS/Linux: df -h / | tail -1
      const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf-8' })
      const parts = dfOutput.trim().split(/\s+/)
      if (parts.length >= 5) {
        diskInfo = {
          total: parts[1],
          used: parts[2],
          available: parts[3],
          usePercent: parts[4]
        }
      }
    } catch (dfError) {
      // Windows 或其他错误情况，跳过磁盘信息
      logger.debug('Failed to get disk info:', dfError.message)
    }

    // 网络接口信息
    const networkInterfaces = os.networkInterfaces()
    const activeInterfaces = Object.entries(networkInterfaces)
      .filter(([_name, ifaces]) => ifaces.some((iface) => !iface.internal))
      .map(([name, ifaces]) => ({
        name,
        addresses: ifaces
          .filter((iface) => !iface.internal)
          .map((iface) => ({
            family: iface.family,
            address: iface.address
          }))
      }))

    return {
      // 系统信息
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        release: os.release(),
        type: os.type(),
        uptime: {
          seconds: Math.floor(systemUptime),
          formatted: formatUptime(systemUptime)
        }
      },

      // CPU 信息
      cpu: {
        model: cpuModel,
        cores: cpuCount,
        loadAverage: {
          '1min': loadAvg[0].toFixed(2),
          '5min': loadAvg[1].toFixed(2),
          '15min': loadAvg[2].toFixed(2)
        },
        loadPercent: {
          '1min': ((loadAvg[0] / cpuCount) * 100).toFixed(2),
          '5min': ((loadAvg[1] / cpuCount) * 100).toFixed(2),
          '15min': ((loadAvg[2] / cpuCount) * 100).toFixed(2)
        }
      },

      // 内存信息
      memory: {
        total: formatBytes(totalMemory),
        used: formatBytes(usedMemory),
        free: formatBytes(freeMemory),
        usagePercent: parseFloat(memoryUsagePercent),
        totalBytes: totalMemory,
        usedBytes: usedMemory,
        freeBytes: freeMemory
      },

      // 进程信息
      process: {
        pid: process.pid,
        uptime: {
          seconds: Math.floor(processUptime),
          formatted: formatUptime(processUptime)
        },
        nodeVersion: process.version,
        memory: {
          rss: formatBytes(processMemory.rss),
          heapTotal: formatBytes(processMemory.heapTotal),
          heapUsed: formatBytes(processMemory.heapUsed),
          external: formatBytes(processMemory.external),
          heapUsagePercent: ((processMemory.heapUsed / processMemory.heapTotal) * 100).toFixed(2)
        }
      },

      // 磁盘信息（如果可用）
      disk: diskInfo,

      // 网络接口
      network: activeInterfaces,

      // 时间戳
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    logger.error('Failed to get system health:', error)
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B'
  }
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 格式化运行时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`)
  }

  return parts.join(' ')
}

module.exports = {
  getSystemHealth,
  formatBytes,
  formatUptime
}
