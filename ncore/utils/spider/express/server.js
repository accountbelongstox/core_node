const express = require('express');
const Spider = require('../main.js');
const multer = require('multer');
const upload = multer();

class Server {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.spider = new Spider();
        this.setupMiddleware();
        this.routes = new Map();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(upload.any());
        this.app.use((req, res, next) => {
            req.body = {
                ...req.body,
                ...req.query,
                ...req.files
            };
            next();
        });
    }

    addRoute(path, ...middlewares) {
        if (!this.routes.has(path)) {
            this.routes.set(path, []);
        }
        this.routes.get(path).push(...middlewares);

        this.app.post(path, async (req, res) => {
            try {
                let result = req.body;
                for (const middleware of this.routes.get(path)) {
                    result = await middleware(result, this.spider);
                }
                res.json(result);
            } catch (error) {
                console.error('Error in route:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Server is running on port ${this.port}`);
        });
    }
}

module.exports = Server;