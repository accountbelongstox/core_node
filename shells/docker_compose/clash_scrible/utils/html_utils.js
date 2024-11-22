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