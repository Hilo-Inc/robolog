import express from 'express';
import http from 'http';
import { createHash } from 'crypto';
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
// ✨ NEW: Define a maximum number of logs to process in a single batch.
// This prevents overwhelming the AI model and creates smaller, faster analysis jobs.
const BATCH_SIZE = 5;

// --- State Management ---
// ✅ The buffer now stores structured, parsed log objects.
let logBuffer = [];
// ✅ Add new state variables for debugging and report history.
let lastPrompt = 'No prompt has been generated yet.';
let reportHistory = []; // ✨ NEW: Store a history of generated reports.
const MAX_REPORTS = 50; // ✨ NEW: Limit the number of stored reports.

// ✅ ENHANCEMENT: Add state and configuration for log deduplication.
// This prevents "flapping" errors from repeatedly triggering analysis.
const deduplicationCache = new Map();
const DEDUPLICATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates a consistent hash for a log message, ignoring volatile parts like timestamps and numbers.
 * This allows us to group similar, recurring errors.
 * @param {string} message The raw log message.
 * @returns {string} A MD5 hash representing the log's signature.
 */
function generateLogHash(message) {
    const normalized = message
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/ig, '[TIMESTAMP]') // ISO8601
        .replace(/\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/ig, '[GUID]') // GUIDs
        .replace(/\d+/g, '[NUM]'); // All other numbers

    return createHash('md5').update(normalized).digest('hex');
}

// --- Core Logic ---
async function processLogBuffer() {
    // ✅ BEST PRACTICE: First, prune old entries from the deduplication cache.
    const now = Date.now();
    deduplicationCache.forEach((entry, hash) => {
        if (now - entry.lastSeen > DEDUPLICATION_WINDOW_MS) {
            deduplicationCache.delete(hash);
        }
    });

    if (logBuffer.length === 0) return;

    // ✅ FIX: Process a smaller, fixed-size batch instead of the whole buffer.
    // This prevents long-running Ollama requests from blocking subsequent logs.
    const logsToProcess = logBuffer.splice(0, BATCH_SIZE);

    console.log(`Processing batch of ${logsToProcess.length} log entries. ${logBuffer.length} logs remaining in buffer.`);

    try {
        const summary = await summarize(logsToProcess);

        // ✅ BEST PRACTICE: Trim whitespace and check for a non-empty string.
        // This prevents sending alerts for summaries that only contain spaces.
        if (summary && summary.trim()) {
            console.log("Summary is valid. Sending webhook...");

            // ✅ As requested: Prepend the raw logs to the webhook and UI message.
            // This provides the raw data first for evidence, followed by the AI's interpretation.
            let fullMessage = "📄 **Raw Logs in this Batch:**\n```\n";
            for (const log of logsToProcess) {
                // ✅ ENHANCEMENT: Add repetition count for flapping errors.
                const hash = generateLogHash(log.message);
                const count = deduplicationCache.get(hash)?.count || 1;
                const repeatInfo = count > 1 ? ` (Repeated x${count} times)` : '';

                // Format for readability: [TIME] [CONTAINER] MESSAGE
                const time = new Date(log.time).toLocaleTimeString('en-US', { hour12: false });
                // Clean up the log message to avoid breaking markdown code blocks
                const cleanMessage = String(log.message).replace(/```/g, '` ` `');
                fullMessage += `[${time}] [${log.container}] ${cleanMessage.trim()}${repeatInfo}\n`;
            }
            fullMessage += "```\n\n"; // End of raw log block
            fullMessage += `🤖 **AI Log Analysis (${LANGUAGE})**:\n${summary}`; // ✅ FIX: Colon is now outside the markdown bold for correct parsing.

            io.emit('new-summary', fullMessage); // Broadcast full message to UI
            await sendWebhook(fullMessage);      // Send full message to webhook

            // ✨ NEW: Add the new report to the history.
            reportHistory.unshift(fullMessage);
            if (reportHistory.length > MAX_REPORTS) {
                reportHistory.pop(); // Remove the oldest report to cap memory usage.
            }
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

// ✨ NEW: Endpoint to get detailed status and configuration for debugging.
app.get('/status', (req, res) => {
    try {
        const statusReport = {
            status: 'ok',
            uptime: `${process.uptime().toFixed(2)} seconds`,
            memoryUsage: process.memoryUsage(),
            configuration: {
                ollamaUrl: OLLAMA_URL,
                model: MODEL,
                language: LANGUAGE,
                webhookPlatform: WEBHOOK_PLATFORM,
                // For security, we only report if the webhook is set, not its value.
                webhookSet: !!WEBHOOK_URL,
                batchIntervalMs: BATCH_INTERVAL_MS,
                batchSize: BATCH_SIZE,
                deduplicationWindowMs: DEDUPLICATION_WINDOW_MS,
            },
            state: {
                logBufferLength: logBuffer.length,
                reportHistoryLength: reportHistory.length,
                deduplicationCacheSize: deduplicationCache.size,
            },
            system: {
                freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
                diskReport: diskReport(),
            }
        };
        res.status(200).json(statusReport);
    } catch (error) {
        console.error("Error generating status report:", error);
        res.status(500).json({ status: 'error', message: 'Failed to generate status report.' });
    }
});

app.post('/logs', (req, res) => {
    // Fluent Bit can send a single object or an array of objects.
    const newEntries = Array.isArray(req.body) ? req.body : [req.body];

    const acceptedSeverities = new Set(['CRITICAL', 'ERROR', 'WARNING']);

    for (const entry of newEntries) {
        const message = entry.log || '';
        const severity = categorizeLogLevel(message);

        // ✅ BEST PRACTICE: Add a secondary "defense-in-depth" filter.
        // Even though Fluent Bit should only send filtered logs, this ensures
        // we only process logs that are genuinely important, preventing the
        // AI model from being overwhelmed.
        if (acceptedSeverities.has(severity)) {
            const hash = generateLogHash(message);

            if (deduplicationCache.has(hash)) {
                // It's a repeat error. Just increment the count and update the timestamp.
                const cacheEntry = deduplicationCache.get(hash);
                cacheEntry.count++;
                cacheEntry.lastSeen = Date.now();
            } else {
                // It's a new, unique error. Add it to the cache and the processing buffer.
                const newLog = {
                    message: message,
                    container: entry.container_name || 'unknown',
                    time: entry.time || new Date().toISOString(),
                    stream: entry.stream || 'stdout'
                };
                deduplicationCache.set(hash, { count: 1, lastSeen: Date.now(), log: newLog });
                logBuffer.push(newLog);
            }
        }
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

// ✨ NEW: Endpoint to get the history of reports for the dashboard.
app.get('/reports', (req, res) => {
    res.status(200).json(reportHistory);
});

// ✨ NEW: Endpoint to ask for more details on a report.
app.post('/ask-details', async (req, res) => {
    const { report, question } = req.body;
    if (!report || !question) {
        return res.status(400).send('Missing "report" or "question" in request body.');
    }

    const prompt = `You are a DevOps assistant. The user has a follow-up question about a previous log analysis you performed.
Provide a clear, helpful, and concise answer to their question based on the original analysis.

Respond in ${LANGUAGE}.

---
ORIGINAL LOG ANALYSIS:
${report}
---
USER'S QUESTION:
${question}
---

Your detailed explanation:`;

    // This uses the main summarize function but with a different prompt.
    // A dedicated function could also be made, but this is efficient.
    const details = await summarizeWithPrompt(prompt);
    res.status(200).json({ details });
});



server.listen(PORT, () => {
    console.log(`Log analyzer service listening on http://localhost:${PORT}`);
    // ✨ BEST PRACTICE: Add a check for the webhook URL on startup.
    if (!WEBHOOK_URL) console.warn('⚠️ WARNING: WEBHOOK_URL is not set. Discord/Slack notifications will be disabled until set via the UI.');

    // ✅ FIX: Use a self-scheduling timeout instead of setInterval.
    // This robustly queues processing, ensuring that one analysis completes
    // before the next one is scheduled, preventing resource contention on Ollama.
    const runProcessingLoop = () => {
        processLogBuffer()
            .catch(err => console.error("Error in processing loop:", err))
            .finally(() => {
                setTimeout(runProcessingLoop, BATCH_INTERVAL_MS);
            });
    };
    runProcessingLoop(); // Start the loop
    console.log(`Will check for new log batches to process every ${BATCH_INTERVAL_MS / 1000} seconds.`);
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

async function createSummaryPrompt(parsedLogs) {
    const { logsByContainer, logsBySeverity } = structureLogs(parsedLogs);

    // ✅ RESTORED: This logic was missing. It builds the log data string for the prompt.
    let structuredLogs = "=== LOG ANALYSIS BY SEVERITY ===\n";
    ['CRITICAL', 'ERROR', 'WARNING'].forEach(severity => { // Only include relevant severities
        if (logsBySeverity[severity] && logsBySeverity[severity].length > 0) {
            structuredLogs += `\n${severity} (${logsBySeverity[severity].length} entries):\n`;
            logsBySeverity[severity].forEach(log => {
                // ✅ ENHANCEMENT: Add repetition count to the prompt for better AI context.
                const hash = generateLogHash(log.message);
                const count = deduplicationCache.get(hash)?.count || 1;
                const repeatInfo = count > 1 ? `(Repeated x${count}) ` : '';

                structuredLogs += `  ${repeatInfo}[${log.container}] ${log.message.substring(0, 120)}...\n`;
            });
        }
    });

    structuredLogs += "\n=== LOG ANALYSIS BY APPLICATION ===\n";
    Object.keys(logsByContainer).forEach(container => {
        const logs = logsByContainer[container];
        structuredLogs += `\n${container.toUpperCase()} (${logs.length} entries):\n`;
        logs.forEach(log => {
            // ✅ ENHANCEMENT: Add repetition count to the prompt for better AI context.
            const hash = generateLogHash(log.message);
            const count = deduplicationCache.get(hash)?.count || 1;
            const repeatInfo = count > 1 ? `(Repeated x${count}) ` : '';

            structuredLogs += `  ${repeatInfo}[${log.severity}] ${log.message.substring(0, 120)}...\n`;
        });
    });
    // --- End of restored logic ---

    // ✅ FIX: Truncate the log data to a safe length to prevent oversized prompts
    // that can crash the Ollama runner.
    if (structuredLogs.length > MAX_PROMPT_LOG_CHARS) {
        structuredLogs = structuredLogs.substring(0, MAX_PROMPT_LOG_CHARS) + "\n\n... (logs truncated due to length)";
    }

    const prompt = `You are a DevOps assistant. Analyze these structured logs and provide a clear, actionable summary.

RUN THESE INSTRUCTIONS FOR EACH ISSUE:
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

    return prompt;
}

// ✅ Accepts an array of parsed log objects.
async function summarize(parsedLogs) {
    if (!parsedLogs || parsedLogs.length === 0) {
        return null;
    }
    const prompt = await createSummaryPrompt(parsedLogs);
    return summarizeWithPrompt(prompt);
}

async function summarizeWithPrompt(prompt) {
    lastPrompt = prompt;

    // ✅ FIX: Removed verbose logging of the full prompt. This was being captured
    // by Fluent Bit and fed back into the analyzer, causing a cyclical feedback loop.
    // The `/last-prompt` endpoint can be used for debugging instead.
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
