function processResponse(data, defaultSuccess = true, defaultMessage = "Operation successful") { 
    const defaultResponse = { 
        success: defaultSuccess, 
        code: 200, 
        message: defaultMessage, 
        timestamp: new Date().toISOString() 
    }; 

    if (typeof data === 'object' && data !== null) { 
        if (!data.hasOwnProperty('success')) { 
            data.success = defaultResponse.success; 
        }
        if (!data.hasOwnProperty('message')) { 
            data.message = defaultResponse.message; 
        }

        return { 
            ...defaultResponse, 
            ...data  
        }; 
    } 

    if (typeof data === 'string') { 
        data = tryParseJson(data);
        return { 
            ...defaultResponse, 
            data: data 
        }; 
    } 

    return { 
        success: false, 
        code: 500, 
        data, 
        message: "Invalid data type provided", 
        timestamp: new Date().toISOString() 
    }; 
} 

function tryParseJson(data) { 
    if (typeof data === 'object' && data !== null) { 
        return data; 
    } 

    if (typeof data === 'string') { 
        try { 
            return JSON.parse(data); 
        } catch (error) { 
            return data; 
        } 
    } 

    return data; 
} 

module.exports = { processResponse, tryParseJson };
