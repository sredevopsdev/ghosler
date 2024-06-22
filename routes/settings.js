import fs from 'fs';
import path from 'path';
import express from 'express';
import Ghost from '../utils/api/ghost.js';
import Files from '../utils/data/files.js';
import ProjectConfigs from '../utils/data/configs.js';

const router = express.Router();

router.get('/', async (_, res) => {
    const configs = await ProjectConfigs.all();
    res.render('dashboard/settings', { configs: configs });
});

router.get('/template', async (_, res) => {
    const customTemplateExists = await Files.customTemplateExists();
    res.render('dashboard/upload-template', { customTemplateExists });
});

router.get('/template/download/:type', async (req, res) => {
    const downloadType = req.params.type ?? 'base'; // default is base.

    let newsletterFilePath = path.join(process.cwd(), '/views/newsletter.ejs');
    if (downloadType === 'custom_template')
        newsletterFilePath = Files.customTemplatePath();

    const newsletterFile = fs.readFileSync(newsletterFilePath);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=newsletter.ejs');
    res.send(newsletterFile);
});

router.post('/template', async (req, res) => {
    const customTemplateFile = req.files['custom_template.file'];
    const { level, message } =
        await ProjectConfigs.updateCustomTemplate(customTemplateFile);
    const customTemplateExists = await Files.customTemplateExists();
    res.render('dashboard/upload-template', {
        level,
        message,
        customTemplateExists,
    });
});

router.post('/', async (req, res) => {
    const formData = req.body;

    let fullUrl = new URL(
        `${req.protocol}://${req.get('Host')}${req.originalUrl}`,
    );
    if (req.get('Referer')) {
        fullUrl = new URL(req.get('Referer'));
    }
    fullUrl.pathname = fullUrl.pathname.split('/settings')[0];
    fullUrl.search = ''; // drops any query parameters
    fullUrl.pathname = fullUrl.pathname.replace(/\/+/g, '/'); // combine repeated forward slashes in path
    let normalizedUrl = fullUrl.href.replace(/\/$/, '').toString(); // drop a trailing slash
    formData['ghosler.url'] = normalizedUrl;

    const result = await ProjectConfigs.update(formData);
    const configs = await ProjectConfigs.all();

    let { level, message } = result;

    if (configs.ghost.url && configs.ghost.key) {
        const ghost = new Ghost();
        const tagResponse = await ghost.registerIgnoreTag();
        const webhookResponse = await ghost.registerWebhook();

        if (tagResponse.level === 'error') {
            level = tagResponse.level;
            message = tagResponse.message;
        } else if (webhookResponse.level === 'error') {
            level = webhookResponse.level;
            message = webhookResponse.message;
        }
    }

    res.render('dashboard/settings', { level, message, configs });
});

export default router;
