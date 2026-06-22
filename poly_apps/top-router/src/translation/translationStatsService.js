const datastore = require('../models/datastore')
const logger = require('../utils/logger')

/**
 * Translation Statistics Service
 * Tracks translation usage, performance, and costs
 */
class TranslationStatsService {
  constructor() {
    this.statsKeyPrefix = 'translation:stats:'
    this._client = null // Lazy initialization

    // WebSocket periodic stats reporting
    this.statsReportInterval = null
  }

  /**
   * Get database client with lazy initialization
   * @returns {Object} Database client
   */
  get client() {
    if (!this._client) {
      this._client = datastore.getClientSafe()
    }
    return this._client
  }

  /**
   * Record a translation event
   * @param {Object} event - Translation event data
   */
  async recordTranslation(event) {
    try {
      const {
        keyId,
        sourceLang,
        targetLang,
        provider,
        latency,
        cost = 0,
        cached = false,
        cacheType = null // 'memory' | 'redis' | null
      } = event

      const timestamp = Date.now()
      const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const hour = new Date().getHours()

      // Use Redis pipeline for atomic updates
      const pipeline = this.client.pipeline()

      // 1. Total counters
      pipeline.incr(`${this.statsKeyPrefix}total`)
      pipeline.incr(`${this.statsKeyPrefix}daily:${date}`)
      pipeline.incr(`${this.statsKeyPrefix}hourly:${date}:${hour}`)

      // 2. Provider statistics
      if (cached) {
        pipeline.incr(`${this.statsKeyPrefix}provider:cache:${cacheType}`)
      } else {
        pipeline.incr(`${this.statsKeyPrefix}provider:${provider}`)
      }

      // 3. Language pair statistics
      pipeline.incr(`${this.statsKeyPrefix}lang:${sourceLang}->${targetLang}`)

      // 4. Latency tracking (store last 1000 latencies using sorted set)
      pipeline.zadd(`${this.statsKeyPrefix}latencies`, timestamp, `${latency}:${timestamp}`)
      pipeline.zremrangebyrank(`${this.statsKeyPrefix}latencies`, 0, -1001)

      // 5. Cost tracking
      if (cost > 0) {
        pipeline.incrbyfloat(`${this.statsKeyPrefix}cost:total`, cost)
        pipeline.incrbyfloat(`${this.statsKeyPrefix}cost:daily:${date}`, cost)
      }

      // 6. Error tracking (if error exists)
      if (event.error) {
        pipeline.incr(`${this.statsKeyPrefix}errors:${event.errorType || 'unknown'}`)
      }

      // 7. Per-API-Key statistics (if keyId provided)
      if (keyId) {
        pipeline.incr(`${this.statsKeyPrefix}key:${keyId}:total`)
        pipeline.incr(`${this.statsKeyPrefix}key:${keyId}:daily:${date}`)

        if (cached) {
          pipeline.incr(`${this.statsKeyPrefix}key:${keyId}:cache:${cacheType}`)
        } else {
          pipeline.incr(`${this.statsKeyPrefix}key:${keyId}:provider:${provider}`)
        }
      }

      await pipeline.exec()

      logger.debug('Translation stats recorded', {
        keyId,
        provider: cached ? `cache:${cacheType}` : provider,
        latency,
        cost,
        langPair: `${sourceLang}->${targetLang}`
      })
    } catch (error) {
      logger.error('Failed to record translation stats:', error)
    }
  }

  /**
   * Get overall statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getStats() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const currentHour = new Date().getHours()

      const [
        total,
        translationsToday,
        translationsThisHour,
        totalCost,
        costToday,
        latencies,
        claudeCount,
        geminiCount,
        memCacheCount,
        redisCacheCount
      ] = await Promise.all([
        this.client.get(`${this.statsKeyPrefix}total`),
        this.client.get(`${this.statsKeyPrefix}daily:${today}`),
        this.client.get(`${this.statsKeyPrefix}hourly:${today}:${currentHour}`),
        this.client.get(`${this.statsKeyPrefix}cost:total`),
        this.client.get(`${this.statsKeyPrefix}cost:daily:${today}`),
        this.client.zrange(`${this.statsKeyPrefix}latencies`, 0, -1),
        this.client.get(`${this.statsKeyPrefix}provider:claude`),
        this.client.get(`${this.statsKeyPrefix}provider:gemini`),
        this.client.get(`${this.statsKeyPrefix}provider:cache:memory`),
        this.client.get(`${this.statsKeyPrefix}provider:cache:redis`)
      ])

      // Calculate latency statistics
      const latencyValues = latencies.map((l) => parseFloat(l.split(':')[0]))
      const sorted = latencyValues.sort((a, b) => a - b)

      const avgLatency =
        latencyValues.length > 0
          ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)
          : 0

      const p95Latency = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] || 0 : 0
      const p99Latency = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] || 0 : 0

      // Calculate cache hit rate
      const totalInt = parseInt(total || 0)
      const memCacheInt = parseInt(memCacheCount || 0)
      const redisCacheInt = parseInt(redisCacheCount || 0)
      const totalCacheHits = memCacheInt + redisCacheInt

      return {
        totalTranslations: totalInt,
        translationsToday: parseInt(translationsToday || 0),
        translationsThisHour: parseInt(translationsThisHour || 0),

        avgLatency,
        p95Latency,
        p99Latency,

        cacheHitRate: this._calculateHitRate(totalCacheHits, totalInt),
        memoryHitRate: this._calculateHitRate(memCacheInt, totalInt),
        redisHitRate: this._calculateHitRate(redisCacheInt, totalInt),

        providerUsage: {
          claude: parseInt(claudeCount || 0),
          gemini: parseInt(geminiCount || 0),
          memoryCache: memCacheInt,
          redisCache: redisCacheInt
        },

        totalCost: parseFloat(totalCost || 0),
        costToday: parseFloat(costToday || 0),
        avgCostPerTranslation: totalInt > 0 ? parseFloat(totalCost || 0) / totalInt : 0
      }
    } catch (error) {
      logger.error('Failed to get translation stats:', error)
      return this._getEmptyStats()
    }
  }

  /**
   * Get statistics for specific API Key
   * @param {string} keyId - API Key ID
   * @returns {Promise<Object>} - Key-specific statistics
   */
  async getKeyStats(keyId) {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [total, dailyTotal, claudeCount, geminiCount, memCacheCount, redisCacheCount] =
        await Promise.all([
          this.client.get(`${this.statsKeyPrefix}key:${keyId}:total`),
          this.client.get(`${this.statsKeyPrefix}key:${keyId}:daily:${today}`),
          this.client.get(`${this.statsKeyPrefix}key:${keyId}:provider:claude`),
          this.client.get(`${this.statsKeyPrefix}key:${keyId}:provider:gemini`),
          this.client.get(`${this.statsKeyPrefix}key:${keyId}:cache:memory`),
          this.client.get(`${this.statsKeyPrefix}key:${keyId}:cache:redis`)
        ])

      const totalInt = parseInt(total || 0)
      const memCacheInt = parseInt(memCacheCount || 0)
      const redisCacheInt = parseInt(redisCacheCount || 0)
      const totalCacheHits = memCacheInt + redisCacheInt

      return {
        keyId,
        totalTranslations: totalInt,
        translationsToday: parseInt(dailyTotal || 0),
        cacheHitRate: this._calculateHitRate(totalCacheHits, totalInt),
        providerUsage: {
          claude: parseInt(claudeCount || 0),
          gemini: parseInt(geminiCount || 0),
          memoryCache: memCacheInt,
          redisCache: redisCacheInt
        }
      }
    } catch (error) {
      logger.error(`Failed to get key stats for ${keyId}:`, error)
      return { keyId, totalTranslations: 0 }
    }
  }

  /**
   * Get language pair statistics
   * @returns {Promise<Object>} - Language pair statistics
   */
  async getLanguageStats() {
    try {
      // Get all language pair keys
      const keys = await this.client.keys(`${this.statsKeyPrefix}lang:*`)

      if (!keys || keys.length === 0) {
        return {}
      }

      const stats = {}

      for (const key of keys) {
        const langPair = key.replace(`${this.statsKeyPrefix}lang:`, '')
        const count = await this.client.get(key)
        stats[langPair] = parseInt(count || 0)
      }

      return stats
    } catch (error) {
      logger.error('Failed to get language stats:', error)
      return {}
    }
  }

  /**
   * Get error statistics
   * @returns {Promise<Object>} - Error statistics
   */
  async getErrorStats() {
    try {
      const keys = await this.client.keys(`${this.statsKeyPrefix}errors:*`)

      if (!keys || keys.length === 0) {
        return {}
      }

      const errors = {}

      for (const key of keys) {
        const errorType = key.replace(`${this.statsKeyPrefix}errors:`, '')
        const count = await this.client.get(key)
        errors[errorType] = parseInt(count || 0)
      }

      return errors
    } catch (error) {
      logger.error('Failed to get error stats:', error)
      return {}
    }
  }

  /**
   * Calculate hit rate percentage
   * @private
   */
  _calculateHitRate(hits, total) {
    return total > 0 ? `${((hits / total) * 100).toFixed(2)}%` : '0%'
  }

  /**
   * Get empty stats object
   * @private
   */
  _getEmptyStats() {
    return {
      totalTranslations: 0,
      translationsToday: 0,
      translationsThisHour: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      cacheHitRate: '0%',
      memoryHitRate: '0%',
      redisHitRate: '0%',
      providerUsage: {
        claude: 0,
        gemini: 0,
        memoryCache: 0,
        redisCache: 0
      },
      totalCost: 0,
      costToday: 0,
      avgCostPerTranslation: 0
    }
  }

  /**
   * Start periodic stats reporting (WebSocket push to Service端)
   * @param {Object} websocketClient - WebSocket client service instance
   * @param {number} intervalMinutes - Reporting interval in minutes (default: 5)
   */
  startPeriodicReport(websocketClient, intervalMinutes = 5) {
    if (this.statsReportInterval) {
      logger.debug('Translation stats reporting already started')
      return
    }

    const intervalMs = intervalMinutes * 60 * 1000

    this.statsReportInterval = setInterval(async () => {
      try {
        const stats = await this.getStats()

        await websocketClient.sendMessage({
          type: 'stats_report',
          category: 'translation',
          data: stats
        })

        logger.debug('Translation stats report sent to Service', {
          totalTranslations: stats.totalTranslations,
          cacheHitRate: stats.cacheHitRate
        })
      } catch (error) {
        logger.error('Failed to send translation stats report:', error)
      }
    }, intervalMs)

    logger.info(`Translation stats reporting started (interval: ${intervalMinutes}min)`)
  }

  /**
   * Stop periodic stats reporting
   */
  stopPeriodicReport() {
    if (this.statsReportInterval) {
      clearInterval(this.statsReportInterval)
      this.statsReportInterval = null
      logger.info('Translation stats reporting stopped')
    }
  }

  /**
   * Reset all statistics (use with caution)
   */
  async resetStats() {
    try {
      const keys = await this.client.keys(`${this.statsKeyPrefix}*`)

      if (keys && keys.length > 0) {
        await this.client.del(...keys)
        logger.warn(`Reset ${keys.length} translation statistics keys`)
      }

      return { success: true, keysDeleted: keys.length }
    } catch (error) {
      logger.error('Failed to reset translation stats:', error)
      throw error
    }
  }
}

// Create singleton instance
const translationStatsService = new TranslationStatsService()

module.exports = translationStatsService
