import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import router from './router.js';
import logger from '../logger/logger.js';
import config from '../../config/index.js';

export class Server {
    #app;
    #port;
    #host;

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

export const server = new Server(); 