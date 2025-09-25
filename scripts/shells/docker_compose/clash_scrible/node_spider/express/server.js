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

const express = require('express');
const Spider = require('../climber/main.js');
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