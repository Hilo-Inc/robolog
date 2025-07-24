import { NextResponse } from 'next/server';
import { getAnalyzerUrl } from '@/lib/analyzer-api'; // ✨ Import the helper

// ✅ The URL is now dynamic and determined by the environment.
const ANALYZER_URL = `${getAnalyzerUrl()}/reports`;

export const dynamic = 'force-dynamic'; // Ensures the route is not cached

export async function GET() {
    try {
        const response = await fetch(ANALYZER_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch reports from analyzer: ${response.statusText}`);
        }
        const reports = await response.json();
        return NextResponse.json(reports);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error("Error in /api/reports:", errorMessage);
        // ✅ Provide a more helpful error message to the frontend.
        return NextResponse.json({ message: `Could not contact the analyzer service. Is it running? Error: ${errorMessage}` }, { status: 500 });
    }
}
