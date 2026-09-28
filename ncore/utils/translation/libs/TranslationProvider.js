const logger = require('#@logger');

class TranslationProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  async translate(translationOption) {
    logger.error('translate method must be implemented by the provider');
    return {
      success: false,
      platform: this.name,
      error: {
        message: 'translate method must be implemented by the provider',
      },
    };
  }
}

module.exports = TranslationProvider;
