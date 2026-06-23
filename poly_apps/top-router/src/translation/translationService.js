const crypto = require('crypto')
const datastore = require('../models/datastore')
const config = require('../../config/config')
const logger = require('../utils/logger')
const { detectLanguage, needsTranslation } = require('../translation/languageDetector')
const SimpleLRUCache = require('../translation/simpleLRUCache')
const translationStatsService = require('./translationStatsService')
const cacheWarmingService = require('./cacheWarmingService')

class TranslationService {
  constructor() {
    this.config = config.translation || {}
    this.enabled = this.config.enabled || false
    this.provider = this.config.provider || 'claude'
    this.fallbackProvider = this.config.fallbackProvider || 'gemini'
    this.cacheTTL = this.config.cacheTTL || 86400 // 24 hours
    this.timeout = this.config.timeout || 5000 // 5 seconds
    this.batchThreshold = this.config.batchThreshold || 5 // 批量翻译阈值

    // Translation providers (will be lazy-loaded)
    this.providers = {}

    // LRU memory cache for hot translations
    const memCacheConfig = this.config.memoryCache || {}
    this.memoryCache = new SimpleLRUCache({
      max: memCacheConfig.maxItems || 500,
      maxSize: (memCacheConfig.maxSize || 5000) * 1024, // Convert KB to bytes
      ttl: memCacheConfig.ttl || 3600000, // 1 hour
      updateAgeOnGet: true
    })

    // Cache statistics
    this.cacheStats = {
      memoryHits: 0,
      redisHits: 0,
      misses: 0,
      total: 0
    }

    logger.info('TranslationService initialized', {
      enabled: this.enabled,
      provider: this.provider,
      fallbackProvider: this.fallbackProvider,
      cacheTTL: this.cacheTTL,
      batchThreshold: this.batchThreshold,
      memoryCache: {
        maxItems: memCacheConfig.maxItems || 500,
        maxSize: `${memCacheConfig.maxSize || 5000}KB`,
        ttl: `${(memCacheConfig.ttl || 3600000) / 1000}s`
      }
    })
  }

  /**
   * Lazy load translation provider
   * @param {string} providerName - Provider name ('claude', 'gemini', etc.)
   * @returns {Object|null} - Provider instance or null
   */
  async getProvider(providerName) {
    if (this.providers[providerName]) {
      return this.providers[providerName]
    }

    try {
      if (providerName === 'claude') {
        const ClaudeTranslationProvider = require('./providers/claudeTranslationProvider')
        this.providers.claude = new ClaudeTranslationProvider()
        return this.providers.claude
      } else if (providerName === 'gemini') {
        const GeminiTranslationProvider = require('./providers/geminiTranslationProvider')
        this.providers.gemini = new GeminiTranslationProvider()
        return this.providers.gemini
      }

      logger.warn(`Translation provider not supported: ${providerName}`)
      return null
    } catch (error) {
      logger.error(`Failed to load translation provider: ${providerName}`, { error })
      return null
    }
  }

  /**
   * Generate cache key for translation
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @returns {string} - Cache key
   */
  getCacheKey(text, sourceLang, targetLang) {
    const hash = crypto.createHash('md5').update(text).digest('hex')
    return `translation:${sourceLang}:${targetLang}:${hash}`
  }

  /**
   * Get cached translation
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} - Cached translation or null
   */
  async getCache(cacheKey) {
    try {
      const cached = await datastore.get(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        logger.debug('Translation cache hit', { cacheKey })
        return data
      }
      return null
    } catch (error) {
      logger.error('Failed to get translation cache', { cacheKey, error })
      return null
    }
  }

  /**
   * Set translation cache
   * @param {string} cacheKey - Cache key
   * @param {Object} data - Translation data
   * @returns {Promise<void>}
   */
  async setCache(cacheKey, data) {
    try {
      await datastore.setex(cacheKey, this.cacheTTL, JSON.stringify(data))
      logger.debug('Translation cached', { cacheKey, ttl: this.cacheTTL })
    } catch (error) {
      logger.error('Failed to set translation cache', { cacheKey, error })
    }
  }

  /**
   * Translate text using specified provider
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @param {string} providerName - Provider to use
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Translated text
   */
  async translateWithProvider(text, sourceLang, targetLang, providerName, options = {}) {
    const provider = await this.getProvider(providerName)
    if (!provider) {
      throw new Error(`Provider ${providerName} not available`)
    }

    logger.info(`Translating with ${providerName}`, {
      textLength: text.length,
      sourceLang,
      targetLang
    })

    const startTime = Date.now()

    try {
      const translated = await Promise.race([
        provider.translate(text, sourceLang, targetLang, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Translation timeout')), this.timeout)
        )
      ])

      const duration = Date.now() - startTime
      logger.info(`Translation successful`, {
        provider: providerName,
        duration,
        originalLength: text.length,
        translatedLength: translated.length
      })

      return translated
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`Translation failed with ${providerName}`, {
        error: error.message,
        duration,
        textLength: text.length
      })
      throw error
    }
  }

  /**
   * Translate text (main entry point)
   * @param {string} text - Text to translate
   * @param {Object} options - Translation options
   * @returns {Promise<string>} - Translated text or original text if translation fails
   */
  async translate(text, options = {}) {
    // Check if translation is enabled
    if (!this.enabled) {
      logger.debug('Translation disabled, returning original text')
      return text
    }

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.debug('Empty or invalid text, returning as-is')
      return text
    }

    const sourceLang = options.sourceLang || this.config.sourceLang || 'auto'
    const targetLang = options.targetLang || this.config.targetLang || 'en'

    // Detect language if auto
    let detectedLang = sourceLang
    if (sourceLang === 'auto') {
      detectedLang = detectLanguage(text)
      logger.debug(`Language detected: ${detectedLang}`)
    }

    // Check if translation is needed
    if (detectedLang === targetLang) {
      logger.debug('Text already in target language, skipping translation')
      return text
    }

    // Generate cache key
    const cacheKey = this.getCacheKey(text, detectedLang, targetLang)
    this.cacheStats.total++

    const startTime = Date.now()

    // 1. Check memory cache (fastest)
    const memCached = this.memoryCache.get(cacheKey)
    if (memCached && memCached.translated) {
      this.cacheStats.memoryHits++
      logger.debug('Memory cache hit for translation')

      // Record stats for cache hit
      const latency = Date.now() - startTime
      await translationStatsService
        .recordTranslation({
          keyId: options.keyId,
          text,
          translated: memCached.translated,
          sourceLang: detectedLang,
          targetLang,
          provider: memCached.provider,
          latency,
          cost: 0,
          cached: true,
          cacheType: 'memory'
        })
        .catch((err) => logger.debug('Stats recording failed:', err.message))

      return memCached.translated
    }

    // 2. Check Redis cache
    const redisCached = await this.getCache(cacheKey)
    if (redisCached && redisCached.translated) {
      this.cacheStats.redisHits++
      // Write back to memory cache
      this.memoryCache.set(cacheKey, redisCached)
      logger.debug('Redis cache hit for translation')

      // Record stats for cache hit
      const latency = Date.now() - startTime
      await translationStatsService
        .recordTranslation({
          keyId: options.keyId,
          text,
          translated: redisCached.translated,
          sourceLang: detectedLang,
          targetLang,
          provider: redisCached.provider,
          latency,
          cost: 0,
          cached: true,
          cacheType: 'redis'
        })
        .catch((err) => logger.debug('Stats recording failed:', err.message))

      return redisCached.translated
    }

    // 3. Cache miss, perform translation
    this.cacheStats.misses++

    // Try translation with primary provider
    const primaryProvider = options.provider || this.provider
    try {
      const translated = await this.translateWithProvider(
        text,
        detectedLang,
        targetLang,
        primaryProvider,
        options
      )

      const latency = Date.now() - startTime

      // 4. Double-layer cache write
      const cacheData = {
        source: text,
        translated,
        provider: primaryProvider,
        timestamp: Date.now()
      }

      this.memoryCache.set(cacheKey, cacheData)
      await this.setCache(cacheKey, cacheData)

      // Record stats (async, non-blocking)
      translationStatsService
        .recordTranslation({
          keyId: options.keyId,
          text,
          translated,
          sourceLang: detectedLang,
          targetLang,
          provider: primaryProvider,
          latency,
          cost: 0, // Cost calculation can be added later
          cached: false,
          cacheType: null
        })
        .catch((err) => logger.debug('Stats recording failed:', err.message))

      return translated
    } catch (primaryError) {
      logger.warn(`Primary provider ${primaryProvider} failed, trying fallback`, {
        error: primaryError.message
      })

      // Try fallback provider if available
      if (this.fallbackProvider && this.fallbackProvider !== primaryProvider) {
        try {
          const translated = await this.translateWithProvider(
            text,
            detectedLang,
            targetLang,
            this.fallbackProvider,
            options
          )

          const latency = Date.now() - startTime

          // Cache the result
          const cacheData = {
            source: text,
            translated,
            provider: this.fallbackProvider,
            timestamp: Date.now()
          }

          this.memoryCache.set(cacheKey, cacheData)
          await this.setCache(cacheKey, cacheData)

          // Record stats (async, non-blocking)
          translationStatsService
            .recordTranslation({
              keyId: options.keyId,
              text,
              translated,
              sourceLang: detectedLang,
              targetLang,
              provider: this.fallbackProvider,
              latency,
              cost: 0,
              cached: false,
              cacheType: null
            })
            .catch((err) => logger.debug('Stats recording failed:', err.message))

          return translated
        } catch (fallbackError) {
          logger.error('Fallback provider also failed', {
            provider: this.fallbackProvider,
            error: fallbackError.message
          })

          // Record error stats
          const latency = Date.now() - startTime
          translationStatsService
            .recordTranslation({
              keyId: options.keyId,
              text,
              translated: text,
              sourceLang: detectedLang,
              targetLang,
              provider: this.fallbackProvider,
              latency,
              cost: 0,
              cached: false,
              cacheType: null,
              error: true,
              errorType: 'fallback_failed'
            })
            .catch((err) => logger.debug('Stats recording failed:', err.message))
        }
      }

      // If all providers failed, return original text
      logger.warn('Translation failed, returning original text', {
        textLength: text.length,
        sourceLang: detectedLang,
        targetLang
      })
      return text
    }
  }

  /**
   * Translate array of messages
   * @param {Array<Object>} messages - Array of message objects
   * @param {Object} options - Translation options
   * @returns {Promise<Array<Object>>} - Translated messages
   */
  async translateMessages(messages, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return messages
    }

    const translated = await Promise.all(
      messages.map(async (message) => {
        if (message.role !== 'user' || !message.content) {
          return message
        }

        // Handle string content
        if (typeof message.content === 'string') {
          const translatedContent = await this.translate(message.content, options)
          return {
            ...message,
            content: translatedContent
          }
        }

        // Handle array content (multimodal)
        if (Array.isArray(message.content)) {
          const translatedContent = await Promise.all(
            message.content.map(async (block) => {
              if ((block.type === 'text' || block.type === 'input_text') && block.text) {
                const translatedText = await this.translate(block.text, options)
                return {
                  ...block,
                  text: translatedText
                }
              }
              return block
            })
          )
          return {
            ...message,
            content: translatedContent
          }
        }

        return message
      })
    )

    return translated
  }

  /**
   * Check if translation is needed for text
   * @param {string} text - Text to check
   * @param {string} targetLang - Target language
   * @returns {boolean} - True if translation needed
   */
  shouldTranslate(text, targetLang = 'en') {
    if (!this.enabled || !text) {
      return false
    }
    return needsTranslation(text, targetLang)
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    const { memoryHits, redisHits, misses, total } = this.cacheStats
    const memStats = this.memoryCache.getStats()

    return {
      memoryHitRate: total > 0 ? `${((memoryHits / total) * 100).toFixed(2)}%` : '0%',
      redisHitRate: total > 0 ? `${((redisHits / total) * 100).toFixed(2)}%` : '0%',
      totalHitRate: total > 0 ? `${(((memoryHits + redisHits) / total) * 100).toFixed(2)}%` : '0%',
      memoryHits,
      redisHits,
      misses,
      total,
      memoryCacheSize: memStats.size,
      memoryCacheLoad: memStats.calculatedSize,
      memoryCacheUsage: memStats.usage
    }
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats() {
    this.cacheStats = {
      memoryHits: 0,
      redisHits: 0,
      misses: 0,
      total: 0
    }
    logger.info('Translation cache statistics reset')
  }

  /**
   * Clear memory cache
   */
  clearMemoryCache() {
    const stats = this.memoryCache.getStats()
    this.memoryCache.clear()
    logger.info('Translation memory cache cleared', stats)
  }

  /**
   * Prune expired entries from memory cache
   * @returns {number} - Number of pruned entries
   */
  pruneMemoryCache() {
    const prunedCount = this.memoryCache.prune()
    if (prunedCount > 0) {
      logger.info(`Pruned ${prunedCount} expired entries from translation memory cache`)
    }
    return prunedCount
  }

  /**
   * Initialize and start cache warming service (Phase 4)
   */
  startCacheWarming() {
    if (!this.enabled) {
      logger.debug('Translation service disabled, cache warming not started')
      return
    }

    const cacheWarmingConfig = this.config.cacheWarming || {}

    if (!cacheWarmingConfig.enabled) {
      logger.debug('Cache warming disabled in configuration')
      return
    }

    try {
      // Initialize cache warming service with configuration
      cacheWarmingService.initialize(cacheWarmingConfig)

      // Set reference to this translation service instance
      cacheWarmingService.setTranslationService(this)

      // Start periodic cache warming
      cacheWarmingService.start()

      logger.info('Cache warming service started successfully')
    } catch (error) {
      logger.error('Failed to start cache warming service:', error)
    }
  }

  /**
   * Stop cache warming service
   */
  stopCacheWarming() {
    try {
      cacheWarmingService.stop()
      logger.info('Cache warming service stopped')
    } catch (error) {
      logger.error('Failed to stop cache warming service:', error)
    }
  }

  /**
   * Get cache warming status
   * @returns {Object} - Cache warming status
   */
  getCacheWarmingStatus() {
    return cacheWarmingService.getStatus()
  }

  /**
   * Get cache warming statistics
   * @returns {Promise<Array>} - Cache warming statistics
   */
  async getCacheWarmingStats() {
    return await cacheWarmingService.getWarmingStats()
  }
}

// Create singleton instance
const translationService = new TranslationService()

module.exports = translationService
