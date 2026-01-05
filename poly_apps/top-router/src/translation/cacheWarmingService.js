// Placeholder cache warming service for translation.
// 当前仅提供接口以满足调用方，实际预热逻辑后续按需补充。

class CacheWarmingService {
  constructor() {
    this.translationService = null
    this.config = {}
    this.running = false
  }

  initialize(config = {}) {
    this.config = config
  }

  setTranslationService(service) {
    this.translationService = service
  }

  start() {
    this.running = true
  }

  stop() {
    this.running = false
  }

  getStatus() {
    return {
      running: this.running,
      config: this.config
    }
  }

  async getWarmingStats() {
    return {
      warmedItems: 0,
      lastRunAt: null
    }
  }
}

module.exports = new CacheWarmingService()
