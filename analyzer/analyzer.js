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
const LANGUAGE = process.env.LANGUAGE || 'English';

const FILTER = /(ERROR|CRIT|WARN)/i;   // <- adjustable regex filter
const POLL_MS = 10_000;                // every 10 seconds

let fileSize = 0;

function readNewLines() {
    const stats = fs.statSync(LOG_PATH);
    if (stats.size <= fileSize) return '';
    
    // Safety check: limit buffer size to prevent memory issues
    const maxBufferSize = 100 * 1024 * 1024; // 100MB max
    let readSize = stats.size - fileSize;
    
    if (readSize > maxBufferSize) {
        console.error(`Log file too large (${readSize} bytes), reading only last ${maxBufferSize} bytes`);
        // Read only the last part of the new data
        fileSize = stats.size - maxBufferSize;
        readSize = maxBufferSize;
    }
    
    const fd = fs.openSync(LOG_PATH, 'r');
    const buf = Buffer.alloc(readSize);
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

function parseLogEntry(logLine) {
    try {
        const parsed = JSON.parse(logLine);
        const innerLog = JSON.parse(parsed.log);
        return {
            message: innerLog.log || '',
            stream: innerLog.stream || 'unknown',
            time: innerLog.time || '',
            container: 'unknown' // We'll try to detect this from the message
        };
    } catch (e) {
        return {
            message: logLine,
            stream: 'unknown',
            time: '',
            container: 'unknown'
        };
    }
}

function categorizeLogLevel(message) {
    const msg = message.toUpperCase();
    if (msg.includes('CRIT') || msg.includes('CRITICAL') || msg.includes('FATAL')) return 'CRITICAL';
    if (msg.includes('ERROR') || msg.includes('ERR')) return 'ERROR';
    if (msg.includes('WARN') || msg.includes('WARNING')) return 'WARNING';
    if (msg.includes('INFO')) return 'INFO';
    if (msg.includes('DEBUG')) return 'DEBUG';
    return 'UNKNOWN';
}

function detectContainer(message) {
    if (message.includes('nginx') || message.includes('PM2') || message.includes('App listening')) return 'app';
    if (message.includes('ollama') || message.includes('GIN') || message.includes('llama')) return 'ollama';
    if (message.includes('fluent-bit') || message.includes('fluentbit')) return 'fluent-bit';
    return 'system';
}

function structureLogs(lines) {
    const logsByContainer = {};
    const logsBySeverity = { CRITICAL: [], ERROR: [], WARNING: [], INFO: [], DEBUG: [], UNKNOWN: [] };
    
    lines.split('\n').forEach(line => {
        if (!line.trim()) return;
        
        const parsed = parseLogEntry(line);
        const severity = categorizeLogLevel(parsed.message);
        const container = detectContainer(parsed.message);
        
        // Group by container
        if (!logsByContainer[container]) {
            logsByContainer[container] = [];
        }
        logsByContainer[container].push({ ...parsed, severity });
        
        // Group by severity
        logsBySeverity[severity].push({ ...parsed, container });
    });
    
    return { logsByContainer, logsBySeverity };
}

async function summarize(lines) {
    const { logsByContainer, logsBySeverity } = structureLogs(lines);
    
    // Build structured summary
    let structuredLogs = "=== LOG ANALYSIS BY SEVERITY ===\n";
    
    ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].forEach(severity => {
        if (logsBySeverity[severity].length > 0) {
            structuredLogs += `\n${severity} (${logsBySeverity[severity].length} entries):\n`;
            logsBySeverity[severity].forEach(log => {
                structuredLogs += `  [${log.container}] ${log.message.substring(0, 100)}...\n`;
            });
        }
    });
    
    structuredLogs += "\n=== LOG ANALYSIS BY APPLICATION ===\n";
    Object.keys(logsByContainer).forEach(container => {
        structuredLogs += `\n${container.toUpperCase()} (${logsByContainer[container].length} entries):\n`;
        logsByContainer[container].forEach(log => {
            structuredLogs += `  [${log.severity}] ${log.message.substring(0, 100)}...\n`;
        });
    });

    const prompt = `You are a DevOps assistant. Analyze these structured logs and provide a clear, actionable summary.

INSTRUCTIONS:
1. Start with "🚨 CRITICAL ISSUES" if any critical/error logs exist
2. Then "⚠️ WARNINGS" for warning-level issues  
3. Then "📊 SUMMARY BY APPLICATION" 
4. End with "🔧 RECOMMENDED ACTIONS" - specific, actionable fixes
5. Keep each section concise and focused
6. Prioritize by business impact
7. IMPORTANT: Respond in ${LANGUAGE}. All text, explanations, and recommendations must be in ${LANGUAGE}.

STRUCTURED LOG DATA:
${structuredLogs}

SYSTEM RESOURCES:
${diskReport()}
Free memory: ${Math.round(os.freemem() / 1024 / 1024)}MB

Provide a structured analysis following the format above in ${LANGUAGE}:`;

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
    // Try to parse as JSON first (in case fluent-bit outputs JSON)
    try {
        let obj = JSON.parse(rawLog);
        while (typeof obj.log === 'string') {
            obj = JSON.parse(obj.log);
        }
        // After unwrapping, pick the field with the actual message
        return obj.log || '';
    } catch (e) {
        // If JSON parsing fails, treat as plain text
        // Skip empty lines and return the raw log line
        return rawLog.trim() || '';
    }
}

(async function loop() {
    while (true) {
        // Polling (reduced logging to avoid feedback loops)

        const rawContent = readNewLines();
        const lines = rawContent.split('\n');
        const messages = lines.map(extractLogMessages).filter(Boolean).filter(l => FILTER.test(l));
        const newLines = messages.join('\n');

        if (newLines) {
            try {
                const summary = await summarize(newLines);
                await postToDiscord(`🤖 AI Log Analysis (${LANGUAGE}):\n${summary}`);
            } catch (e) {
                console.error('Analyzer error', e);
            }
        }
        await new Promise(r => setTimeout(r, POLL_MS));
    }
})();
