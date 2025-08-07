import { NextRequest, NextResponse } from 'next/server';

interface ErrorScenario {
    id: string;
    name: string;
    description: string;
    category: string;
    severity: 'CRITICAL' | 'ERROR' | 'WARNING';
}

const ERROR_LOGS: Record<string, string[]> = {
    // Nginx Errors
    "nginx-connection-refused": [
        "[error] 1234#0: *5678 connect() failed (111: Connection refused) while connecting to upstream",
        "[error] 1234#0: *5679 connect() failed (111: Connection refused) while connecting to upstream",
        "[error] nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)",
        "[error] nginx: [emerg] still could not bind()"
    ],
    "nginx-ssl-certificate-expired": [
        "[error] SSL certificate verification failed: certificate has expired",
        "[error] SSL_connect() failed (SSL routines:ssl3_read_bytes:tlsv1 alert certificate expired)",
        "[error] SSL certificate expired on 2024-01-15, current time is 2024-02-20",
        "[warn] SSL certificate will expire in 0 days"
    ],
    "nginx-upstream-unavailable": [
        "[error] 1234#0: *5678 upstream timed out (110: Connection timed out) while SSL handshaking to upstream",
        "[error] 1234#0: *5679 upstream sent no valid HTTP/1.0 header while reading response header from upstream",
        "[error] 1234#0: *5680 upstream prematurely closed connection while reading response header from upstream",
        "[error] 1234#0: *5681 upstream sent invalid header while reading response header from upstream"
    ],

    // Ubuntu System Errors
    "ubuntu-disk-space-full": [
        "[error] df: no space left on device",
        "[error] write error: No space left on device",
        "[error] ext4 filesystem error: no free space",
        "[warn] Filesystem /dev/sda1 is 95% full",
        "[error] Cannot write to /var/log: No space left on device"
    ],
    "ubuntu-memory-exhausted": [
        "[error] Out of memory: Kill process 1234 (node) score 123 or sacrifice child",
        "[error] Killed process 1234 (node) total-vm:1234567kB, anon-rss:123456kB, file-rss:1234kB",
        "[error] Memory cgroup out of memory: Kill process 1234 (node) score 123",
        "[warn] Memory usage at 98%, system may become unresponsive"
    ],
    "ubuntu-cpu-overload": [
        "[warn] CPU usage at 100% for 5 minutes",
        "[warn] Load average: 15.23, 14.89, 13.45",
        "[warn] System under heavy load, response times degraded",
        "[error] Process 1234 using 95% CPU for extended period"
    ],

    // Node.js Errors
    "nodejs-unhandled-rejection": [
        "[error] UnhandledPromiseRejectionWarning: Unhandled promise rejection",
        "[error] UnhandledPromiseRejectionWarning: Error: Database connection failed",
        "[error] UnhandledPromiseRejectionWarning: Error: Network timeout",
        "[error] UnhandledPromiseRejectionWarning: Error: Invalid JSON response"
    ],
    "nodejs-memory-leak": [
        "[warn] Memory usage growing: 512MB -> 1.2GB -> 2.1GB",
        "[warn] Heap size: 1.2GB, Heap used: 1.1GB",
        "[error] JavaScript heap out of memory",
        "[error] FATAL ERROR: Ineffective mark-compacts near heap limit"
    ],
    "nodejs-port-already-in-use": [
        "[error] Error: listen EADDRINUSE: address already in use :::3000",
        "[error] Error: listen EADDRINUSE: address already in use :::8080",
        "[error] Error: listen EADDRINUSE: address already in use :::443",
        "[error] Port 3000 is already in use by another process"
    ],

    // Next.js Errors
    "nextjs-build-failed": [
        "[error] TypeScript error: Cannot find module './components/Button'",
        "[error] Build failed: SyntaxError: Unexpected token",
        "[error] Module not found: Can't resolve './utils/helper'",
        "[error] Build failed: Error: ENOENT: no such file or directory"
    ],
    "nextjs-runtime-error": [
        "[error] Uncaught TypeError: Cannot read property 'map' of undefined",
        "[error] ReferenceError: component is not defined",
        "[error] TypeError: Cannot read properties of null (reading 'innerHTML')",
        "[error] Uncaught Error: Hydration failed because the server rendered HTML didn't match the client"
    ],
    "nextjs-api-route-error": [
        "[error] API route error: Database connection timeout",
        "[error] API route error: 500 Internal Server Error",
        "[error] API route error: Cannot read property 'body' of undefined",
        "[error] API route error: Validation failed for request body"
    ],

    // PM2 Errors
    "pm2-process-crashed": [
        "[error] PM2: Process crashed with exit code 1",
        "[error] PM2: Process app-0 crashed, restarting...",
        "[error] PM2: Process app-1 crashed, restarting...",
        "[error] PM2: Process app-2 crashed, restarting...",
        "[error] PM2: All processes crashed, stopping PM2"
    ],
    "pm2-memory-limit-exceeded": [
        "[warn] PM2: Process app-0 exceeded memory limit (512MB)",
        "[error] PM2: Process app-1 killed due to memory limit",
        "[warn] PM2: Memory usage: 1.2GB/512MB",
        "[error] PM2: Process restarted due to memory limit exceeded"
    ],
    "pm2-cluster-mode-issues": [
        "[error] PM2: Worker process 1234 failed to start",
        "[error] PM2: Cluster mode: Worker 1235 disconnected unexpectedly",
        "[error] PM2: Worker process 1236 exited with code 1",
        "[error] PM2: Cluster mode: Failed to spawn worker process"
    ],

    // Database Errors
    "database-connection-timeout": [
        "[error] Database connection timeout after 30 seconds",
        "[error] MySQL connection failed: Connection timed out",
        "[error] PostgreSQL connection failed: timeout expired",
        "[error] MongoDB connection failed: Server selection timed out"
    ],
    "database-deadlock": [
        "[error] Database deadlock detected: Transaction 1234 waiting for lock",
        "[error] MySQL deadlock: Transaction 1235 was deadlocked",
        "[error] PostgreSQL deadlock: Process 1236 acquired lock on relation",
        "[error] Database deadlock resolved by killing transaction 1237"
    ],

    // Docker Errors
    "docker-container-crashed": [
        "[error] Docker container exited with code 1",
        "[error] Container app-1234 stopped unexpectedly",
        "[error] Docker container app-5678 crashed: OOM killed",
        "[error] Container app-9012 exited with status 139 (SIGSEGV)"
    ],
    "docker-out-of-memory": [
        "[error] Docker container killed due to memory limit exceeded",
        "[error] Container app-1234 OOM killed: memory limit 512MB exceeded",
        "[error] Docker out of memory: container app-5678 using 1.2GB/512MB",
        "[error] Container app-9012 killed by OOM killer"
    ],

    // Network Errors
    "network-dns-resolution-failed": [
        "[error] DNS resolution failed: nslookup: can't resolve 'api.example.com'",
        "[error] DNS query failed: Name or service not known",
        "[error] DNS resolution timeout: server 8.8.8.8 not responding",
        "[error] DNS lookup failed: Temporary failure in name resolution"
    ],
    "network-timeout": [
        "[error] Network timeout: connect() timed out after 30 seconds",
        "[error] HTTP request timeout: GET /api/data timed out after 60s",
        "[error] Network connection timeout: unable to reach external service",
        "[error] Socket timeout: connection to database timed out"
    ]
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { errorType, scenario } = body;

        if (!errorType || !ERROR_LOGS[errorType]) {
            return NextResponse.json(
                { error: 'Invalid error type provided' },
                { status: 400 }
            );
        }

        // Get the logs for the specific error type
        const logs = ERROR_LOGS[errorType];
        const randomLogs = logs.slice(0, Math.min(3, logs.length)); // Send 3 random logs

        // Create a realistic error scenario
        const timestamp = new Date().toISOString();
        const logEntries = randomLogs.map((log, index) => ({
            timestamp: new Date(Date.now() - index * 1000).toISOString(),
            level: log.includes('[error]') ? 'ERROR' : log.includes('[warn]') ? 'WARNING' : 'INFO',
            message: log,
            container: scenario?.category || 'unknown',
            service: scenario?.name || 'unknown'
        }));

        // Send logs to the analyzer in the format it expects
        const analyzerResponse = await fetch(`${process.env.ANALYZER_URL || 'http://localhost:3001'}/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logEntries.map(log => ({
                log: log.message,
                container_name: log.container,
                time: log.timestamp,
                stream: 'stdout'
            }))),
        });

        if (!analyzerResponse.ok) {
            throw new Error(`Analyzer responded with status: ${analyzerResponse.status}`);
        }

        return NextResponse.json({
            message: `Successfully generated ${scenario?.name || errorType} error scenario`,
            logs: logEntries,
            scenario: scenario
        });

    } catch (error) {
        console.error('Error generating specific error:', error);
        return NextResponse.json(
            { error: 'Failed to generate specific error scenario' },
            { status: 500 }
        );
    }
} 