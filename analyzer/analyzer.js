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

// ✅ BEST PRACTICE: Queue-based processing with throttling
class AnalysisQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.processingCount = 0;
        this.ollamaInUse = false;
        this.ollamaRequestCount = 0;
        this.maxQueueSize = 50;
        this.processInterval = 2000; // Minimum 2 seconds between analyses
        this.lastProcessTime = 0;
        this.retryAttempts = new Map(); // Track retry attempts per batch hash
        this.maxRetries = 3;
        this.backoffMultiplier = 1000; // Start with 1 second backoff
    }

    // Add logs to queue with priority and deduplication
    enqueue(logs, priority = 'normal') {
        const batchHash = this.hashBatch(logs);
        
        // Check for duplicate batches already in queue
        const existingIndex = this.queue.findIndex(item => item.hash === batchHash);
        if (existingIndex !== -1) {
            console.log(`Batch ${batchHash} already queued, updating priority if higher`);
            if (this.getPriorityValue(priority) > this.getPriorityValue(this.queue[existingIndex].priority)) {
                this.queue[existingIndex].priority = priority;
                this.sortQueue();
            }
            return batchHash;
        }

        // Check queue size limit
        if (this.queue.length >= this.maxQueueSize) {
            // Remove lowest priority items to make room
            this.queue.sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));
            const removed = this.queue.shift();
            console.log(`Queue full, removed batch ${removed.hash} (priority: ${removed.priority})`);
        }

        // Add new batch to queue
        const queueItem = {
            id: Date.now() + Math.random(),
            hash: batchHash,
            logs: logs,
            priority: priority,
            timestamp: Date.now(),
            retries: 0
        };

        this.queue.push(queueItem);
        this.sortQueue();
        
        // Only log high-priority or large queues to reduce noise
        if (priority === 'urgent' || this.queue.length > 10) {
            console.log(`Queued batch ${batchHash} (priority: ${priority}, queue size: ${this.queue.length})`);
        }
        
        // Start processing if not already running
        this.startProcessing();
        
        return batchHash;
    }

    // Hash function for batch deduplication
    hashBatch(logs) {
        const content = logs.map(log => `${log.message}:${log.container}`).join('|');
        return createHash('md5').update(content).digest('hex').substring(0, 8);
    }

    // Priority values for sorting (higher = more urgent)
    getPriorityValue(priority) {
        const values = { 'low': 1, 'normal': 2, 'high': 3, 'urgent': 4 };
        return values[priority] || 2;
    }

    // Sort queue by priority (highest first) then by timestamp (oldest first)
    sortQueue() {
        this.queue.sort((a, b) => {
            const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
            return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
        });
    }

    // Start the processing loop
    async startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLastProcess = now - this.lastProcessTime;
            
            // Throttling: ensure minimum interval between processing
            if (timeSinceLastProcess < this.processInterval) {
                const waitTime = this.processInterval - timeSinceLastProcess;
                // Only log throttling for longer waits to reduce noise
                if (waitTime > 5000) {
                    console.log(`Throttling: waiting ${waitTime}ms before next analysis`);
                }
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            const item = this.queue.shift();
            await this.processItem(item);
            this.lastProcessTime = Date.now();
        }
        
        this.isProcessing = false;
        console.log('Queue processing completed');
    }

    // Process individual queue item with retry logic
    async processItem(item) {
        this.processingCount++;
        const currentInstance = this.processingCount;
        
        try {
            // Reduce logging noise - only log retries and critical issues
            if (item.retries > 0 || item.priority === 'urgent') {
                console.log(`Processing instance ${currentInstance}: Starting batch ${item.hash} (priority: ${item.priority}, attempt: ${item.retries + 1})`);
            }
            
            const success = await this.executeAnalysis(item.logs, currentInstance);
            
            if (success) {
                console.log(`Processing instance ${currentInstance}: Completed batch ${item.hash} successfully`);
                this.retryAttempts.delete(item.hash);
            } else {
                await this.handleFailure(item, currentInstance);
            }
            
        } catch (error) {
            console.error(`Processing instance ${currentInstance}: Unexpected error for batch ${item.hash}:`, error);
            await this.handleFailure(item, currentInstance);
        }
    }

    // Handle processing failures with exponential backoff
    async handleFailure(item, instance) {
        item.retries++;
        this.retryAttempts.set(item.hash, item.retries);
        
        if (item.retries < this.maxRetries) {
            const backoffTime = this.backoffMultiplier * Math.pow(2, item.retries - 1);
            console.log(`Processing instance ${instance}: Batch ${item.hash} failed, retrying in ${backoffTime}ms (attempt ${item.retries + 1}/${this.maxRetries})`);
            
            // Re-queue with delay
            setTimeout(() => {
                item.timestamp = Date.now(); // Update timestamp for fair ordering
                this.queue.push(item);
                this.sortQueue();
            }, backoffTime);
        } else {
            console.error(`Processing instance ${instance}: Batch ${item.hash} failed permanently after ${this.maxRetries} attempts`);
            this.retryAttempts.delete(item.hash);
        }
    }

    // Execute the actual analysis (wrapper around existing logic)
    async executeAnalysis(logs, instance) {
        // Check if Ollama is available
        if (this.ollamaInUse) {
            console.log(`Processing instance ${instance}: Ollama busy, analysis failed`);
            return false;
        }

        try {
            this.ollamaInUse = true;
            this.ollamaRequestCount++;

            // Use existing analysis logic
            const summary = await summarize(logs);
            
            if (summary && summary.trim()) {
                // Format and send the message (using existing logic)
                let fullMessage = "📄 **Raw Logs in this Batch:**\n```\n";
                for (const log of logs) {
                    const hash = generateLogHash(log.message);
                    const count = deduplicationCache.get(hash)?.count || 1;
                    const repeatInfo = count > 1 ? ` (Repeated x${count} times)` : '';
                    const time = new Date(log.time).toLocaleTimeString('en-US', { hour12: false });
                    const cleanMessage = String(log.message).replace(/```/g, '` ` `');
                    fullMessage += `[${time}] [${log.container}] ${cleanMessage.trim()}${repeatInfo}\n`;
                }
                fullMessage += "```\n\n";
                fullMessage += `🤖 **AI Log Analysis (${LANGUAGE})**:\n${summary}`;

                io.emit('new-summary', fullMessage);
                await sendWebhook(fullMessage);

                reportHistory.unshift(fullMessage);
                if (reportHistory.length > MAX_REPORTS) {
                    reportHistory.pop();
                }
                
                return true;
            } else {
                console.log(`Processing instance ${instance}: AI returned empty summary`);
                return false;
            }
            
        } finally {
            this.ollamaInUse = false;
        }
    }

    // Get queue status for monitoring
    getStatus() {
        return {
            queueSize: this.queue.length,
            isProcessing: this.isProcessing,
            processingCount: this.processingCount,
            ollamaInUse: this.ollamaInUse,
            ollamaRequestCount: this.ollamaRequestCount,
            maxQueueSize: this.maxQueueSize,
            processInterval: this.processInterval,
            retryAttempts: Object.fromEntries(this.retryAttempts),
            queueItems: this.queue.map(item => ({
                hash: item.hash,
                priority: item.priority,
                retries: item.retries,
                age: Date.now() - item.timestamp
            }))
        };
    }

    // Clear the queue (emergency use)
    clear() {
        this.queue = [];
        this.retryAttempts.clear();
        console.log('Queue cleared');
    }
}

// Initialize the analysis queue
const analysisQueue = new AnalysisQueue();

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

    // ✅ BEST PRACTICE: Process logs through the queue system
    const logsToProcess = logBuffer.splice(0, BATCH_SIZE);
    
    // Determine priority based on log severity
    const hasCritical = logsToProcess.some(log => categorizeLogLevel(log.message) === 'CRITICAL');
    const hasError = logsToProcess.some(log => categorizeLogLevel(log.message) === 'ERROR');
    
    let priority = 'normal';
    if (hasCritical) priority = 'urgent';
    else if (hasError) priority = 'high';
    
    console.log(`Adding batch of ${logsToProcess.length} logs to queue (priority: ${priority}). ${logBuffer.length} logs remaining in buffer.`);
    
    // Add to queue for processing
    analysisQueue.enqueue(logsToProcess, priority);
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
                model: global.MODEL || MODEL,
                language: LANGUAGE,
                webhookPlatform: WEBHOOK_PLATFORM,
                // For security, we only report if the webhook is set, not its value.
                webhookSet: !!WEBHOOK_URL,
                batchIntervalMs: BATCH_INTERVAL_MS,
                batchSize: BATCH_SIZE,
                deduplicationWindowMs: DEDUPLICATION_WINDOW_MS,
                platformLimits: PLATFORM_LIMITS,
                currentPlatformLimit: PLATFORM_LIMITS[WEBHOOK_PLATFORM?.toLowerCase()] || PLATFORM_LIMITS.generic,
                // ✨ NEW: Include current Ollama configuration
                temperature: global.TEMPERATURE || 0.2,
                top_p: global.TOP_P || 0.8,
                top_k: global.TOP_K || 20,
                repeat_penalty: global.REPEAT_PENALTY || 1.1,
                num_predict: global.NUM_PREDICT || 500,
                keep_alive: global.KEEP_ALIVE !== undefined ? global.KEEP_ALIVE : "10m",
                streaming: global.STREAMING !== undefined ? global.STREAMING : false,
                stop: global.STOP_TOKENS || ["---", "###"]
            },
            state: {
                logBufferLength: logBuffer.length,
                reportHistoryLength: reportHistory.length,
                deduplicationCacheSize: deduplicationCache.size,
                analysisQueue: analysisQueue.getStatus(),
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

// In C:/dev/robolog/analyzer/analyzer.js

app.post('/logs', (req, res) => {
    // Fluent Bit can send a single object or an array of objects.
    const newEntries = Array.isArray(req.body) ? req.body : [req.body];

    const acceptedSeverities = new Set(['CRITICAL', 'ERROR', 'WARNING']);

    // ✨ NEW: Collect the logs that are actually added to the buffer in this request.
    const addedLogsForNotification = [];

    for (const entry of newEntries) {
        const message = entry.log || '';
        const severity = categorizeLogLevel(message);

        if (acceptedSeverities.has(severity)) {
            const hash = generateLogHash(message);

            if (deduplicationCache.has(hash)) {
                const cacheEntry = deduplicationCache.get(hash);
                cacheEntry.count++;
                cacheEntry.lastSeen = Date.now();
            } else {
                const newLog = {
                    message: message,
                    container: entry.container_name || 'unknown',
                    time: entry.time || new Date().toISOString(),
                    stream: entry.stream || 'stdout'
                };
                deduplicationCache.set(hash, { count: 1, lastSeen: Date.now(), log: newLog });
                logBuffer.push(newLog);

                // ✨ NEW: Add to our collection for the immediate notification.
                addedLogsForNotification.push(newLog);
            }
        }
    }

    // ✨ NEW: If we added any new, unique logs, notify the UI immediately.
    if (addedLogsForNotification.length > 0) {
        console.log(`Notifying UI that processing has started for ${addedLogsForNotification.length} new logs.`);
        io.emit('processing-started', {
            count: addedLogsForNotification.length,
            // Send just the message and container for a lightweight payload.
            logs: addedLogsForNotification.map(l => ({ message: l.message, container: l.container }))
        });
    }

    res.status(200).send('OK');
});

// --- Returns the last N hours of error/critical logs for dashboard charting ---
app.get('/errors', (req, res) => {
    const HOURS = parseInt(req.query.hours || '12', 10);
    const now = Date.now();
    const since = now - HOURS * 60 * 60 * 1000;

    // deduplicationCache has .log.time for all unique error logs; logBuffer may have some as well
    // For dashboard accuracy, let's gather all from both (if you clear logBuffer, you may want to keep a separate history array)
    let errorLogs = [];

    // 1. From deduplicationCache (unique errors, last seen)
    deduplicationCache.forEach((entry) => {
        const log = entry.log;
        const logTime = new Date(log.time).getTime();
        const severity = categorizeLogLevel(log.message);
        if (
            (severity === "CRITICAL" || severity === "ERROR") &&
            logTime >= since
        ) {
            errorLogs.push({
                time: log.time,
                message: log.message,
                container: log.container,
                severity,
                count: entry.count,
                lastSeen: entry.lastSeen
            });
        }
    });

    // 2. Optionally add from logBuffer if you want "pending" logs (remove if unnecessary)
    errorLogs = errorLogs.concat(
        logBuffer
            .filter(
                (log) =>
                    (categorizeLogLevel(log.message) === "CRITICAL" ||
                        categorizeLogLevel(log.message) === "ERROR") &&
                    new Date(log.time).getTime() >= since
            )
            .map((log) => ({
                time: log.time,
                message: log.message,
                container: log.container,
                severity: categorizeLogLevel(log.message),
                count: 1
            }))
    );

    // Remove potential duplicates by (time, message, container)
    const seen = new Set();
    const deduped = [];
    for (const log of errorLogs) {
        const key = [log.time, log.message, log.container].join("||");
        if (!seen.has(key)) {
            deduped.push(log);
            seen.add(key);
        }
    }

    res.json(deduped);
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

// ✨ NEW: Endpoint to test message chunking for different platforms
app.post('/test-chunking', (req, res) => {
    const { message, platform } = req.body;
    if (!message) {
        return res.status(400).send('Missing "message" in request body.');
    }

    const testPlatform = platform || WEBHOOK_PLATFORM;
    const platformKey = testPlatform.toLowerCase();
    const limits = PLATFORM_LIMITS[platformKey] || PLATFORM_LIMITS.generic;
    
    const chunks = splitMessage(message, limits.maxChars);
    const payloads = formatWebhookPayload(message, testPlatform);
    
    res.status(200).json({
        platform: testPlatform,
        originalLength: message.length,
        characterLimit: limits.maxChars,
        chunkCount: chunks.length,
        chunks: chunks,
        payloads: payloads,
        wouldTruncate: message.length > limits.maxChars
    });
});

// ✨ NEW: Endpoint to generate test messages with enhanced markdown formatting for webhook testing
app.post('/generate-realistic-errors', (req, res) => {
    const testMessage = `📄 **Raw Logs in this Batch:**
\`\`\`
[14:23:15] [nginx] ERROR: Connection refused to backend server 192.168.1.100:3000
[14:23:16] [app] CRITICAL: Database connection pool exhausted - max connections: 50
[14:23:17] [system] WARNING: High memory usage detected: 89% (7.1GB/8GB)
[14:23:18] [nginx] ERROR: SSL certificate expired for domain example.com
[14:23:19] [app] ERROR: Failed to process payment for user ID 12345 - Stripe API timeout
[14:23:20] [system] CRITICAL: Disk space critically low: 95% full (/var/log - 50MB remaining)
[14:23:21] [app] WARNING: Redis connection latency high: 2.5s average
[14:23:22] [nginx] ERROR: Rate limit exceeded for IP 203.0.113.42 (100 req/min)
[14:23:23] [app] CRITICAL: Authentication service unreachable - all logins failing
[14:23:24] [system] ERROR: Network interface eth0 experiencing packet loss: 15%
\`\`\`

🤖 **AI Log Analysis (${LANGUAGE})**:

🚨 **CRITICAL ISSUES**
- **Database Connection Crisis**: Connection pool completely exhausted (50/50 connections used). This will block all database operations and cause application failures.
- **Impact**: Complete application downtime, no user access
- **Root Cause**: Connection pool limit reached, possible connection leaks
- **Immediate Action**: 
\`\`\`bash
# Check current connections
netstat -an | grep :5432 | wc -l
# Restart application to reset pool
systemctl restart your-app-service
# Increase pool size in config
\`\`\`

- **Authentication System Down**: Complete authentication service outage is preventing all user logins and access.
- **Impact**: All user authentication blocked
- **Immediate Action**: \`systemctl restart auth-service\` and verify \`systemctl status auth-service\`

- **Storage Emergency**: Disk space at 95% capacity with only 50MB remaining in \`/var/log\`.
- **Immediate Action**:
\`\`\`bash
# Check disk usage
df -h /var/log
# Rotate logs immediately
logrotate -f /etc/logrotate.conf
# Clean old logs
find /var/log -name "*.log.*.gz" -mtime +7 -delete
\`\`\`

⚠️ **WARNINGS**  
- **Memory Pressure**: System memory at **89% usage** (7.1GB/8GB) - approaching critical threshold
- **Details**: Risk of OOM killer activation
- **Preventive Action**: Monitor with \`free -h\` and consider scaling resources

- **Performance Degradation**: Redis connection latency at **2.5s average** indicates serious performance issues
- **Preventive Action**:
\`\`\`bash
redis-cli ping
redis-cli info memory
redis-cli slowlog get 10
\`\`\`

- **Network Issues**: **15% packet loss** on primary network interface affecting connectivity
- **Preventive Action**: \`ping -c 100 8.8.8.8\` and \`ethtool eth0\`

📊 **SUMMARY BY APPLICATION**
- **NGINX**: 3 errors - backend connectivity and SSL certificate issues
- **APPLICATION**: 4 critical issues - database, authentication, payment processing failures  
- **SYSTEM**: 3 warnings - resource exhaustion across memory, disk, and network

🔧 **RECOMMENDED ACTIONS**
1. **Priority 1 (Immediate)**:
   - Restart critical services: \`systemctl restart app-service auth-service\`
   - Free disk space and rotate logs
   - Renew SSL certificate for \`example.com\`

2. **Priority 2 (Soon)**:
   - Scale database connection pool in \`/etc/app/database.conf\`
   - Set up monitoring alerts for **memory >85%**, **disk >80%**
   - Investigate Redis performance bottlenecks

3. **Priority 3 (Maintenance)**:
   - Implement log rotation automation
   - Add network monitoring and packet loss alerts
   - Review application connection handling patterns

This analysis indicates a **cascading infrastructure failure** requiring immediate attention to prevent complete system outage.`;

    const platform = req.body.platform || WEBHOOK_PLATFORM;
    
    res.status(200).json({
        message: testMessage,
        length: testMessage.length,
        platform: platform,
        suggestion: `Use the /test-chunking endpoint to see how this message would be split for ${platform}.`
    });
});

// ✨ NEW: Queue management endpoints
app.get('/queue/status', (req, res) => {
    res.status(200).json(analysisQueue.getStatus());
});

app.post('/queue/clear', (req, res) => {
    analysisQueue.clear();
    res.status(200).json({ message: 'Queue cleared successfully' });
});

app.post('/queue/throttle', (req, res) => {
    const { interval } = req.body;
    if (typeof interval === 'number' && interval >= 1000) {
        analysisQueue.processInterval = interval;
        res.status(200).json({ 
            message: 'Throttle interval updated',
            newInterval: interval 
        });
    } else {
        res.status(400).json({ 
            error: 'Invalid interval. Must be a number >= 1000ms' 
        });
    }
});

app.post('/queue/priority', (req, res) => {
    const { logs, priority } = req.body;
    if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({ error: 'Invalid logs array' });
    }
    
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
        return res.status(400).json({ 
            error: 'Invalid priority. Must be one of: ' + validPriorities.join(', ')
        });
    }
    
    const batchHash = analysisQueue.enqueue(logs, priority);
    res.status(200).json({ 
        message: 'Logs queued successfully',
        batchHash: batchHash,
        priority: priority,
        queueSize: analysisQueue.queue.length
    });
});

// ✨ NEW: Configuration management endpoints
app.get('/ollama/models', async (req, res) => {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        if (response.ok) {
            const data = await response.json();
            res.status(200).json(data);
        } else {
            res.status(500).json({ error: 'Failed to fetch models from Ollama' });
        }
    } catch (error) {
        console.error('Error fetching Ollama models:', error);
        res.status(500).json({ error: 'Error connecting to Ollama' });
    }
});

app.post('/config', (req, res) => {
    try {
        const config = req.body;
        console.log('Received configuration update:', config);
        
        // Validate and update global configuration with proper type conversion and bounds checking
        if (config.model && typeof config.model === 'string') {
            global.MODEL = config.model;
        }
        
        if (config.temperature !== undefined) {
            const temp = parseFloat(config.temperature);
            if (!isNaN(temp) && temp >= 0 && temp <= 2) {
                global.TEMPERATURE = temp;
            } else {
                console.warn('Invalid temperature value:', config.temperature, 'Must be between 0 and 2');
            }
        }
        
        if (config.top_p !== undefined) {
            const topP = parseFloat(config.top_p);
            if (!isNaN(topP) && topP >= 0 && topP <= 1) {
                global.TOP_P = topP;
            } else {
                console.warn('Invalid top_p value:', config.top_p, 'Must be between 0 and 1');
            }
        }
        
        if (config.top_k !== undefined) {
            const topK = parseInt(config.top_k);
            if (!isNaN(topK) && topK >= 1 && topK <= 100) {
                global.TOP_K = topK;
            } else {
                console.warn('Invalid top_k value:', config.top_k, 'Must be between 1 and 100');
            }
        }
        
        if (config.repeat_penalty !== undefined) {
            const penalty = parseFloat(config.repeat_penalty);
            if (!isNaN(penalty) && penalty >= 0.5 && penalty <= 2) {
                global.REPEAT_PENALTY = penalty;
            } else {
                console.warn('Invalid repeat_penalty value:', config.repeat_penalty, 'Must be between 0.5 and 2');
            }
        }
        
        if (config.num_predict !== undefined) {
            const numPredict = parseInt(config.num_predict);
            if (!isNaN(numPredict) && numPredict >= 1 && numPredict <= 4096) {
                global.NUM_PREDICT = numPredict;
            } else {
                console.warn('Invalid num_predict value:', config.num_predict, 'Must be between 1 and 4096');
            }
        }
        
        if (config.keep_alive !== undefined && typeof config.keep_alive === 'string') {
            // Validate keep_alive format (e.g., "10m", "5s", "1h", "-1")
            if (config.keep_alive === '-1' || /^\d+[smh]$/.test(config.keep_alive)) {
                // Convert "-1" string to number for Ollama compatibility
                global.KEEP_ALIVE = config.keep_alive === '-1' ? -1 : config.keep_alive;
            } else {
                console.warn('Invalid keep_alive format:', config.keep_alive, 'Must be like "10m", "5s", "1h", or "-1"');
            }
        }
        
        if (config.streaming !== undefined && typeof config.streaming === 'boolean') {
            global.STREAMING = config.streaming;
        }
        
        if (config.stop && Array.isArray(config.stop)) {
            // Filter out empty strings and validate stop tokens
            const validStopTokens = config.stop
                .filter(token => typeof token === 'string' && token.trim().length > 0)
                .map(token => token.trim());
            
            if (validStopTokens.length > 0) {
                global.STOP_TOKENS = validStopTokens;
            } else {
                console.warn('No valid stop tokens provided, keeping defaults');
            }
        }

        console.log('Configuration updated successfully. New global config:', {
            MODEL: global.MODEL,
            TEMPERATURE: global.TEMPERATURE,
            TOP_P: global.TOP_P,
            TOP_K: global.TOP_K,
            REPEAT_PENALTY: global.REPEAT_PENALTY,
            NUM_PREDICT: global.NUM_PREDICT,
            KEEP_ALIVE: global.KEEP_ALIVE,
            STREAMING: global.STREAMING,
            STOP_TOKENS: global.STOP_TOKENS
        });
        
        res.status(200).json({ 
            message: 'Configuration updated successfully',
            config: {
                model: global.MODEL,
                temperature: global.TEMPERATURE,
                top_p: global.TOP_P,
                top_k: global.TOP_K,
                repeat_penalty: global.REPEAT_PENALTY,
                num_predict: global.NUM_PREDICT,
                keep_alive: global.KEEP_ALIVE,
                streaming: global.STREAMING,
                stop_tokens: global.STOP_TOKENS
            }
        });
    } catch (error) {
        console.error('Error updating configuration:', error);
        res.status(500).json({ error: 'Failed to update configuration', details: error.message });
    }
});

app.post('/test-model', async (req, res) => {
    const { model } = req.body;
    const startTime = Date.now();
    
    try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model || MODEL,
                prompt: 'Test: Respond with "OK"',
                stream: false,
                options: {
                    num_predict: 10
                }
            })
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            res.status(200).json({
                success: true,
                responseTime: responseTime,
                response: data.response
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Model test failed',
                responseTime: responseTime
            });
        }
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('Model test error:', error);
        res.status(500).json({
            success: false,
            error: 'Error connecting to model',
            responseTime: responseTime
        });
    }
});

app.post('/warm-model', async (req, res) => {
    const { model, keep_alive } = req.body;
    
    try {
        // Handle keep_alive parameter properly
        const keepAliveValue = keep_alive === '-1' ? -1 : (keep_alive || '10m');
        
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model || MODEL,
                prompt: 'warmup',
                stream: false,
                keep_alive: keepAliveValue,
                options: {
                    num_predict: 1
                }
            })
        });

        if (response.ok) {
            console.log(`Model ${model || MODEL} warmed up with keep_alive: ${keepAliveValue}`);
            res.status(200).json({ 
                message: 'Model warmed up successfully',
                keep_alive: keepAliveValue
            });
        } else {
            res.status(500).json({ error: 'Failed to warm up model' });
        }
    } catch (error) {
        console.error('Model warm-up error:', error);
        res.status(500).json({ error: 'Error warming up model' });
    }
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

    const prompt = `You are a DevOps assistant. Analyze these structured logs and provide a clear, actionable summary with specific shell commands where relevant.

INSTRUCTIONS:
1. Parse the logs and categorize entries by severity: CRITICAL/ERROR, WARNING, and INFO
2. Summarize each issue under appropriate headings in priority order
3. For each issue, identify affected service(s), system resource(s), or components
4. Map issues to their likely root causes and suggest shell commands or config changes to fix or diagnose them
5. Highlight the most urgent issues first — those that may impact uptime, data integrity, or customer experience

OUTPUT FORMAT (use markdown formatting):
🚨 **CRITICAL ISSUES**
- **Issue Name**: Brief description of the problem
- **Impact**: What this affects (uptime, performance, etc.)
- **Root Cause**: Likely cause based on log analysis
- **Immediate Action**: Use code blocks for commands:
\`\`\`bash
systemctl restart service-name
\`\`\`

⚠️ **WARNINGS**
- **Issue Name**: Brief description
- **Details**: More context about the warning
- **Preventive Action**: Commands or configs to prevent escalation:
\`\`\`bash
df -h
systemctl status service-name
\`\`\`

📊 **SUMMARY BY APPLICATION**
- **ServiceName**: X errors, Y warnings - brief status summary
- **SystemName**: Status and key metrics

🔧 **RECOMMENDED ACTIONS**
1. **Priority 1 (Immediate)**:
   - Action description with inline commands like \`systemctl restart nginx\`
   - Use \`\`\`bash code blocks for multi-line commands
2. **Priority 2 (Soon)**:
   - Monitoring and prevention steps
3. **Priority 3 (Maintenance)**:
   - Long-term improvements

GUIDELINES:
- Use **bold** for emphasis on important terms
- Use \`inline code\` for single commands, file paths, and config values
- Use \`\`\`bash code blocks for multi-line commands and scripts
- Be concise and technically accurate
- Prioritize by business impact
- Respond in ${LANGUAGE}

STRUCTURED LOG DATA:
${structuredLogs}

SYSTEM RESOURCES:
${diskReport()}
Free memory: ${Math.round(os.freemem() / 1024 / 1024)}MB

Provide a structured analysis following the markdown format above in ${LANGUAGE}:`;

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
        // ✨ NEW: Use configuration parameters for optimal performance with validation
        const requestBody = {
            model: global.MODEL || MODEL,
            prompt,
            stream: global.STREAMING !== undefined ? global.STREAMING : false,
            keep_alive: global.KEEP_ALIVE !== undefined ? global.KEEP_ALIVE : "10m",
            options: {}
        };

        // Add options with validation to prevent invalid values from crashing Ollama
        if (global.TEMPERATURE !== undefined && !isNaN(global.TEMPERATURE)) {
            requestBody.options.temperature = Math.max(0, Math.min(2, global.TEMPERATURE));
        } else {
            requestBody.options.temperature = 0.2;
        }

        if (global.TOP_P !== undefined && !isNaN(global.TOP_P)) {
            requestBody.options.top_p = Math.max(0, Math.min(1, global.TOP_P));
        } else {
            requestBody.options.top_p = 0.8;
        }

        if (global.TOP_K !== undefined && !isNaN(global.TOP_K)) {
            requestBody.options.top_k = Math.max(1, Math.min(100, parseInt(global.TOP_K)));
        } else {
            requestBody.options.top_k = 20;
        }

        if (global.REPEAT_PENALTY !== undefined && !isNaN(global.REPEAT_PENALTY)) {
            requestBody.options.repeat_penalty = Math.max(0.5, Math.min(2, global.REPEAT_PENALTY));
        } else {
            requestBody.options.repeat_penalty = 1.1;
        }

        if (global.NUM_PREDICT !== undefined && !isNaN(global.NUM_PREDICT)) {
            requestBody.options.num_predict = Math.max(1, Math.min(4096, parseInt(global.NUM_PREDICT)));
        } else {
            requestBody.options.num_predict = 500;
        }

        if (global.STOP_TOKENS && Array.isArray(global.STOP_TOKENS) && global.STOP_TOKENS.length > 0) {
            requestBody.options.stop = global.STOP_TOKENS.filter(token => typeof token === 'string' && token.trim().length > 0);
        } else {
            requestBody.options.stop = ["---", "###"];
        }

        console.log('Sending request to Ollama with validated options:', JSON.stringify(requestBody.options, null, 2));

        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
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

// Platform-specific character limits
// Can be overridden via environment variables (e.g., DISCORD_MAX_CHARS=1500)
const PLATFORM_LIMITS = {
    discord: { maxChars: parseInt(process.env.DISCORD_MAX_CHARS) || 1500 },
    slack: { maxChars: parseInt(process.env.SLACK_MAX_CHARS) || 4000 },
    teams: { maxChars: parseInt(process.env.TEAMS_MAX_CHARS) || 4000 },
    telegram: { maxChars: parseInt(process.env.TELEGRAM_MAX_CHARS) || 4096 },
    mattermost: { maxChars: parseInt(process.env.MATTERMOST_MAX_CHARS) || 4000 },
    rocketchat: { maxChars: parseInt(process.env.ROCKETCHAT_MAX_CHARS) || 5000 },
    generic: { maxChars: parseInt(process.env.GENERIC_MAX_CHARS) || 2000 }
};

/**
 * Splits a message into chunks that fit within platform limits
 * @param {string} message - The full message to split
 * @param {number} maxChars - Maximum characters per chunk
 * @param {string} separator - Separator to add between chunks
 * @returns {Array<string>} Array of message chunks
 */
function splitMessage(message, maxChars, separator = '\n---\n') {
    if (message.length <= maxChars) {
        return [message];
    }

    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');
    
    for (const line of lines) {
        // If adding this line would exceed the limit
        if (currentChunk.length + line.length + 1 > maxChars) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // If a single line is too long, split it at word boundaries
            if (line.length > maxChars) {
                const words = line.split(' ');
                let linePart = '';
                
                for (const word of words) {
                    if (linePart.length + word.length + 1 > maxChars) {
                        if (linePart) {
                            chunks.push(linePart.trim());
                            linePart = word;
                        } else {
                            // Single word longer than limit, force split
                            chunks.push(word.substring(0, maxChars - 3) + '...');
                            linePart = '...' + word.substring(maxChars - 3);
                        }
                    } else {
                        linePart += (linePart ? ' ' : '') + word;
                    }
                }
                if (linePart) {
                    currentChunk = linePart;
                }
            } else {
                currentChunk = line;
            }
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

function formatWebhookPayload(message, platform) {
    const platformKey = platform.toLowerCase();
    const limits = PLATFORM_LIMITS[platformKey] || PLATFORM_LIMITS.generic;
    
    // Split message into chunks if needed
    const chunks = splitMessage(message, limits.maxChars);
    
    return chunks.map((chunk, index) => {
        const isMultiPart = chunks.length > 1;
        const partInfo = isMultiPart ? ` (Part ${index + 1}/${chunks.length})` : '';
        
        switch (platformKey) {
            case 'discord':
                return { content: chunk + partInfo };
            case 'slack':
                return { 
                    text: chunk + partInfo, 
                    mrkdwn: true, 
                    username: "Robolog", 
                    icon_emoji: ":robot_face:" 
                };
            case 'teams':
                return { 
                    "@type": "MessageCard", 
                    "@context": "http://schema.org/extensions", 
                    "themeColor": "0076D7", 
                    "summary": "Robolog Alert" + partInfo, 
                    "sections": [{ 
                        "activityTitle": "🤖 Robolog Alert" + partInfo, 
                        "activitySubtitle": `AI Log Analysis (${LANGUAGE})`, 
                        "text": chunk, 
                        "markdown": true 
                    }] 
                };
            case 'telegram':
                return { 
                    text: chunk + partInfo, 
                    parse_mode: "Markdown", 
                    disable_web_page_preview: true 
                };
            case 'mattermost':
                return { 
                    text: chunk + partInfo, 
                    username: "Robolog", 
                    icon_emoji: ":robot_face:" 
                };
            case 'rocketchat':
                return { 
                    text: chunk + partInfo, 
                    username: "Robolog", 
                    emoji: ":robot_face:" 
                };
            default:
                return { 
                    message: chunk + partInfo, 
                    platform: "robolog", 
                    timestamp: new Date().toISOString(), 
                    language: LANGUAGE, 
                    source: "ai-log-analysis" 
                };
        }
    });
}



async function sendWebhook(message) {
    if (!WEBHOOK_URL) return;
    
    try {
        // Get array of message chunks (or single message if under limit)
        const payloads = formatWebhookPayload(message, WEBHOOK_PLATFORM);
        
        console.log(`Sending ${payloads.length} webhook message(s) to ${WEBHOOK_PLATFORM}`);
        
        // Send each chunk with a small delay to avoid rate limiting
        for (let i = 0; i < payloads.length; i++) {
            const payload = payloads[i];
            
            try {
                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    console.error(`Webhook part ${i + 1}/${payloads.length} failed: ${response.status} ${response.statusText}`);
                    const errorBody = await response.text();
                    console.error(`Error details: ${errorBody}`);
                } else {
                    console.log(`✅ Webhook part ${i + 1}/${payloads.length} sent successfully`);
                }
                
                // Add delay between messages to avoid rate limiting (except for last message)
                if (i < payloads.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`Error sending webhook part ${i + 1}/${payloads.length}:`, error);
            }
        }
        
    } catch (error) {
        console.error('Webhook error:', error);
    }
}


