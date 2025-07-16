import { NextResponse } from 'next/server';

// This is a server-side route. console.error/warn will be captured by Docker's logging driver.
export async function POST() {
    console.log("Request received: Generating realistic errors for demonstration.");

    // 1. Nginx Error
    setTimeout(() => console.error('2025/07/05 14:15:32 [error] 123#123: *1 connect() failed while connecting to upstream, client: 192.168.1.100, server: localhost'), 100);

    // 2. Ubuntu System Error
    setTimeout(() => console.error('CRITICAL: /var/log partition has reached 95% capacity. Log rotation may fail.'), 200);

    // 3. Node.js Application Error
    setTimeout(() => console.error('ERROR: Database connection failed after 3 retries. MongoError: connect ECONNREFUSED 127.0.0.1:27017'), 300);

    // 4. Node.js Warning
    setTimeout(() => console.warn('WARNING: High memory usage detected - 1.8GB/2GB (90%). Consider investigating memory leaks.'), 400);

    return NextResponse.json({ message: "Error generation process started. Check logs and configured webhooks." });
}