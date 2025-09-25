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

function renderErrorPage(title = "Error", message = "An error occurred.") {
    return `
        <html>
        <body>
            <h1>${title}</h1>
            <p>${message}</p>
            <button onclick="window.history.back()">Go Back</button>
        </body>
        </html>
    `;
}

function respondWithJson(success, message = "Operation completed successfully", data = null) {
    const response = {
        success: success,
        message: message,
        data: data || {}
    };
    return JSON.stringify(response);
}

function standardResponse(success = true, message = "", data = null, statusCode = 200) {
    return [success, message, statusCode, data];
}

module.exports = {
    renderErrorPage,
    respondWithJson,
    standardResponse,
};