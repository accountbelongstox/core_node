// Proxy module for database tools
// This module provides backward compatibility for the old db_tool path
// while redirecting to the new foundation/db_utils location

module.exports = require('#@/ncore/utils/memory_db/index.js');
