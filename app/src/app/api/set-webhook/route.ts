import { NextRequest, NextResponse } from 'next/server';
import { getAnalyzerUrl } from '@/lib/analyzer-api'; // ✨ Import the helper

// ✅ The URL is now dynamic and determined by the environment.
const ANALYZER_URL = `${getAnalyzerUrl()}/set-webhook`;

//const ANALYZER_URL = 'http://analyzer:9880/set-webhook';

export async function POST(req: NextRequest) {
    // ✅ Log that the API route has been hit.
    console.log("API route /api/set-webhook called.");
    try {
        const body = await req.json();
        const webhookUrl = body.url;
        // ✅ Log the data being forwarded for easier debugging.
        console.log(`Forwarding webhook URL to analyzer: ${webhookUrl}`);

        // Forward the request to the analyzer service
        const response = await fetch(ANALYZER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
        });

        // ✅ Log the response status from the downstream service.
        console.log(`Received status ${response.status} from analyzer.`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Analyzer returned an error: ${errorBody}`);
            return new NextResponse(errorBody, { status: response.status });
        }

        return new NextResponse(response.body, { status: response.status });
    } catch (error) {
        // ✅ BEST PRACTICE: Log the actual error for better debugging.
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error in /api/set-webhook:", errorMessage);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
