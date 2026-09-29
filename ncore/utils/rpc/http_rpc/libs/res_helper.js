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
