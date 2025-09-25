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

// Python versions configuration
const PYTHON_VERSIONS = [
    {
        version: '3.9.13',
        win64: {
            url: 'https://www.python.org/ftp/python/3.9.13/python-3.9.13-amd64.exe'
        }
    },
    // {
    //     version: '3.11.8',
    //     win64: {
    //         url: 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe'
    //     }
    // },
    // {
    //     version: '3.12.2',
    //     win64: {
    //         url: 'https://www.python.org/ftp/python/3.12.2/python-3.12.2-amd64.exe'
    //     }
    // },
    {
        version: '3.13.0a5',  // Latest alpha version as of now
        win64: {
            url: 'https://www.python.org/ftp/python/3.13.0/python-3.13.0a5-amd64.exe'
        }
    }
];

// Export configurations
module.exports = {
    PYTHON_VERSIONS
};
