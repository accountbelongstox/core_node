const express = require('express');
const { getConfigAction, setConfigAction, deleteConfigAction } = require('./actions/config_actions');
const { renderIndex } = require('./actions/index');
const { addSubscribeUrl, createNewGroup, groupDataRequest, updateSubscribeUrl, deleteSubscribeUrl } = require('./actions/group');
const { serveSubscription } = require('./actions/subscribe');
const { checkForUpdate, performUpdateAndRestart } = require('../update/actions/update_actions');
const { handlePuppeteerInfo, getSystemInfo, handlePuppeteerAction } = require('./actions/puppeteer');
const { getClashTemplate, updateClashTemplate } = require('./actions/clash_template_actions');
const { exportData, importData } = require('./actions/data_actions.js');
const path = require('path');
const { exportsDir } = require('../provider/global_var');
const Log = require('../utils/log_utils');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getProxyNode } = require('./actions/proxynode');

function setupRoutes(app) {
    app.get('/sub', async (req, res) => {
        const group = req.query.group || 'default';
        const template = req.query.template || 'default';
        const [success, message, statusCode, data] = await serveSubscription(group,template);
        res.status(statusCode).type('text/plain').send(data);
    });

    app.get('/', async (req, res) => {
        const group = req.query.group || 'default';
        const currentUrl = `${req.protocol}://${req.get('host')}/`;
        const [success, message, statusCode, data] = await renderIndex(group, currentUrl);
        res.status(statusCode).type('text/html').send(data);
    });

    app.get('/puppeteer_info', async (req, res) => {
        const [success, message, statusCode, data] = await handlePuppeteerInfo(req.headers);
        res.status(statusCode).json({ success, message, data });
    });

    app.get('/system_info', async (req, res) => {
        const [success, message, statusCode, data] = await getSystemInfo();
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/submit_url', async (req, res) => {
        const [success, message, statusCode, data] = await addSubscribeUrl(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/new_group', async (req, res) => {
        const [success, message, statusCode, data] = createNewGroup(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/get_groups', async (req, res) => {
        const [success, message, statusCode, data] = groupDataRequest(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/update_url', async (req, res) => {
        const [success, message, statusCode, data] = await updateSubscribeUrl(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/check_for_updates', async (req, res) => {
        const [success, message, statusCode, data] = await checkForUpdate(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/update_and_restart', async (req, res) => {
        const [success, message, statusCode, data] = await performUpdateAndRestart(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/puppeteer_action/:action', async (req, res) => {
        const action = req.params.action;
        const [success, message, statusCode, data] = await handlePuppeteerAction(action);
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/delete_url', async (req, res) => {
        const [success, message, statusCode, data] = await deleteSubscribeUrl(req.body);
        res.status(statusCode).json({ success, message, data });
    });

    app.get('/config', async (req, res) => {
        const [success, message, statusCode, data] = await getConfigAction();
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/config', express.json(), async (req, res) => {
        const { key, value } = req.body;
        const [success, message, statusCode, data] = await setConfigAction(key, value);
        res.status(statusCode).json({ success, message, data });
    });

    app.delete('/config/:key', async (req, res) => {
        const { key } = req.params;
        const [success, message, statusCode, data] = await deleteConfigAction(key);
        res.status(statusCode).json({ success, message, data });
    });

    app.get('/api/health', (req, res) => {
        res.status(200).json({
            status: 'OK',
            message: 'Server is running normally',
            timestamp: new Date().toISOString()
        });
    });

    app.get('/clash_template', async (req, res) => {
        const [success, message, statusCode, data] = await getClashTemplate();
        res.status(statusCode).json({ success, message, data });
    });

    app.post('/clash_template', express.json(), async (req, res) => {
        const content = req.body.content;
        if (!content || content.trim() === '') {
            res.status(400).json({ success: false, message: 'Template content cannot be empty' });
            return;
        }
        const [success, message, statusCode, data] = await updateClashTemplate({ content });
        res.status(statusCode).json({ success, message, data });
    });

    app.get('/export_data', async (req, res) => {
        const [success, message, statusCode, data] = await exportData();
        console.log(data)
        Log.log(`Export data: ${success}, ${message}, ${statusCode}, ${data}`);
        if (success) {
            const fullPath = path.join(exportsDir, data);
            res.status(statusCode).download(fullPath, 'clash_subscribe_data.zip');
        } else {
            res.status(statusCode).json({ success, message });
        }
    });

    app.get('/download/:filename', (req, res) => {
        const filename = req.params.filename;
        const filePath = path.join(exportsDir, filename);
        res.download(filePath, filename);
    });

    app.post('/import_data', upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file received' });
        }
        const [success, message, statusCode, data] = await importData(req.file.buffer);
        res.status(statusCode).json({ success, message, data });
    });

    app.get('/api/proxy-node-info', async (req, res) => {
        try {
            const [success, message, statusCode, data] = await getProxyNode(req);
            res.status(statusCode).json({ success, message, data });
        } catch (error) {
            console.error('Error in /api/proxy-node-info:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
}

module.exports = setupRoutes;
