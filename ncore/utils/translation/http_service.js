// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const express = require('express');
const logger = require('#@logger');
const translationService = require('./libs/translation_service');
const { loadConfig } = require('./config/config_loader');

let app, server, config;

app = null;
server = null;
config = null;

function validateRequestBody(body) {
  const requiredFields = ['text', 'targetLanguage'];

  for (const field of requiredFields) {
    if (typeof body[field] === 'undefined') {
      return { isValid: false, error: `body missing required field: ${field}` };
    }
  }

  return { isValid: true };
}

async function handleTranslate(req, res) {
  let result, validationResult, providerName;

  validationResult = validateRequestBody(req.body);

  if (!validationResult.isValid) {
    res.status(400).json({ message: validationResult.error });
    return;
  }

  providerName = req.body.provider || config.defaultProvider;
  result = await translationService.translate(req.body, providerName);

  res.status(200).json(result);
}

function startHttpService(port) {
  if (server) {
    logger.warn('Translation HTTP service already running');
    return server;
  }

  config = loadConfig();
  port = port || config.PORT || 36315;

  app = express();
  app.use(express.json());

  app.post('/translate', async (req, res) => {
    try {
      await handleTranslate(req, res);
    } catch (error) {
      logger.error('Translation HTTP service error:', error.message);
      res.status(500).json({
        success: false,
        error: {
          message: error.message,
        },
      });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ message: 'error url, only /translate is provided' });
  });

  server = app.listen(port, () => {
    logger.info('Translation HTTP service is running at http://localhost:' + port);
  });

  return server;
}

function stopHttpService() {
  if (server) {
    server.close(() => {
      logger.info('Translation HTTP service stopped');
    });
    server = null;
    app = null;
  }
}

module.exports = {
  startHttpService,
  stopHttpService,
};
