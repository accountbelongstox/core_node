const { AppError } = require('../../errors/errors.js');
    const config = require('../../../config/index.js');

    class LoginRequest {
        constructor(data) {
            this.email = data.email;
            this.password = data.password;
            this.validate();
        }

        validate() {
            if (!this.email) {
                throw new AppError('email is required', 'VALIDATION_FAILED');
            }
            if (!this.password) {
                throw new AppError('password is required', 'VALIDATION_FAILED');
            }
        }
    }

    class CreateHostRequest {
        constructor(data) {
            this.domains = data.domains;
            this.matcher = data.matcher;
            this.upstreams = data.upstreams || [];
            this.validate();
        }

        validate() {
            if (!this.domains) {
                throw new AppError('domains are required', 'VALIDATION_FAILED');
            }
            if (!Array.isArray(this.upstreams)) {
                throw new AppError('upstreams must be an array', 'VALIDATION_FAILED');
            }
        }
    }

    class CreateUserRequest {
        constructor(data) {
            this.name = data.name;
            this.email = data.email;
            this.password = data.password;
            this.validate();
        }

        validate() {
            if (!this.name) {
                throw new AppError('name is required', 'VALIDATION_FAILED');
            }
            if (!this.email) {
                throw new AppError('email is required', 'VALIDATION_FAILED');
            }
            if (!this.password) {
                throw new AppError('password is required', 'VALIDATION_FAILED');
            }
        }
    }

    module.exports = {
        LoginRequest,
        CreateHostRequest,
        CreateUserRequest
    };