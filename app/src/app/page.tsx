"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportDisplay } from '@/components/dashboard/ReportDisplay';
import { ChatModal } from "@/components/dashboard/ChatModal";
import { AskQuestionButton } from "@/components/dashboard/AskQuestionButton";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';

interface ParsedReport {
    id: string;
    time: string;
    date: string;
    topSeverity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'UNKNOWN';
    snippet: string;
    fullReport: string;
    timestamp: number;
}


function getLast12HoursBuckets() {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMinutes(0, 0, 0); // round to hour
        d.setHours(d.getHours() - i);
        buckets.push({
            hour: d.getHours().toString().padStart(2, "0") + ":00",
            iso: d.toISOString().slice(0, 13) // for matching
        });
    }
    return buckets;
}



function parseReportForTable(report: string, index: number): ParsedReport {
    const id = `${Date.now()}-${index}`;

    let time = "N/A";
    let date = "N/A";
    let timestamp = Date.now();
    
    // Try to extract time from the log entries
    const timeMatch = report.match(/\[(\d{2}:\d{2}:\d{2})\]/);
    if (timeMatch) {
        time = timeMatch[1];
        
        // Create a proper date/timestamp for this report
        const now = new Date();
        const [h, m, s] = timeMatch[1].split(':').map(Number);
        const reportDate = new Date(now);
        reportDate.setHours(h, m, s, 0);
        
        // If the time is in the future, assume it's from yesterday
        if (reportDate > now) {
            reportDate.setDate(reportDate.getDate() - 1);
        }
        
        timestamp = reportDate.getTime();
        date = reportDate.toLocaleDateString();
        time = reportDate.toLocaleTimeString();
    }

    // Improved severity detection based on actual AI report structure
    let topSeverity: ParsedReport['topSeverity'] = 'UNKNOWN';
    
    // Check for section headers with emojis (highest priority first)
    if (report.includes('🚨') || report.match(/\*\*CRITICAL\s+ISSUES?\*\*/i)) {
        topSeverity = 'CRITICAL';
    } else if (report.includes('❌') || report.match(/\*\*ERROR\s+ISSUES?\*\*/i)) {
        topSeverity = 'ERROR';
    } else if (report.includes('⚠️') || report.match(/\*\*WARNINGS?\*\*/i)) {
        topSeverity = 'WARNING';
    } else if (report.includes('📊') || report.includes('🤖') || report.includes('🔧')) {
        // If we only have summary/analysis/actions sections, default to warning
        topSeverity = 'WARNING';
    }

    // Improved snippet extraction - get meaningful content instead of just titles
    let snippet = "Could not generate summary snippet.";
    
    // Try to find the AI analysis section
    const summaryMatch = report.match(/🤖 \*\*AI Log Analysis.*?\*\*:\s*([\s\S]*)/);
    if (summaryMatch && summaryMatch[1]) {
        const analysisContent = summaryMatch[1].trim();
        
        // Look for the first meaningful line after section headers
        const lines = analysisContent.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Skip empty lines, section headers, and bullet point headers
            if (trimmedLine && 
                !trimmedLine.startsWith('🚨') && 
                !trimmedLine.startsWith('⚠️') && 
                !trimmedLine.startsWith('📊') && 
                !trimmedLine.startsWith('🔧') &&
                !trimmedLine.match(/^\*\*[A-Z\s]+\*\*$/)) {
                
                // If it's a bullet point, extract the content after the dash and formatting
                if (trimmedLine.startsWith('- ')) {
                    snippet = trimmedLine.substring(2).replace(/\*\*([^*]+)\*\*/g, '$1').trim();
                } else {
                    snippet = trimmedLine.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
                }
                
                // Limit snippet length
                if (snippet.length > 100) {
                    snippet = snippet.substring(0, 100) + '...';
                }
                break;
            }
        }
    }

    return { id, time, date, topSeverity, snippet, fullReport: report, timestamp };
}


export default function DashboardPage() {
    // ✨ NEW: Initialize state from localStorage on the client side.
    const [reports, setReports] = useState<string[]>(() => {
        // This function only runs on the initial render.
        // It's important to check for `window` to avoid errors during server-side rendering.
        if (typeof window === 'undefined') {
            return [];
        }
        try {
            const savedReports = window.localStorage.getItem('robolog-reports');
            // If reports are found in localStorage, parse and return them.
            return savedReports ? JSON.parse(savedReports) : [];
        } catch (error) {
            // If parsing fails, log the error and return an empty array.
            console.error("Failed to parse reports from localStorage", error);
            return [];
        }
    });
    const [status, setStatus] = useState("Not connected");
    const [selectedReport, setSelectedReport] = useState<ParsedReport | null>(null);
    const [processingStatus, setProcessingStatus] = useState<string | null>(null);
    const [modelName, setModelName] = useState<string>("...");
    const [showOldIssues, setShowOldIssues] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);

    // ✨ NEW: Persist reports to localStorage whenever they change.
    useEffect(() => {
        try {
            // This effect runs every time the `reports` state is updated.
            window.localStorage.setItem('robolog-reports', JSON.stringify(reports));
        } catch (error) {
            console.error("Failed to save reports to localStorage", error);
        }
    }, [reports]);



    // Fetch Ollama model name from analyzer
    useEffect(() => {
        fetch('/analyzer/status')
            .then(r => r.json())
            .then(data => setModelName(data?.configuration?.model || 'unknown'))
            .catch(() => setModelName('unknown'));
    }, []);

    // ✅ MODIFIED: Fetch initial reports only if localStorage is empty.
    useEffect(() => {
        // This check ensures we don't overwrite reports loaded from localStorage.
        if (reports.length === 0) {
            const fetchReports = async () => {
                setStatus("Fetching reports...");
                try {
                    const response = await fetch('/api/reports');
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setReports(data);
                    }
                    setStatus("Connected to Analyzer");
                } catch (error) {
                    console.error("Failed to fetch initial reports:", error);
                    setStatus("Failed to connect");
                }
            };
            fetchReports();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // This effect should only run once on mount.

    // Setup WebSocket
    useEffect(() => {
        const socket = io({
            path: "/analyzer/socket.io",
            transports: ["websocket"],
        });

        socket.on("connect", () => setStatus("Connected to Analyzer"));
        socket.on("disconnect", () => setStatus("Disconnected from Analyzer"));
        socket.on("connect_error", (err) => {
            console.error("WebSocket connection error:", err.message);
            setStatus(`Connection Error: Is the analyzer running?`);
        });

        socket.on('processing-started', (data: { count: number, logs: { message: string, container: string }[] }) => {
            console.log('Processing started event received:', data);
            const logSnippets = data.logs.map(log => `- [${log.container}] ${log.message.substring(0, 80)}...`).join('\n');
            setProcessingStatus(`🤖 Analyzer has received ${data.count} new error(s) and is generating a report. This may take a moment...\n\nLogs received:\n${logSnippets}`);
            
            // Fallback: Clear processing status after 2 minutes if no report is received
            const timeoutId = setTimeout(() => {
                console.log('Processing timeout reached, clearing status');
                setProcessingStatus(null);
            }, 120000); // 2 minutes
            
            // Store timeout ID to clear it if we receive a report
            (window as any).processingTimeout = timeoutId;
        });

        socket.on("new-summary", (newReport: string) => {
            console.log('New summary received, clearing processing status');
            
            // Clear the timeout if we receive a report
            if ((window as any).processingTimeout) {
                clearTimeout((window as any).processingTimeout);
                (window as any).processingTimeout = null;
            }
            
            // ✅ This update will trigger the localStorage persistence effect.
            setReports(prev => [newReport, ...prev]);
            setProcessingStatus(null);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Listen for test markdown reports
    useEffect(() => {
        const handleTestMarkdownReport = (event: any) => {
            const { report } = event.detail;
            console.log('Test markdown report received:', report);
            setReports(prev => [report, ...prev]);
        };

        window.addEventListener('test-markdown-report', handleTestMarkdownReport);
        return () => {
            window.removeEventListener('test-markdown-report', handleTestMarkdownReport);
        };
    }, []);

    const parsedReports = reports.map(parseReportForTable);

    // Separate recent and old reports (12 hours = 12 * 60 * 60 * 1000 ms)
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    const recentReports = parsedReports.filter(report => report.timestamp > twelveHoursAgo);
    const oldReports = parsedReports.filter(report => report.timestamp <= twelveHoursAgo);

    const buckets = getLast12HoursBuckets();

    const chartData = buckets.map(b => ({
        hour: b.hour,
        reports: []
    }));

    // Use the same report data as the table instead of separate errorLogs
    for (const report of parsedReports) {
        if (report.timestamp > 0) {
            const reportDate = new Date(report.timestamp);
            const hourIso = reportDate.toISOString().slice(0, 13);
            const idx = buckets.findIndex(b => b.iso === hourIso);
            if (idx !== -1) {
                // @ts-ignore
                chartData[idx].reports.push(report);
            }
        }
    }

    const errorPoints = chartData.map(b => ({
        hour: b.hour,
        count: b.reports.length,
        reports: b.reports
    }));


    return (
        <>
            {processingStatus && (
                <Card className="mb-4 bg-blue-900/50 border-blue-500 animate-pulse">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-300 flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-400 rounded-full animate-bounce"></div>
                            Analysis in Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="whitespace-pre-wrap font-mono text-sm text-blue-200">
                            {processingStatus}
                        </pre>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>AI Generated Reports</CardTitle>
                        <Badge variant={status === "Connected to Analyzer" ? "default" : "destructive"}>{status}</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[140px]">Date & Time</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Summary</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentReports.length > 0 ? recentReports.map((report) => (
                                <TableRow key={report.id}>
                                    <TableCell className="font-mono">
                                        <div className="text-xs">{report.date}</div>
                                        <div>{report.time}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={report.topSeverity === 'CRITICAL' || report.topSeverity === 'ERROR' ? 'destructive' : 'default'}>
                                            {report.topSeverity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-sm truncate">{report.snippet}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                                            View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No recent reports. Go to the Testing Tools page to generate some errors.
                                    </TableCell>
                                </TableRow>
                            )}
                            
                            {oldReports.length > 0 && (
                                <>
                                    <TableRow className="bg-muted/50">
                                        <TableCell colSpan={4}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowOldIssues(!showOldIssues)}
                                                className="w-full flex items-center justify-center gap-2"
                                            >
                                                {showOldIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                {showOldIssues ? 'Hide' : 'Show'} older issues ({oldReports.length} items older than 12 hours)
                                                {showOldIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    {showOldIssues && oldReports.map((report) => (
                                        <TableRow key={report.id} className="opacity-60">
                                            <TableCell className="font-mono">
                                                <div className="text-xs">{report.date}</div>
                                                <div>{report.time}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={report.topSeverity === 'CRITICAL' || report.topSeverity === 'ERROR' ? 'destructive' : 'default'}>
                                                    {report.topSeverity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-sm truncate">{report.snippet}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                                                    View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedReport} onOpenChange={(open) => {
                if (!open) {
                    setSelectedReport(null);
                }
            }}>
                <DialogContent className="sm:max-w-[95vw] h-[90vh] flex flex-col">
                    <DialogHeader className="relative">
                        <DialogTitle>AI Report Details</DialogTitle>
                        <DialogDescription>
                            Full AI analysis and follow-up prompt for report generated at {selectedReport?.time}.
                        </DialogDescription>
                        {/* Ask Question Button */}
                        <AskQuestionButton
                            onClick={() => setShowChatModal(true)}
                            className="absolute bottom-0 right-0"
                        />
                    </DialogHeader>
                    
                    {/* Full-width report display */}
                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full pr-4">
                            <ReportDisplay report={selectedReport?.fullReport ?? ''} />
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Chat Modal */}
            <ChatModal
                isOpen={showChatModal}
                onClose={() => setShowChatModal(false)}
                report={selectedReport?.fullReport ?? ''}
                reportId={selectedReport?.id ?? ''}
            />
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Errors in Last 12 Hours</CardTitle>
                </CardHeader>
                <CardContent>
                    <div style={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                            <LineChart data={errorPoints}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const reports = payload[0].payload.reports;
                                            return (
                                                <div className="bg-gray-800 text-white p-2 rounded">
                                                    <div><b>{label}</b></div>
                                                    <div>Reports: {reports.length}</div>
                                                    {reports.slice(0,3).map((report: ParsedReport, i: number) => (
                                                        <div key={i} className="mt-1">
                                                            <div className="font-mono text-xs">
                                                                <span className="text-yellow-400">{report.topSeverity}</span> — {report.snippet}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {reports.length > 3 && <div className="text-xs text-gray-400">+{reports.length-3} more</div>}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 7 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
            <div className="mt-8 text-center text-sm text-muted-foreground opacity-75">
                Powered by <span className="font-semibold">{modelName}</span>
            </div>
        </>
    );
}
