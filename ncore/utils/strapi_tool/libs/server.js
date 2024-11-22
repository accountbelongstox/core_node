import path from 'path';
import strapi from '@strapi/strapi';

// Set the directory paths
const appDir = path.join(__dirname, '.ncore', 'plugin', 'strapi_v4');
const distDir = path.join(appDir, '');

// Initialize Strapi with the specified configurations
const app = strapi({
    appDir,
    distDir,
    autoReload: true,
    serveAdminPanel: true
});

// Start the Strapi application
app.start();
