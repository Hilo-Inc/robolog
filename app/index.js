import express from 'express';
const app = express();
app.get('/', (_, res) => res.send('Hello from Node behind Nginx!'));
app.get('/test-error', (_, res) => {
    console.error('ERROR Test error message generated for analyzer testing');
    res.send('Error message logged to stderr');
});

app.get('/generate-realistic-errors', (_, res) => {
    // Generate 3 realistic errors from different components
    
    // 1. Nginx Error (502 Bad Gateway)
    setTimeout(() => {
        console.error('2025/07/05 14:15:32 [error] 123#123: *1 connect() failed (111: Connection refused) while connecting to upstream, client: 192.168.1.100, server: localhost, request: "GET /api/users HTTP/1.1", upstream: "http://127.0.0.1:3000/api/users", host: "localhost"');
    }, 100);
    
    // 2. Ubuntu System Error (Disk Space Critical)
    setTimeout(() => {
        console.error('CRITICAL: /var/log partition has reached 95% capacity (47.2GB used of 50GB). Log rotation may fail. Services at risk of shutdown.');
    }, 200);
    
    // 3. Node.js Application Error (Database Connection)
    setTimeout(() => {
        console.error('ERROR: Database connection failed after 3 retries. MongoError: connect ECONNREFUSED 127.0.0.1:27017 at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16). User sessions may be lost.');
    }, 300);
    
    // 4. Bonus: Node.js Warning (Memory usage)
    setTimeout(() => {
        console.warn('WARNING: High memory usage detected - 1.8GB/2GB (90%). Consider increasing heap size or investigating memory leaks in user authentication module.');
    }, 400);
    
    res.json({
        message: 'Generated 4 realistic errors for testing',
        errors: [
            { type: 'nginx', severity: 'ERROR', description: '502 Bad Gateway - upstream connection refused' },
            { type: 'ubuntu', severity: 'CRITICAL', description: 'Disk space critical - /var/log at 95% capacity' },
            { type: 'nodejs', severity: 'ERROR', description: 'Database connection failure after retries' },
            { type: 'nodejs', severity: 'WARNING', description: 'High memory usage warning' }
        ],
        note: 'Check Discord channel in ~60 seconds for structured analysis'
    });
});
app.listen(3000, () => console.log('App listening on :3000'));
