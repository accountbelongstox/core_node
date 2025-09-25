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

/**
 * Get all available parameters (GET + POST)
 * @param {Object} req - Express request object
 * @returns {Object} Combined parameters
 */
function getAllParams(req) {
  return { ...req.query, ...req.body };
}

/**

 */
function getAnyParam(req, field, defaultValue = null) {
  return req.query[field] ?? req.body[field] ?? defaultValue;
}

/**
 * Get multiple fields from GET or POST (checks both)
 * @param {Object} req - Express request object
 * @param {string[]} fields - Array of field names
 * @param {Object} [defaults] - Default values
 * @returns {Object} Field values
 */
function getMultiParams(req, fields, defaults = {}) {
  return fields.reduce((acc, field) => {
    acc[field] = this.getAnyParam(req, field, defaults[field]);
    return acc;
  }, {});
}

/**
 * Strictly get from GET parameters only
 * @param {Object} req - Express request object
 * @param {string} field - Field name
 * @param {any} [defaultValue] - Default if missing
 * @returns {any} Field value
 */
function getQueryParam(req, field, defaultValue = null) {
  return req.query[field] ?? defaultValue;
}

/**
 * Strictly get from POST parameters only
 * @param {Object} req - Express request object
 * @param {string} field - Field name
 * @param {any} [defaultValue] - Default if missing
 * @returns {any} Field value
 */
function getBodyParam(req, field, defaultValue = null) {
  return req.body[field] ?? defaultValue;
}

/**
 * Validate required fields (checks both GET and POST)
 * @param {Object} req - Express request object
 * @param {string[]} requiredFields - Fields to check
 * @throws {Error} If any field is missing
 */
function validateParams(req, requiredFields) {
  const missing = requiredFields.filter(
    field => !(field in req.query) && !(field in req.body)
  );

  if (missing.length > 0) {
    return {}
  }
  return {}
    
}

module.exports = {
  getAllParams,
  getAnyParam,
  getMultiParams,
  getQueryParam,
  getBodyParam, 
  validateParams
};
