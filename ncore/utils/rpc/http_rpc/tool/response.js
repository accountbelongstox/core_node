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
