import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import fetch from 'node-fetch';

// --- Configuration ---
const PORT = process.env.ANALYZER_PORT || 9880;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.MODEL_NAME || 'gemma3n:e2b';
// ✅ Webhook URL is now managed dynamically, with an optional initial value.
let WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_PLATFORM = process.env.WEBHOOK_PLATFORM || 'discord';
const LANGUAGE = process.env.LANGUAGE || 'English';
const BATCH_INTERVAL_MS = 15000;
// ✅ BEST PRACTICE: Define a character limit for the log data in the prompt.
const MAX_PROMPT_LOG_CHARS = 8000;

// --- State for Batching ---
// ✅ The buffer now stores structured, parsed log objects.
let logBuffer = [];
// ✅ Add a new state variable to hold the last generated prompt for debugging.
let lastPrompt = 'No prompt has been generated yet.';

// --- Core Logic ---
async function processLogBuffer() {
    if (logBuffer.length === 0) {
        return;
    }

    const logsToProcess = [...logBuffer];
    logBuffer = [];

    console.log(`Processing batch of ${logsToProcess.length} log entries.`);

    try {
        const summary = await summarize(logsToProcess);

        // ✅ BEST PRACTICE: Trim whitespace and check for a non-empty string.
        // This prevents sending alerts for summaries that only contain spaces.
        if (summary && summary.trim()) {
            console.log("Summary is valid. Sending webhook...");
            // ✅ Broadcast summary to the web UI via WebSocket
            io.emit('new-summary', summary);
            await sendWebhook(`🤖 AI Log Analysis (${LANGUAGE}):\n${summary}`);
        } else {
            console.log("AI returned an empty or whitespace summary. Skipping webhook.");
        }
    } catch (e) {
        console.error('Analyzer error', e);
    }
}

// --- Express Server Setup ---
const app = express();
app.use(express.json({ limit: '64mb' }));
// ✅ Create an HTTP server to attach both Express and Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// ✅ BEST PRACTICE: Log WebSocket connection events for visibility.
io.on('connection', (socket) => {
    console.log(`A new client connected to the WebSocket. ID: ${socket.id}`);
    socket.on('disconnect', () => console.log(`Client disconnected. ID: ${socket.id}`));
});

app.post('/logs', (req, res) => {
    // Fluent Bit can send a single object or an array of objects.
    const newEntries = Array.isArray(req.body) ? req.body : [req.body];

    for (const entry of newEntries) {
        // 'entry' is the already-parsed log from Fluent Bit.
        // We just need to extract the fields we care about.
        // ✅ BEST PRACTICE: Trust the upstream filter (Fluent Bit).
        // Removing the redundant filter here simplifies the code and makes the pipeline
        // more efficient and easier to debug.
        logBuffer.push({
            message: entry.log || '',
            container: entry.container_name || 'unknown',
            time: entry.time || new Date().toISOString(),
            stream: entry.stream || 'stdout'
        });
    }
    res.status(200).send('OK');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', bufferSize: logBuffer.length });
});

// ✅ New endpoint for the UI to set the webhook URL dynamically.
app.post('/set-webhook', (req, res) => {
    const { url } = req.body;
    if (typeof url === 'string') {
        WEBHOOK_URL = url;
        console.log(`Webhook URL updated to: ${url}`);
        res.status(200).send('Webhook URL updated.');
    } else {
        res.status(400).send('Invalid URL provided.');
    }
});

// ✅ New endpoint for debugging the prompt sent to Ollama.
app.get('/last-prompt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(lastPrompt);
});

server.listen(PORT, () => {
    console.log(`Log analyzer service listening on http://localhost:${PORT}`);
    // ✨ BEST PRACTICE: Add a check for the webhook URL on startup.
    if (!WEBHOOK_URL) console.warn('⚠️ WARNING: WEBHOOK_URL is not set. Discord/Slack notifications will be disabled until set via the UI.');

    // The WebSocket server is now running on the same port as the Express app.
    setInterval(processLogBuffer, BATCH_INTERVAL_MS);
    console.log(`Will process log batches every ${BATCH_INTERVAL_MS / 1000} seconds.`);
});

// --- Helper Functions ---

function diskReport() {
    try {
        // ✅ BEST PRACTICE: Make disk reporting environment-aware.
        // Use /host if it exists (in Docker), otherwise use / (for native installs).
        const dfPath = fs.existsSync('/host') ? '/host' : '/';
        return execSync(`df -h ${dfPath}`).toString();
    } catch {
        return 'df command failed';
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

// function detectContainer(message) {
//     if (message.includes('nginx') || message.includes('PM2') || message.includes('App listening')) return 'app';
//     if (message.includes('ollama') || message.includes('GIN') || message.includes('llama')) return 'ollama';
//     if (message.includes('fluent-bit') || message.includes('fluentbit')) return 'fluent-bit';
//     return 'system';
// }

// ✅ Accepts an array of parsed log objects.
function structureLogs(parsedLogs) {
    const logsByContainer = {};
    const logsBySeverity = { CRITICAL: [], ERROR: [], WARNING: [], INFO: [], DEBUG: [], UNKNOWN: [] };

    parsedLogs.forEach(parsed => {
        const severity = categorizeLogLevel(parsed.message);
        // ✅ Use the reliable container name from the log metadata.
        const container = parsed.container || 'unknown';

        if (!logsByContainer[container]) {
            logsByContainer[container] = [];
        }
        logsByContainer[container].push({ ...parsed, severity });
        logsBySeverity[severity].push({ ...parsed, container });
    });

    return { logsByContainer, logsBySeverity };
}

// ✅ Accepts an array of parsed log objects.
// ... (other functions are correct)

// ✅ Accepts an array of parsed log objects.
async function summarize(parsedLogs) {
    if (!parsedLogs || parsedLogs.length === 0) {
        return null;
    }

    const { logsByContainer, logsBySeverity } = structureLogs(parsedLogs);

    // ✅ RESTORED: This logic was missing. It builds the log data string for the prompt.
    let structuredLogs = "=== LOG ANALYSIS BY SEVERITY ===\n";
    ['CRITICAL', 'ERROR', 'WARNING'].forEach(severity => { // Only include relevant severities
        if (logsBySeverity[severity] && logsBySeverity[severity].length > 0) {
            structuredLogs += `\n${severity} (${logsBySeverity[severity].length} entries):\n`;
            logsBySeverity[severity].forEach(log => {
                structuredLogs += `  [${log.container}] ${log.message.substring(0, 120)}...\n`;
            });
        }
    });

    structuredLogs += "\n=== LOG ANALYSIS BY APPLICATION ===\n";
    Object.keys(logsByContainer).forEach(container => {
        structuredLogs += `\n${container.toUpperCase()} (${logsByContainer[container].length} entries):\n`;
        logsByContainer[container].forEach(log => {
            structuredLogs += `  [${log.severity}] ${log.message.substring(0, 120)}...\n`;
        });
    });
    // --- End of restored logic ---

    // ✅ FIX: Truncate the log data to a safe length to prevent oversized prompts
    // that can crash the Ollama runner.
    if (structuredLogs.length > MAX_PROMPT_LOG_CHARS) {
        structuredLogs = structuredLogs.substring(0, MAX_PROMPT_LOG_CHARS) + "\n\n... (logs truncated due to length)";
    }

    const prompt = `You are a DevOps assistant. Analyze these structured logs and provide a clear, actionable summary.

INSTRUCTIONS:
1. Start with "🚨 CRITICAL ISSUES" if any critical/error logs exist.
2. Then "⚠️ WARNINGS" for warning-level issues.
3. Then "📊 SUMMARY BY APPLICATION".
4. End with "🔧 RECOMMENDED ACTIONS" - specific, actionable fixes.
5. Keep each section concise and focused.
6. Prioritize by business impact.
7. IMPORTANT: Respond in ${LANGUAGE}. All text, explanations, and recommendations must be in ${LANGUAGE}.

STRUCTURED LOG DATA:
${structuredLogs}

SYSTEM RESOURCES:
${diskReport()}
Free memory: ${Math.round(os.freemem() / 1024 / 1024)}MB

Provide a structured analysis following the format above in ${LANGUAGE}:`;

    lastPrompt = prompt; // ✅ Store the generated prompt for debugging.

    console.log("Attempting to call Ollama for summary...");

    try {
        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL, prompt, stream: false })
        });

        console.log(`Ollama response status: ${res.status} ${res.statusText}`);

        if (!res.ok) {
            const errorBody = await res.text();
            console.error("Ollama returned an error response:", errorBody);
            return null;
        }

        const json = await res.json();
        // Remove the verbose debugging log now that we know the cause
        // console.log("Full Ollama JSON response:", JSON.stringify(json, null, 2));
        return json.response;

    } catch (error) {
        console.error("Failed to fetch from Ollama service:", error);
        return null;
    }
}

function formatWebhookPayload(message, platform) {
    const truncatedMessage = message.slice(0, 3900);

    switch (platform.toLowerCase()) {
        case 'discord':
            return { content: truncatedMessage.slice(0, 1900) };
        case 'slack':
            return { text: truncatedMessage, mrkdwn: true, username: "Robolog", icon_emoji: ":robot_face:" };
        case 'teams':
            return { "@type": "MessageCard", "@context": "http://schema.org/extensions", "themeColor": "0076D7", "summary": "Robolog Alert", "sections": [{ "activityTitle": "🤖 Robolog Alert", "activitySubtitle": `AI Log Analysis (${LANGUAGE})`, "text": truncatedMessage, "markdown": true }] };
        case 'telegram':
            return { text: truncatedMessage, parse_mode: "Markdown", disable_web_page_preview: true };
        case 'mattermost':
            return { text: truncatedMessage, username: "Robolog", icon_emoji: ":robot_face:" };
        case 'rocketchat':
            return { text: truncatedMessage, username: "Robolog", emoji: ":robot_face:" };
        default:
            return { message: truncatedMessage, platform: "robolog", timestamp: new Date().toISOString(), language: LANGUAGE, source: "ai-log-analysis" };
    }
}

async function sendWebhook(message) {
    if (!WEBHOOK_URL) return;
    try {
        const payload = formatWebhookPayload(message, WEBHOOK_PLATFORM);
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            console.error(`Webhook failed: ${response.status} ${response.statusText}`);
            const errorBody = await response.text();
            console.error(`Error details: ${errorBody}`);
        }
    } catch (error) {
        console.error('Webhook error:', error);
    }
}
