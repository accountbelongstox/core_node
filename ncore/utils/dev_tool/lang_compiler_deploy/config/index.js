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
