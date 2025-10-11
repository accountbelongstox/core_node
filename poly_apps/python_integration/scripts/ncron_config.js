// ncron configuration for Python service integration
// This file defines the scheduling rules and integration points

// Import utility functions from ncore
const { scheduleTask, executePythonScript } = require("#@ncore/foundation/utilities/index.js");

// Define Python integration task
scheduleTask("python-service", () => {
  executePythonScript("D:\\programing\\core_node\\python_integration\\script.py");
});

// Add any additional integration logic here
// Ensure all tasks use the ncron scheduler and follow ncore's API conventions