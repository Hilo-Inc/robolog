import { NextResponse } from 'next/server';

const ANALYZER_URL = 'http://analyzer:9880/reports';

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
        return NextResponse.json({ message: `Internal server error: ${errorMessage}` }, { status: 500 });
    }
}