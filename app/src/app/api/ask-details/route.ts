import { NextRequest, NextResponse } from 'next/server';
import { getAnalyzerUrl } from '@/lib/analyzer-api'; // ✨ Import the helper

// ✅ The URL is now dynamic and determined by the environment.
const ANALYZER_URL = `${getAnalyzerUrl()}/ask-details`;

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
