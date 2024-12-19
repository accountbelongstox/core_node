const config = require('../../config/index.js');

    const jwtOptions = {
        algorithm: config.jwt.algorithm,
        expiresIn: config.jwt.expiresIn
    };