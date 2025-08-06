import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const CHAT_DIR = path.join(os.homedir(), 'robolog-chats');

// Ensure chat directory exists
async function ensureChatDirectory() {
    try {
        await fs.access(CHAT_DIR);
    } catch {
        await fs.mkdir(CHAT_DIR, { recursive: true });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureChatDirectory();
        
        const body = await request.json();
        const { reportId, question, answer, timestamp } = body;
        
        if (!reportId || !question || !answer) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const chatFile = path.join(CHAT_DIR, `${reportId}.json`);
        let chats = [];
        
        // Load existing chats if file exists
        try {
            const existingData = await fs.readFile(chatFile, 'utf-8');
            chats = JSON.parse(existingData);
        } catch {
            // File doesn't exist or is empty, start with empty array
        }
        
        // Add new chat entry
        const newChat = {
            question,
            answer,
            timestamp: timestamp || new Date().toISOString(),
            id: Date.now().toString()
        };
        
        chats.push(newChat);
        
        // Save updated chats
        await fs.writeFile(chatFile, JSON.stringify(chats, null, 2));
        
        return NextResponse.json({ success: true, chat: newChat });
        
    } catch (error) {
        console.error('Error saving chat:', error);
        return NextResponse.json({ error: 'Failed to save chat' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        await ensureChatDirectory();
        
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');
        
        if (!reportId) {
            return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
        }
        
        const chatFile = path.join(CHAT_DIR, `${reportId}.json`);
        
        try {
            const data = await fs.readFile(chatFile, 'utf-8');
            const chats = JSON.parse(data);
            return NextResponse.json({ chats });
        } catch {
            // File doesn't exist, return empty array
            return NextResponse.json({ chats: [] });
        }
        
    } catch (error) {
        console.error('Error loading chats:', error);
        return NextResponse.json({ error: 'Failed to load chats' }, { status: 500 });
    }
}