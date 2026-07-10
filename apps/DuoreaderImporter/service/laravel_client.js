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

'use strict';

const http = require('http');
const https = require('https');
const logger = require('#@logger');

const INGEST_PATH = '/api/app_qy_v1/media/ingest';
const ENRICH_PATH = '/api/app_qy_v1/media/enrich';

class LaravelIngestClient {
    constructor(config) {
        this.baseUrl = (config.laravelBaseUrl || 'http://127.0.0.1:9000').replace(/\/+$/, '');
        this.chunkSize = Number(config.bookChunkSize) || 80;
        this.enableTtsEnrich = config.enableTtsEnrich !== false;
        this.ttsEnrichBatchSize = Number(config.ttsEnrichBatchSize) || 100;
        this.ttsEnrichRounds = Number(config.ttsEnrichRounds) || 20;
    }

    async ingestBookStreaming(source, chapters, slots) {
        const sourceKey = source.source_key;
        const chunks = Math.max(1, Math.ceil(slots.length / this.chunkSize));
        const errors = [];

        for (let i = 0; i < chunks; i += 1) {
            const slice = slots.slice(i * this.chunkSize, (i + 1) * this.chunkSize);
            const body = {
                source_type: 'book',
                model_version: 3,
                source: i === 0 ? source : { source_key: sourceKey },
                chapters: i === 0 ? chapters : [],
                slots: slice,
            };
            const result = await this._postJson(INGEST_PATH, body);
            if (!result.ok) {
                errors.push(`chunk ${i + 1}/${chunks}: ${result.detail}`);
            } else {
                logger.info(`[DuoreaderImporter] Ingest chunk ${i + 1}/${chunks} (${slice.length} slots)`);
            }
        }

        return {
            ok: errors.length === 0,
            errors,
            chunks,
        };
    }

    async enrichAudio(language) {
        if (!this.enableTtsEnrich) {
            return { ok: true, skipped: true, rounds: 0 };
        }

        const rounds = [];
        for (let i = 0; i < this.ttsEnrichRounds; i += 1) {
            const body = {
                limit: this.ttsEnrichBatchSize,
            };
            if (language) {
                body.language = language;
            }
            const result = await this._postJson(ENRICH_PATH, body);
            rounds.push(result);
            const enriched = result.data?.enriched || result.data?.processed || 0;
            logger.info(`[DuoreaderImporter] TTS enrich round ${i + 1}: ${JSON.stringify(result.data || result.detail)}`);
            if (!result.ok) {
                return { ok: false, rounds, detail: result.detail };
            }
            if (!enriched) {
                break;
            }
        }
        return { ok: true, rounds };
    }

    async _postJson(pathName, body) {
        const payload = JSON.stringify(body);
        const url = new URL(this.baseUrl + pathName);
        const client = url.protocol === 'https:' ? https : http;
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                Accept: 'application/json',
            },
            timeout: 300000,
        };

        return new Promise((resolve) => {
            const req = client.request(options, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let parsed = null;
                    try {
                        parsed = JSON.parse(text);
                    } catch (error) {
                        resolve({
                            ok: false,
                            status: res.statusCode,
                            detail: `Invalid JSON (${res.statusCode}): ${text.slice(0, 300)}`,
                        });
                        return;
                    }
                    const success = res.statusCode >= 200 && res.statusCode < 300;
                    resolve({
                        ok: success,
                        status: res.statusCode,
                        data: parsed.data || parsed,
                        detail: parsed.message || parsed.error || text.slice(0, 300),
                    });
                });
            });
            req.on('timeout', () => {
                req.destroy();
                resolve({ ok: false, detail: `Timeout POST ${pathName}` });
            });
            req.on('error', (error) => {
                resolve({ ok: false, detail: error.message });
            });
            req.write(payload);
            req.end();
        });
    }
}

module.exports = LaravelIngestClient;
