import express from 'express';
import path from 'path';
import logger from './logger.js';

export class StaticServer {
    #app = null;
    #staticPaths = new Map(); // Map<prefix, path>

    constructor(expressApp) {
        this.#app = expressApp;
    }

    /**
     * Add static paths to server
     * @param {string|string[]|Object|Object[]} paths - Path or paths to serve
     * @param {string} [basePrefix='/'] - Base URL prefix for all paths
     * @returns {boolean} Success status
     */
    addStatic(paths, basePrefix = '/') {
        if (!Array.isArray(paths)) {
            paths = [paths];
        }
        try {
            // Normalize paths to array of objects
            const normalizedPaths = this.#normalizePaths(paths, basePrefix);
            
            // Add each path to express
            normalizedPaths.forEach(({ path: staticPath, prefix }) => {
                if (this.#staticPaths.has(prefix)) {
                    logger.warning(`Static path with prefix "${prefix}" already exists, skipping`);
                    return;
                }

                // Ensure prefix starts with / and doesn't end with /
                const normalizedPrefix = this.#normalizePrefix(prefix);
                
                // Add to express
                this.#app.use(normalizedPrefix, express.static(staticPath));
                this.#staticPaths.set(normalizedPrefix, staticPath);
                
                logger.info(`Added static path: ${staticPath} at ${normalizedPrefix}`);
            });

            return true;
        } catch (error) {
            logger.error('Failed to add static paths:', error);
            return false;
        }
    }

    /**
     * Remove static path by prefix
     * @param {string} prefix 
     * @returns {boolean}
     */
    removeStatic(prefix) {
        const normalizedPrefix = this.#normalizePrefix(prefix);
        if (this.#staticPaths.has(normalizedPrefix)) {
            this.#staticPaths.delete(normalizedPrefix);
            // Note: Express doesn't provide a direct way to remove middleware
            // We would need to recreate the app to truly remove it
            logger.info(`Removed static path at ${normalizedPrefix}`);
            return true;
        }
        return false;
    }

    /**
     * Get all registered static paths
     * @returns {Object[]} Array of {prefix, path} objects
     */
    getStaticPaths() {
        return Array.from(this.#staticPaths.entries()).map(([prefix, path]) => ({
            prefix,
            path
        }));
    }

    #normalizePaths(paths, basePrefix) {
        if (!Array.isArray(paths)) {
            paths = [paths];
        }

        return paths.map(item => {
            if (typeof item === 'string') {
                return {
                    path: path.resolve(item),
                    prefix: basePrefix
                };
            }
            if (typeof item === 'object') {
                return {
                    path: path.resolve(item.path),
                    prefix: item.prefix || basePrefix
                };
            }
            throw new Error('Invalid path format');
        });
    }

    #normalizePrefix(prefix) {
        prefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
        prefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
        return prefix || '/';
    }
} 