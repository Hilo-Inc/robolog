import { NextRequest, NextResponse } from 'next/server';

// The URL for the analyzer service, using Docker's internal DNS.
const ANALYZER_URL = 'http://analyzer:9880/set-webhook';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const webhookUrl = body.url;

        // Forward the request to the analyzer service
        const response = await fetch(ANALYZER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
        });

        return new NextResponse(response.body, { status: response.status });
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}