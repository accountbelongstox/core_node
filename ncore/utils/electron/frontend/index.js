// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * Frontend Management Module
 *
 * Exports frontend management components for Electron applications.
 * Ported from pycore/pyutils/native_ui/step9_frontend
 *
 * Usage:
 *   const { FrontendConfig, FrontendManager, startFrontendIfNeeded } = require('./frontend');
 */

const { FrontendConfig } = require('./config');
const { FrontendManager, startFrontendIfNeeded } = require('./manager');

module.exports = {
    FrontendConfig,
    FrontendManager,
    startFrontendIfNeeded
};
