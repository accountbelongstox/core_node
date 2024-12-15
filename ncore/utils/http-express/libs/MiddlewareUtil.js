import cors from 'cors';
import bodyParser from 'body-parser';
import compression from 'compression';
import helmet from 'helmet';
import { ResponseUtil } from './ResponseUtil.js';
import express from 'express';
import rateLimit from 'express-rate-limit';

class MiddlewareUtil {
    static getCommonMiddlewares(config) {
        const middlewares = [];

        // CORS middleware
        if (config.CORS_ENABLED) {
            middlewares.push(cors({
                origin: config.CORS_ORIGIN,
                methods: config.CORS_METHODS,
                allowedHeaders: config.CORS_ALLOWED_HEADERS,
                credentials: config.CORS_CREDENTIALS
            }));
        }

        // Body parser middlewares
        if (config.BODY_PARSER_JSON_ENABLED) {
            middlewares.push(bodyParser.json({
                limit: config.BODY_PARSER_JSON_LIMIT
            }));
        }

        if (config.BODY_PARSER_URLENCODED_ENABLED) {
            middlewares.push(bodyParser.urlencoded({
                extended: config.BODY_PARSER_URLENCODED_EXTENDED,
                limit: config.BODY_PARSER_URLENCODED_LIMIT
            }));
        }

        // Compression middleware
        if (config.COMPRESSION_ENABLED) {
            middlewares.push(compression({
                level: config.COMPRESSION_LEVEL,
                threshold: config.COMPRESSION_THRESHOLD
            }));
        }

        // Security middlewares
        if (config.SECURITY_HELMET_ENABLED) {
            middlewares.push(helmet({
                contentSecurityPolicy: config.SECURITY_CSP_ENABLED,
                crossOriginEmbedderPolicy: config.SECURITY_CROSS_ORIGIN_ENABLED
            }));
        }

        // Rate limiting
        if (config.SECURITY_RATE_LIMIT_ENABLED) {
            const limiter = rateLimit({
                windowMs: config.SECURITY_RATE_LIMIT_WINDOW,
                max: config.SECURITY_RATE_LIMIT_MAX,
                handler: (req, res) => {
                    res.status(429).json(
                        ResponseUtil.error('Too many requests', 429)
                    );
                }
            });
            middlewares.push(limiter);
        }

        // Static files middleware
        if (config.STATIC_ENABLED && config.STATIC_PATH) {
            middlewares.push(express.static(config.STATIC_PATH, {
                maxAge: config.STATIC_MAX_AGE,
                etag: config.STATIC_ETAG
            }));
        }

        return middlewares;
    }

    static errorHandler(err, req, res, next) {
        console.error(err.stack);
        const response = ResponseUtil.error(
            err.message || 'Internal Server Error',
            err.status || 500,
            process.env.NODE_ENV === 'development' ? err.stack : undefined
        );
        res.status(response.code).json(response);
    }

    static notFoundHandler(req, res, next) {
        const response = ResponseUtil.notFound(`Path ${req.path} not found`);
        res.status(response.code).json(response);
    }

    static asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    static validateRequest(schema) {
        return (req, res, next) => {
            try {
                const { error } = schema.validate(req.body);
                if (error) {
                    const response = ResponseUtil.validationError(error.details[0].message);
                    return res.status(response.code).json(response);
                }
                next();
            } catch (err) {
                next(err);
            }
        };
    }
}

export default MiddlewareUtil; 