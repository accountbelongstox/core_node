const express = require('express');
    const cors = require('cors');
    const helmet = require('helmet');
    const router = require('./router.js');
    const logger = require('../logger/logger.js');
    const config = require('../../config/index.js');

    class Server {
        constructor() {
            this.#app = express();
            this.#port = config.server.port;
            this.#host = config.server.host;
            this.#setupMiddleware();
            this.#setupRoutes();
        }

        #setupMiddleware() {
            this.#app.use(helmet());
            this.#app.use(cors());
            this.#app.use(express.json());
            this.#app.use(express.urlencoded({ extended: true }));

            this.#app.use((req, res, next) => {
                logger.debug(`${req.method} ${req.url}`);
                next();
            });
        }

        #setupRoutes() {
            this.#app.use('/', router);
        }

        start() {
            return new Promise((resolve) => {
                this.#app.listen(this.#port, this.#host, () => {
                    logger.info(`Server running at http://${this.#host}:${this.#port}`);
                    resolve();
                });
            });
        }
    }

    const server = new Server();
    module.exports = { server };