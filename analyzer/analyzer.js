import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import fetch from 'node-fetch';

const LOG_PATH = '/logs/all.log';
const ensureLogFile = () => {
    try {
        if (!fs.existsSync(LOG_PATH)) {
            fs.mkdirSync('/logs', { recursive: true });
            fs.writeFileSync(LOG_PATH, '');
        }
    } catch {}
};
ensureLogFile();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.MODEL_NAME || 'gemma3n:e2b';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const FILTER = /(ERROR|CRIT|WARN)/i;   // <- adjustable regex filter
const POLL_MS = 10_000;                // every 60 s

let fileSize = 0;

function readNewLines() {
    const stats = fs.statSync(LOG_PATH);
    if (stats.size <= fileSize) return '';
    const fd = fs.openSync(LOG_PATH, 'r');
    const buf = Buffer.alloc(stats.size - fileSize);
    fs.readSync(fd, buf, 0, buf.length, fileSize);
    fs.closeSync(fd);
    fileSize = stats.size;
    return buf.toString();
}

function diskReport() {
    try {
        return execSync('df -h').toString();
    } catch {
        return 'df command failed';
    }
}

async function summarize(lines) {
    const prompt = `You are a DevOps assistant. Summarise critical issues in these logs. Suggest actionable fixes.\n\nLOGS:\n${lines}\n\nDisk/Memory report:\n${diskReport()}\nFree memory (bytes): ${os.freemem()}`;

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            prompt,
            stream: false
        })
    });
    const json = await res.json();
    return json.response;
}

async function postToDiscord(msg) {
    if (!DISCORD_WEBHOOK_URL) return;
    await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg.slice(0, 1900) }) // Discord limit safeguard
    });
}

function extractLogMessages(rawLog) {
    // Each log line is a JSON string, possibly deeply nested
    try {
        let obj = JSON.parse(rawLog);
        while (typeof obj.log === 'string') {
            obj = JSON.parse(obj.log);
        }
        // After unwrapping, pick the field with the actual message
        return obj.log || '';
    } catch (e) {
        return '';
    }
}

(async function loop() {
    while (true) {
        console.log(`[${new Date().toISOString()}] Analyzer polling...`);

        const lines = readNewLines().split('\n');
        const messages = lines.map(extractLogMessages).filter(Boolean).filter(l => FILTER.test(l));
        const newLines = messages.join('\n');

        console.log('newLines:', newLines);

        if (newLines) {
            try {
                const summary = await summarize(newLines);
                await postToDiscord(`⚠️ Gemma summary:\n${summary}`);
            } catch (e) {
                console.error('Analyzer error', e);
            }
        }
        await new Promise(r => setTimeout(r, POLL_MS));
    }
})();
