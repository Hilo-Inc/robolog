import { NextResponse } from 'next/server';
import { getAnalyzerUrl } from '@/lib/analyzer-api'; // ✨ Import the helper

// ✅ The URL is now dynamic and determined by the environment.
const ANALYZER_URL = `${getAnalyzerUrl()}/logs`;
// The URL for the analyzer service, using Docker's internal DNS.
//const ANALYZER_URL = 'http://analyzer:9880/logs';

export async function POST() {
    try {
        console.log("API route /api/test-analyzer called. Sending direct log to analyzer.");

        const mockLog = {
            log: 'ERROR: This is a direct test log from the app to the analyzer. If you see this, the analyzer is working.',
            container_name: 'app-direct-test',
            time: new Date().toISOString(),
            stream: 'stdout'
        };

        const response = await fetch(ANALYZER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([mockLog]), // Fluent Bit often sends an array
        });

        console.log(`Direct-to-analyzer request returned status ${response.status}.`);

        if (!response.ok) {
            const errorBody = await response.text();
            return new NextResponse(`Analyzer returned an error: ${errorBody}`, { status: response.status });
        }
        
        return NextResponse.json({ message: "Successfully sent a direct test log to the analyzer." });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error("Error in /api/test-analyzer:", errorMessage);
        return NextResponse.json({ message: `Internal server error: ${errorMessage}` }, { status: 500 });
    }
}
