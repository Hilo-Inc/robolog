import { NextRequest, NextResponse } from 'next/server';

const ANALYZER_URL = 'http://analyzer:9880/ask-details';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("Forwarding follow-up question to analyzer:", body.question);

        const response = await fetch(ANALYZER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return new NextResponse(errorBody, { status: response.status });
        }
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error in /api/ask-details:", errorMessage);
        return NextResponse.json({ message: `Internal server error: ${errorMessage}` }, { status: 500 });
    }
}